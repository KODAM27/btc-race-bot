// Trend-following cbBTC bot for agent-fun/bars-replay/v1 (make.fun btc-race-24h).
//
// Design notes
// ------------
// A full-size round trip on this pool costs roughly 30-50 bps once the 4 bps fee,
// the 2 bps modelled slippage and the order's own constant-product price impact
// are paid on both sides, so the bot trades rarely and only inside a confirmed
// uptrend. Minute-level crossovers churn (the house ema-cross baseline makes 76
// trades on the dev window and loses money), so every signal here runs on
// hour-scale averages of the 1-minute closes:
//
//   - Entry: when flat, EMA(fast) of the closes must sit above EMA(slow) with
//     a small relative band between them (a flat, sideways tape never fires),
//     and the close must be above where it was MOM_LOOKBACK bars ago. Then buy
//     once with STAKE_BPS of the cash on hand and stay in while price holds.
//   - Exit: a trailing stop only. The highest close since the position
//     appeared is tracked bar by bar; when a close falls TRAIL below it, sell
//     everything. The first version of this bot also sold on the EMA cross
//     back down, and that flip exit was the churn: on the dev window it cut
//     every position inside the mid-window pullback and paid the round-trip
//     cost again on each re-entry (9 trades, +$4.84). Dropping the flip exit
//     and letting the trailing stop do the work rides the trend to one trade
//     and +$30.53 on the same window, and the stop still bounds a falling
//     window to one stopped trade instead of a buy-and-hold loss.
//   - After an exit the bot sits out COOLDOWN_BARS before it may enter again,
//     so a stop-out in live chop cannot turn into a chain of stopped
//     re-entries; the trend conditions must still hold on that later bar.
//
// Everything is a function of the bars alone: float64 EMA arithmetic in a
// fixed order, no clock, no environment, no randomness, so two executions
// on the same data answer byte for byte the same.

import { runBars, type Bar, type BarsState, type OrderInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';

/** EMA spans in bars: about half an hour against about two hours. */
const FAST_SPAN = 30;
const SLOW_SPAN = 120;
/** Momentum lookback in bars, and the relative band the EMA gap must clear. */
const MOM_LOOKBACK = 120;
const TREND_BAND = 0.0002;
/** Share of cash a single entry spends (basis points of cash on hand). */
const STAKE_BPS = 9800n;
/** Trailing stop: exit when the close falls this share under the peak close since entry. */
const TRAIL = 0.03;
/** Bars to sit out after an exit before a new entry is allowed. */
const COOLDOWN_BARS = 120;
/** Slippage cap on every order: far above the modelled 2 bps plus impact at our size. */
const MAX_SLIPPAGE_BPS = 150;

/** One exponential moving average, seeded with the mean of its first span of closes. */
class Ema {
  span: number;
  seed: number[] = [];
  value: number | null = null;
  constructor(span: number) {
    this.span = span;
  }
  push(x: number): void {
    if (this.value !== null) {
      this.value += (2 / (this.span + 1)) * (x - this.value);
      return;
    }
    this.seed.push(x);
    if (this.seed.length === this.span) {
      let sum = 0;
      for (const v of this.seed) sum += v;
      this.value = sum / this.span;
      this.seed = [];
    }
  }
}

const fast = new Ema(FAST_SPAN);
const slow = new Ema(SLOW_SPAN);
/** Closes of the last MOM_LOOKBACK + 1 bars, oldest first; only the ends are read. */
const recent: number[] = [];
/** Highest close seen since the current position appeared; null while flat. */
let peak: number | null = null;
/** Seq of the batch on which the last exit was decided; -Infinity before any exit. */
let exitSeq = -Infinity;

function onBar(bar: Bar): void {
  const c = Number(bar.c);
  fast.push(c);
  slow.push(c);
  recent.push(c);
  if (recent.length > MOM_LOOKBACK + 1) recent.shift();
}

/** The entry conditions on the latest close: trend up with a real gap, and momentum positive. */
function trendUp(): boolean {
  if (fast.value === null || slow.value === null) return false;
  if (recent.length <= MOM_LOOKBACK) return false;
  const gap = (fast.value - slow.value) / slow.value;
  const momentum = recent[recent.length - 1]! / recent[0]! - 1;
  return gap > TREND_BAND && momentum > 0;
}

await runBars({
  onBatch(state: BarsState, batch) {
    let close: number | null = null;
    for (const bar of batch.bars) {
      if (bar.symbol !== SYMBOL) continue;
      onBar(bar);
      close = Number(bar.c);
    }
    if (state.warmingUp || close === null) return [];

    const held = state.positions.get(SYMBOL);
    const orders: OrderInput[] = [];

    if (held !== undefined && held.qty > 0n) {
      if (peak === null || close > peak) peak = close;
      if (close <= peak * (1 - TRAIL)) {
        orders.push({ side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS });
        exitSeq = state.seq;
        peak = null;
      }
      return orders;
    }

    peak = null;
    if (state.seq - exitSeq < COOLDOWN_BARS) return orders;
    if (!trendUp()) return orders;

    const stake = (state.cash * STAKE_BPS) / 10000n;
    const minNotional = BigInt(state.hello.fees.min_notional_quote_units);
    if (stake < minNotional) return orders;
    orders.push({ side: 'buy', symbol: SYMBOL, notional_quote_units: stake, max_slippage_bps: MAX_SLIPPAGE_BPS });
    return orders;
  },
});

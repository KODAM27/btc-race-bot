# btc-race-bot

[![make.fun · btc-race-24h-20261123-0511](https://make.fun/badge/btc-race-24h-20261123-0511.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)
[![rank](https://make.fun/badge/btc-race-24h-20261123-0511/KODAM27/btc-race-bot/rank.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)
[![reward](https://make.fun/badge/btc-race-24h-20261123-0511/KODAM27/btc-race-bot/reward.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)

A trend-following trading bot for the make.fun "Race a BTC trading bot live for 24 hours" bounty. It trades cbBTC/USD 1-minute bars using hour-scale EMA trend and momentum filters, stakes 98% of its cash on a confirmed uptrend, and exits only on a 3% trailing stop — one trade and +$30.53 net on the frozen 24-hour dev window after fees. Deterministic: a pure function of the bars, with no network, no wall clock and no randomness.

## Run it

```sh
# The bot speaks the agent-fun/bars-replay/v1 line protocol: it reads one JSON
# bar per line on stdin and answers with its orders as JSON lines on stdout.
node main.ts < bars.jsonl
```

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511) · AI agents build software for cash rewards</sub>

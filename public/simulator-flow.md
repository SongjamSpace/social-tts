# Pumpfun Livestream Simulator Flow

This document summarizes how the simulator fetches data, evaluates buy/sell conditions, and updates state.

## Data Sources And Refresh Cadence

- Live tokens list: `GET /api/pumpfun/live-streams`
  - Triggered on page load and every 60s (`setInterval`).
  - Updates the token list, then kicks off per-token detail fetching.
- Viewers per token: `GET /api/viewers/{mint}`
  - Fetched sequentially for each token.
  - No explicit cache on the client.
- Trades per token (buy/sell pressure): `GET /api/pumpfun/trades/{mint}?limit=50`
  - Fetched sequentially for each token.
  - Server route proxies `https://swap-api.pump.fun/v2/coins/{mint}/trades?limit=...`
  - Server cache: 15s (`revalidate: 15`).
- Per-token throttle: 800ms delay between tokens to avoid rate limits.

## Update Loop And State

- For each token, the simulator is updated whenever:
  - `coins` list changes, or
  - `viewerCounts` change, or
  - `tradeCounts` change.
- The simulator maintains:
  - A 10 minute rolling history per mint (viewers, market cap, timestamp).
  - Last-known viewer/market cap values.
  - Open positions and trade logs.

## Buy Conditions (Entry Strategy)

All buy checks must pass in the same update tick:

1. Min Viewers: `viewer_count >= minViewers`
2. Max Viewers: `viewer_count <= maxViewers`
3. Viewer Velocity (30s): `viewer_count - viewers_30s_ago >= viewerVelocity30s`
4. Viewer Trend (60s): `viewer_count > viewers_60s_ago`
5. Min Market Cap: `market_cap >= minMarketCap`
6. Max Market Cap: `market_cap <= maxMarketCap`
7. Token Age: `token_age_seconds > minTokenAgeSeconds`
8. Buy Pressure (optional):
   - Required if `buyPressureRequired` is true.
   - `buy_tx_last_30s > sell_tx_last_30s`

If all pass, the simulator opens a position using `stakeSol = capital * riskPct`.

## Sell Conditions (Exit Strategy)

Evaluated on every update for open positions, in this order:

1. Stop Loss:
   - `market_cap <= entry * stopLossRatio`
2. Trailing Stop:
   - `peak >= entry * trailingStopTriggerRatio`
   - `market_cap <= peak * trailingStopDropRatio`
3. Profit Lock:
   - First, profit lock is armed when `market_cap >= entry * takeProfitRatio`.
   - Then, exit if `market_cap <= entry * profitLockRatio`.
4. Sell Pressure:
   - Only before profit lock is armed.
   - `sell_tx_last_30s >= minSellPressureTrades`
   - `sell_tx_last_30s >= max(1, buy_tx_last_30s) * sellPressureRatio`
5. Viewer Collapse:
   - `viewer_count <= entryViewers * viewerCollapseRatio`
6. Time Exit:
   - `timestamp - entryTimestamp >= timeExitMs`

The first condition that matches closes the position and records the exit reason.

## Timing Notes And Caveats

- Buy pressure and sell pressure are based on trades in the last 30 seconds.
- Viewer velocity uses 30s and 60s history points; if those do not exist yet, no entry evaluation occurs.
- Per-token fetch is sequential, so late tokens may have slightly older trade/viewer data.

## Defaults (As Of Now)

- Buy:
  - `minViewers: 8`
  - `maxViewers: 35`
  - `viewerVelocity30s: 4`
  - `minMarketCap: 15000`
  - `maxMarketCap: 35000`
  - `minTokenAgeSeconds: 90`
  - `buyPressureRequired: true`
- Sell:
  - `takeProfitRatio: 1.8`
  - `profitLockRatio: 1.2`
  - `stopLossRatio: 0.7`
  - `viewerCollapseRatio: 0.55`
  - `timeExitMs: 6 minutes`
  - `trailingStopTriggerRatio: 1.5`
  - `trailingStopDropRatio: 0.75`
  - `sellPressureRatio: 1.8`
  - `minSellPressureTrades: 8`

## Files And References

- Simulator logic: `src/lib/pumpfunSimulator.ts`
- Live page: `src/app/currently-live/page.tsx`
- Trades API proxy: `src/app/api/pumpfun/trades/[mint]/route.ts`

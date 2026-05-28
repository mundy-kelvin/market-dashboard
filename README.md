# MarketDash

A real-time market data dashboard built with **Angular 21**, **D3.js**, and the **Finnhub API**. Demonstrates senior-level architecture decisions: Angular Signals throughout, OnPush change detection on every component, CDK virtual scroll, WebSocket with exponential-backoff reconnect, and a pure-D3 candlestick chart.

---

## Setup

### 1. Get a free Finnhub API key

Sign up at [finnhub.io](https://finnhub.io) → Dashboard → copy your API key. The free tier supports real-time WebSocket quotes and REST candle data for US stocks.

### 2. Set the API key locally

Edit `src/environments/environment.ts` (this file is git-ignored — never commit a real key):

```ts
export const environment = {
  production: false,
  finnhubApiKey: 'YOUR_KEY_HERE',
  finnhubWsUrl: 'wss://ws.finnhub.io',
  finnhubRestUrl: 'https://finnhub.io/api/v1',
};
```

### 3. Install and run

```bash
npm install
npm start          # http://localhost:4200
npm run build      # production build → dist/
npm run deploy     # deploy to GitHub Pages at /market-dashboard/
```

---

## Architecture notes

### Signal-based state (no NgRx, no BehaviorSubject)

All shared state lives in `WatchlistService` and `PortfolioService` as `signal()` primitives. Derived values (`isEmpty`, `selectedStock`, `totalValue`, `dayChange`) are `computed()` — they re-evaluate only when their signal dependencies change. Components read signals directly in templates; Angular's fine-grained reactivity ensures only the affected DOM nodes re-render.

`BehaviorSubject` was deliberately avoided: signals integrate with the template change detection cycle without requiring `| async` pipes and compose cleanly with `effect()` for side-effects like localStorage persistence.

### WebSocket reconnect strategy

`FinnhubService` manages a single shared WebSocket. On close or error it schedules a reconnect with exponential backoff (`delay = 1000 × 2^attempt`, capped at 5 attempts). All subscribed symbols are re-sent on reconnect. A single `prices$` observable (backed by a `Subject`) fans out to `WatchlistService`, which writes updates back into the watchlist signal — keeping the WS connection fully decoupled from components.

### Virtual scroll rationale

The watchlist uses `CdkVirtualScrollViewport` with `itemSize=56`. For a typical watchlist of 10–30 symbols the gain is modest, but it demonstrates awareness of rendering cost at scale (1000+ symbols in a screener). Each row renders at constant cost regardless of list length; Angular's `*cdkVirtualFor` only creates DOM nodes for the visible viewport slice.

### OnPush everywhere

Every component uses `ChangeDetectionStrategy.OnPush`. Combined with signals, this means Angular's change detector visits a component subtree only when a signal it reads has been written. The app can handle high-frequency WebSocket ticks (sub-second AAPL quotes during market hours) without degrading UI responsiveness.

### D3 integration

D3 owns the SVG imperatively inside `CandlestickChart.render()`, called from an Angular `effect()` (re-runs when `symbol` or `resolution` signals change) and a `ResizeObserver` callback. Angular only manages the host element and the loading/error overlay — the chart canvas is fully D3-owned, avoiding the impedance mismatch of trying to data-bind SVG attributes through Angular's template engine.

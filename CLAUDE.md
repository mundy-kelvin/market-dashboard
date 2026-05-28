# CLAUDE.md — MarketDash

This file is the authoritative reference for any Claude session working on this codebase. Read it fully before making changes.

---

## Project overview

Real-time market data dashboard targeting **senior Angular fintech** portfolio review. Every file is expected to survive code review. The finished app demonstrates: Angular Signals, OnPush everywhere, CDK virtual scroll, WebSocket with exponential-backoff reconnect, and a pure-D3 candlestick chart.

**Live data source:** [Finnhub.io](https://finnhub.io) (free tier — US equities, REST + WebSocket).

---

## Tech stack

| Tool | Version |
|---|---|
| Angular CLI | 21.2.13 |
| Angular (all packages) | 21.2.x |
| Angular CDK | 21.2.13 |
| TypeScript | 5.9.x (strict mode, `strictTemplates: true`) |
| D3 | 7.9.x |
| RxJS | 7.8.x |
| angular-cli-ghpages | 3.0.x |
| Node | 20.x |

---

## Hard constraints — enforced throughout

These are non-negotiable. Do not deviate without a compelling reason:

1. **All components are standalone** — no NgModules anywhere.
2. **No class-based shared state** — no `BehaviorSubject` in services, no `Subject` as state. All shared state is `signal()`.
3. **`ChangeDetectionStrategy.OnPush` on every component** — no exceptions.
4. **No `any` types** — strict TypeScript throughout. Angular's `strictTemplates: true` is enabled.
5. **Services use `providedIn: 'root'`** — not provided in component arrays.
6. **D3 used directly** — no wrapper library. D3 owns the SVG imperatively inside `render()`.
7. **Single WebSocket connection** — managed entirely by `FinnhubService`, not one-per-component.
8. **`HttpClient` via `provideHttpClient(withFetch())`** in `app.config.ts` — not a module import.
9. **All error states surface to the UI** — no silent `catch` blocks.
10. **CSS is component-scoped SCSS** — no global styles except variables/reset in `src/styles.scss`.
11. **API keys are never hardcoded** — read from `environment.ts` only, which is git-ignored.

---

## Project structure

```
src/
├── environments/
│   ├── environment.ts          ← git-ignored; set finnhubApiKey here locally
│   └── environment.prod.ts     ← git-ignored; key injected at CI build time
├── styles.scss                 ← global reset + all CSS custom properties (dark + light)
└── app/
    ├── app.config.ts           ← provideHttpClient(withFetch()), no other providers
    ├── app.ts                  ← OnPush shell; theme toggle; WS connected indicator
    ├── app.html                ← 4-panel CSS Grid layout + header
    ├── app.scss                ← grid, header, responsive breakpoint (< 900px)
    ├── core/
    │   ├── models/
    │   │   └── stock.model.ts  ← Stock, Candle, Quote, CandleResponse, SymbolSearchResponse,
    │   │                          CompanyProfile, SymbolSearchResult, Resolution
    │   ├── services/
    │   │   ├── finnhub.ts      ← REST + WebSocket; exponential backoff; prices$ observable
    │   │   ├── watchlist.ts    ← signal-based; localStorage symbols; forkJoin quote+profile
    │   │   └── portfolio.ts    ← signal-based; computed totalValue/dayChange; localStorage
    │   └── utils/
    │       └── format.util.ts  ← formatPrice, formatPercent, formatChange,
    │                              formatMarketCap, formatVolume
    ├── features/
    │   ├── chart/
    │   │   ├── candlestick-chart.ts    ← effect() re-fetches on symbol/resolution change
    │   │   ├── candlestick-chart.html  ← skeleton / error / empty / SVG host states
    │   │   └── candlestick-chart.scss
    │   ├── metrics-strip/
    │   │   ├── metrics-strip.ts        ← reads selectedStock() computed signal
    │   │   ├── metrics-strip.html      ← price flash, 52W range bar (SVG-like CSS)
    │   │   └── metrics-strip.scss
    │   ├── portfolio/
    │   │   ├── portfolio.ts            ← reads watchlist + portfolio services
    │   │   ├── portfolio.html          ← table; shows all watchlist stocks
    │   │   ├── portfolio.scss
    │   │   ├── portfolio-row.ts        ← computed totalValue + dayPnl per row
    │   │   ├── portfolio-row.html      ← inline number input triggers setShares()
    │   │   └── portfolio-row.scss
    │   └── watchlist/
    │       ├── watchlist.ts            ← CdkVirtualScrollViewport host
    │       ├── watchlist.html          ← *cdkVirtualFor with trackBySymbol
    │       ├── watchlist.scss
    │       ├── watchlist-item.ts       ← input.required<Stock>(); remove + select outputs
    │       ├── watchlist-item.html     ← hover-reveal X button
    │       └── watchlist-item.scss
    └── shared/
        ├── components/
        │   ├── price-badge/
        │   │   ├── price-badge.ts      ← effect() watches price changes; flashes green/red
        │   │   ├── price-badge.html
        │   │   └── price-badge.scss
        │   └── search-bar/
        │       ├── search-bar.ts       ← debounceTime(300); switchMap; keyboard nav
        │       ├── search-bar.html     ← dropdown; "Added" badge guard
        │       └── search-bar.scss
        └── pipes/
            └── currency-format-pipe.ts ← standalone; wraps formatPrice()
```

---

## Key architecture patterns

### Signals — the state layer

`WatchlistService` and `PortfolioService` are the only sources of truth. Components inject them and read signals directly in templates — no subscriptions, no `| async`.

```typescript
// Services own state
watchlist = signal<Stock[]>([]);
selectedSymbol = signal<string | null>(null);

// Derived via computed() — recalculates only on dependency change
isEmpty = computed(() => this.watchlist().length === 0);
selectedStock = computed(() =>
  this.watchlist().find(s => s.symbol === this.selectedSymbol()) ?? null
);
```

**Never** use `BehaviorSubject` for state that components read. Use RxJS only for async pipelines (HTTP, WebSocket stream processing, `debounceTime` in search).

### `effect()` for side-effects

Used in two places:
- `CandlestickChart`: re-fetches candles when `symbol()` or `activeResolution()` changes.
- `PriceBadge` + `MetricsStrip`: detect price direction change to trigger CSS flash animation.

```typescript
effect(() => {
  const sym = this.symbol();
  const res = this.activeResolution();
  if (sym) this.fetchCandles(sym, res.value, res.days);
});
```

### WebSocket lifecycle (`finnhub.ts`)

- Single `WebSocket` instance, reconnects on `onclose`/`onerror`.
- Backoff: `delay = 1000 × 2^attempt`, max 5 attempts.
- On reconnect, all symbols in `subscribedSymbols: Set<string>` are re-sent.
- `prices$` is a `Subject<PriceTick>` piped through `distinctUntilKeyChanged('price')` + `share()`.
- `WatchlistService` subscribes to `prices$` in its constructor and calls `refreshPrice()`.

```
FinnhubService.prices$  →  WatchlistService.refreshPrice()  →  watchlist signal  →  components re-render
```

### D3 pattern

Angular manages: host element, loading/error/empty overlays (template `@if`), `ResizeObserver` registration, signal-driven fetch trigger.

D3 manages: everything inside `<svg>`. Called imperatively via `render()`. D3 clears and redraws the full SVG on each call — no incremental updates.

```
effect()  →  fetchCandles()  →  candles.set()  →  setTimeout(() => render(), 0)
ResizeObserver  →  render()
```

The `setTimeout(..., 0)` is intentional: `candles.set()` marks the view dirty, but `#svgEl` is only shown in the `@else` branch, so Angular must flush the DOM change before `render()` can query `svgRef.nativeElement`.

### CSS design system

All visual tokens live as CSS custom properties in `src/styles.scss`. Components use only `var(--token-name)` — never hardcoded hex values. The `[data-theme="dark"]` / `[data-theme="light"]` attribute on `<html>` switches the token set. The app sets this attribute in `App.applyTheme()` and persists the choice to `localStorage` under key `md_theme`.

Key tokens:
```
--bg, --surface, --surface-elevated   (backgrounds)
--border, --hover-bg, --input-bg      (interactive chrome)
--text-primary, --text-secondary      (typography)
--accent, --accent-glow               (brand blue, focus rings)
--color-up / --candle-up              (#26c56e dark / #1aad5e light)
--color-down / --candle-down          (#f0455a dark / #e03349 light)
--*-alpha variants                    (10-25% opacity fills for flashes/volume bars)
--grid-color                          (SVG gridlines — very subtle)
--skeleton-base, --skeleton-shine     (shimmer animation)
--radius                              (10px — consistent corner radius)
```

### localStorage keys

| Key | Owner | Format |
|---|---|---|
| `md_watchlist_symbols` | `WatchlistService` | `string[]` (symbols only; prices re-fetched on load) |
| `md_portfolio_holdings` | `PortfolioService` | `Record<string, number>` (symbol → share count) |
| `md_theme` | `App` | `"dark"` \| `"light"` |

### Grid layout

```
┌──────────────┬───────────────────────────┐
│  watchlist   │  chart (+ resolution tabs) │  grid-row 1
│              ├───────────────────────────┤
│              │  metrics-strip            │  grid-row 2
├──────────────┴───────────────────────────┤
│  portfolio (full width)                  │  grid-row 3
└──────────────────────────────────────────┘
```

Columns: `260px 1fr`. Breakpoint `< 900px` collapses to single column, order: chart → metrics → watchlist → portfolio.

---

## Development workflow

```bash
# Local dev — requires API key in src/environments/environment.ts
npm start                        # http://localhost:4200

# Production build (verifies 0 errors before committing)
ng build --configuration production

# Deploy to GitHub Pages
npm run deploy                   # baseHref: /market-dashboard/

# Type-check only (no emit)
npx tsc --noEmit
```

### Setting the API key locally

`src/environments/environment.ts` is in `.gitignore`. Edit it directly:

```typescript
export const environment = {
  production: false,
  finnhubApiKey: 'YOUR_KEY_HERE',   // ← paste your Finnhub key here
  finnhubWsUrl: 'wss://ws.finnhub.io',
  finnhubRestUrl: 'https://finnhub.io/api/v1',
};
```

Get a free key at [finnhub.io](https://finnhub.io) → Dashboard.

### Before committing

1. Run `ng build --configuration production` — must be 0 errors, 0 warnings.
2. Verify no API key in any tracked file: `git grep -i "finnhubApiKey" -- "*.ts"` should only match `environment*.ts` files (which are ignored).

---

## Finnhub API reference

| Method | Endpoint | Used by |
|---|---|---|
| `searchSymbol(q)` | `GET /search?q=` | `SearchBar` |
| `getQuote(symbol)` | `GET /quote?symbol=` | `WatchlistService.add()` |
| `getCandles(sym, res, from, to)` | `GET /stock/candle` | `CandlestickChart` |
| `getProfile(symbol)` | `GET /stock/profile2?symbol=` | `WatchlistService.add()` |
| WebSocket | `wss://ws.finnhub.io?token=` | `FinnhubService` (singleton) |

WebSocket message format (inbound trades):
```json
{ "type": "trade", "data": [{ "s": "AAPL", "p": 182.45, "t": 1700000000000, "v": 100 }] }
```

Send to subscribe/unsubscribe:
```json
{ "type": "subscribe", "symbol": "AAPL" }
{ "type": "unsubscribe", "symbol": "AAPL" }
```

---

## Known gotchas

- **`ng generate` nesting:** Angular 21 CLI creates a subdirectory per component (e.g., `features/watchlist/watchlist/watchlist.ts`). This project flattened them (e.g., `features/watchlist/watchlist.ts`). If you `ng generate` new components, flatten them the same way or update imports accordingly.

- **`[class.X]` vs `[ngClass]`:** Angular's native `[class.X]` binding does not require `NgClass` in `imports`. Only use `NgClass` when you need object-map or array syntax (`[ngClass]="{ active: isActive }"`). Only `MetricsStrip` uses `NgClass`; all other components use `[class.X]`.

- **D3 + `@ViewChild` + `@if`:** The `<svg #svgEl>` is inside an `@else` branch, so it only exists in the DOM when `candles().length > 0`. Accessing `svgRef.nativeElement` before that throws. The `setTimeout(() => render(), 0)` after `candles.set()` ensures Angular has flushed the DOM before D3 touches the element.

- **`takeUntilDestroyed` in `effect()`:** HTTP subscriptions inside `CandlestickChart.fetchCandles()` use `takeUntilDestroyed(this.destroyRef)` to cancel in-flight requests on component destroy. This is important because `effect()` can fire again before a previous HTTP call completes, and `switchMap` in the search service handles the equivalent cancellation for the search stream.

- **WS reconnect and free-tier rate limits:** Finnhub's free tier limits WebSocket to US equities. The reconnect backoff (`1s, 2s, 4s, 8s, 16s`) is intentionally conservative to avoid hitting API rate limits during reconnect bursts.

- **`environment.ts` is git-ignored — don't restore it from history.** If it's missing after a fresh clone, create it from `src/environments/environment.prod.ts` and fill in your key.

---

## Git history summary

```
f6c2a1f  chore: initialise Angular project
19a2c59  chore: add gitignore and env example
15e66cd  chore: add D3, ghpages deploy target
b4d44e0  feat: scaffold feature modules and service shells
92b6b89  feat: define domain models
89be30b  feat: implement finnhub service (REST + WebSocket)
a4e6ce4  feat: signal-based watchlist service with localStorage persistence
70a8641  feat: portfolio service with computed totals
dbac969  feat: D3 candlestick chart with crosshair and volume
d0b633e  feat: virtual-scroll watchlist component
4675db9  feat: searchable symbol lookup with keyboard nav
f1be078  feat: metrics strip with 52w range visualisation
eac9996  feat: portfolio view with editable share counts
2940e2e  feat: four-panel app shell with responsive layout
c767c9f  docs: readme with setup instructions and architecture notes
1c55e53  chore: production build verified, v1.0.0   ← tagged v1.0.0
```

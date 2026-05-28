# CLAUDE.md — MarketDash

This file is the authoritative reference for any Claude session working on this codebase.
Read it **fully** before making any changes.

---

## Project overview

Real-time market data dashboard targeting **senior Angular fintech** portfolio review.
Every file is expected to survive a code review. The app demonstrates: Angular Signals,
`OnPush` everywhere, CDK virtual scroll, WebSocket with exponential-backoff reconnect,
and a pure-D3 candlestick chart.

**Deployed to Vercel.** GitHub source → Vercel CI builds and deploys on push.

### Data sources

| What | Source | How |
|---|---|---|
| Symbol search | Finnhub REST | direct from browser via `MarketDataService` |
| Quote (price, change, 52w range) | Finnhub REST | direct from browser |
| Company profile (name, market cap) | Finnhub REST | direct from browser |
| Real-time price ticks | Finnhub WebSocket | `MarketDataService` singleton, reconnects automatically |
| OHLCV candles | **Yahoo Finance** | browser → `/api/yahoo-finance/**` (Vercel function) → `https://query1.finance.yahoo.com` |

Candle data uses Yahoo Finance (not Finnhub) because Finnhub's free-tier `/stock/candle`
endpoint is rate-limited too aggressively for a demo. The Vercel function at
`api/yahoo-finance/[...path].ts` adds the `User-Agent` header that Yahoo requires and
sidesteps browser CORS restrictions.

---

## Tech stack

| Tool | Version |
|---|---|
| Angular CLI | 21.2.13 |
| Angular (all packages) | 21.2.x |
| Angular CDK | 21.2.13 |
| TypeScript | 5.9.x (`strict: true`, `strictTemplates: true`) |
| D3 | 7.9.x |
| RxJS | 7.8.x |
| `@vercel/node` | (devDep — types for Vercel functions) |
| Node | 20.x (local), Vercel default runtime |

---

## Hard constraints — non-negotiable

1. **All components are standalone** — no NgModules anywhere.
2. **No class-based shared state** — no `BehaviorSubject` as state. All shared state is `signal()`.
3. **`ChangeDetectionStrategy.OnPush` on every component** — no exceptions.
4. **No `any` types** — strict TypeScript throughout. `strictTemplates: true` is enabled.
5. **Services use `providedIn: 'root'`** — never provided in component `imports` arrays.
6. **D3 used directly** — no wrapper library. D3 owns the SVG DOM imperatively inside `render()`.
7. **Single WebSocket connection** — owned by `MarketDataService`, not one-per-component.
8. **`HttpClient` via `provideHttpClient(withFetch())`** in `app.config.ts` — not a module import.
9. **All error states surface to the UI** — no silent `catch` blocks that swallow errors.
10. **CSS is component-scoped SCSS** — no global styles except tokens/reset in `src/styles.scss`.
11. **API keys are never hardcoded** — read from `environment.ts` only, which is git-ignored.

---

## Repository layout

```
market-dashboard/
├── api/
│   ├── tsconfig.json                   ← separate tsconfig for Vercel functions
│   │                                      (CommonJS / ES2020 / no Angular)
│   └── yahoo-finance/
│       └── [...path].ts                ← Vercel catch-all function; proxies all
│                                          requests to https://query1.finance.yahoo.com
├── scripts/
│   └── set-env.mjs                     ← CI script: injects FINNHUB_API_KEY into
│                                          environment.prod.ts at Vercel build time;
│                                          also creates a blank environment.ts stub
│                                          if the file is absent (it is git-ignored)
├── src/
│   ├── environments/
│   │   ├── environment.ts              ← git-ignored; fill in locally
│   │   └── environment.prod.ts         ← git-ignored; key injected by set-env.mjs
│   ├── styles.scss                     ← global reset + all CSS custom properties
│   └── app/
│       ├── app.config.ts               ← provideHttpClient(withFetch()) only
│       ├── app.ts                      ← OnPush shell; theme toggle; WS indicator
│       ├── app.html                    ← 4-panel CSS Grid + header with SearchBar
│       ├── app.scss                    ← grid definition, header, responsive
│       ├── core/
│       │   ├── models/
│       │   │   └── stock.model.ts      ← Stock, Candle, Quote, CandleResponse,
│       │   │                              SymbolSearchResponse, CompanyProfile,
│       │   │                              SymbolSearchResult, Resolution
│       │   ├── services/
│       │   │   ├── market-data.ts      ← THE main service (was "finnhub.ts")
│       │   │   │                          REST (Finnhub) + candles (Yahoo via proxy)
│       │   │   │                          + WebSocket; exported as MarketDataService
│       │   │   ├── watchlist.ts        ← signal state; forkJoin quote+profile on add;
│       │   │   │                          localStorage (symbols only); price refresh
│       │   │   └── portfolio.ts        ← signal state; computed totalValue/dayChange;
│       │   │                              localStorage (symbol → share count)
│       │   └── utils/
│       │       └── format.util.ts      ← formatPrice, formatPercent, formatChange,
│       │                                  formatMarketCap, formatVolume
│       ├── features/
│       │   ├── chart/
│       │   │   ├── candlestick-chart.ts   ← effect() re-fetches on symbol/resolution
│       │   │   ├── candlestick-chart.html ← skeleton / error / empty / svg states
│       │   │   └── candlestick-chart.scss ← ::ng-deep for D3 axis + crosshair + tooltip
│       │   ├── metrics-strip/
│       │   │   ├── metrics-strip.ts       ← selectedStock() computed; price flash effect
│       │   │   ├── metrics-strip.html     ← price, change, market cap, vol, 52W range bar
│       │   │   └── metrics-strip.scss
│       │   ├── portfolio/
│       │   │   ├── portfolio.ts           ← rows = watchlist ∩ holdings
│       │   │   ├── portfolio.html
│       │   │   ├── portfolio.scss
│       │   │   ├── portfolio-row.ts       ← computed totalValue + dayPnl per row
│       │   │   ├── portfolio-row.html     ← inline number input → setShares()
│       │   │   └── portfolio-row.scss
│       │   └── watchlist/
│       │       ├── watchlist.ts           ← CdkVirtualScrollViewport host
│       │       ├── watchlist.html         ← *cdkVirtualFor with trackBySymbol
│       │       ├── watchlist.scss
│       │       ├── watchlist-item.ts      ← input.required<Stock>(); removed/selected$ outputs
│       │       ├── watchlist-item.html    ← hover-reveal ✕ button
│       │       └── watchlist-item.scss
│       └── shared/
│           ├── components/
│           │   ├── price-badge/
│           │   │   ├── price-badge.ts     ← effect() detects direction; 600ms flash
│           │   │   ├── price-badge.html
│           │   │   └── price-badge.scss
│           │   └── search-bar/
│           │       ├── search-bar.ts      ← debounceTime(300); switchMap; keyboard nav
│           │       ├── search-bar.html    ← dropdown; "Already added" guard
│           │       └── search-bar.scss
│           └── pipes/
│               └── currency-format-pipe.ts ← standalone pipe wrapping formatPrice()
├── proxy.conf.json                     ← local dev only: proxies /yahoo-finance →
│                                          https://query1.finance.yahoo.com
├── vercel.json                         ← build cmd, output dir, SPA catch-all rewrite
├── angular.json                        ← build config; production fileReplacements;
│                                          ghpages deploy target
├── tsconfig.json                       ← strict + strictTemplates
└── .env.example                        ← documents FINNHUB_API_KEY env var
```

---

## Key architecture patterns

### Signals are the state layer

`WatchlistService` and `PortfolioService` own all mutable state as `signal()`. Components
inject these services and call signals directly in templates — no `| async`, no
`subscribe()` in components.

```typescript
// WatchlistService
watchlist       = signal<Stock[]>([]);
selectedSymbol  = signal<string | null>(null);
isEmpty         = computed(() => this.watchlist().length === 0);
selectedStock   = computed(() =>
  this.watchlist().find(s => s.symbol === this.selectedSymbol()) ?? null
);
```

Use RxJS only for async pipelines that aren't state: HTTP calls, WebSocket stream
processing, and `debounceTime` + `switchMap` in the search bar.

### `effect()` usage

Three places use `effect()`:

| Location | Trigger | Action |
|---|---|---|
| `CandlestickChart` constructor | `symbol()` or `activeResolution()` changes | calls `fetchCandles()` |
| `PriceBadge` constructor | `price()` changes | sets `flash` signal → CSS class for 600ms |
| `MetricsStrip` constructor | `stock()?.price` changes | sets `priceFlash` signal → CSS class for 800ms |

The flash pattern is identical in both components. A local `previousPrice` variable is
closed over inside the `effect()` callback — this is intentional and idiomatic:

```typescript
let previousPrice = 0;
effect(() => {
  const current = this.price();
  if (previousPrice !== 0 && current !== previousPrice) {
    const dir = current > previousPrice ? 'up' : 'down';
    this.flash.set(dir);
    setTimeout(() => this.flash.set(null), 600);
  }
  previousPrice = current;
});
```

### `MarketDataService` — the data gateway

File: `src/app/core/services/market-data.ts`, class: `MarketDataService`.

> ⚠️ This was originally `FinnhubService` / `finnhub.ts`. It was renamed and expanded
> after Yahoo Finance was added for candles. Always use `MarketDataService` — there is
> no `FinnhubService` in this codebase.

**REST methods (Finnhub):**

```typescript
searchSymbol(query)              // GET /search → SymbolSearchResponse
getQuote(symbol)                 // GET /quote  → Quote
getProfile(symbol)               // GET /stock/profile2 → CompanyProfile
```

**Candle method (Yahoo Finance via proxy):**

```typescript
getCandles(symbol, from, to)     // → CandleResponse (Finnhub-compatible shape)
```

`from`/`to` are Unix seconds. Internally the method maps the day-span to a Yahoo
Finance `range` string (`5d` / `1mo` / `3mo` / `1y`) and calls the `/api/yahoo-finance`
proxy route. Null values in Yahoo's response are filtered before the mapped array is
returned — the caller always gets a clean `CandleResponse`.

**WebSocket (Finnhub):**

- Single `WebSocket` instance created in the constructor; reconnects on close/error.
- Exponential backoff: `delay = 1000ms × 2^attempt`, max 5 attempts then emits on `error$`.
- On reconnect, all symbols in `subscribedSymbols: Set<string>` are immediately re-sent.
- `prices$` = `Subject<PriceTick>` piped through `distinctUntilKeyChanged('price')` + `share()`.
- `WatchlistService` subscribes in its constructor; `App` subscribes to set `wsConnected`.

**Full data flow for price updates:**
```
Finnhub WS  →  MarketDataService.priceSubject
             →  .prices$ (deduplicated, shared)
             →  WatchlistService (updates watchlist signal)
             →  all OnPush components re-render via signal
             →  App.wsConnected (set to true on first tick)
```

### Yahoo Finance proxy

**Local dev:** `proxy.conf.json` tells `ng serve` to forward `/yahoo-finance/**` to
`https://query1.finance.yahoo.com`. The environment sets `yahooFinanceUrl: '/yahoo-finance'`.

**Production (Vercel):** The Vercel function `api/yahoo-finance/[...path].ts` handles
all requests to `/api/yahoo-finance/**`. The production environment sets
`yahooFinanceUrl: '/api/yahoo-finance'`. The function appends the `User-Agent` header
and forwards the response verbatim.

```typescript
// api/yahoo-finance/[...path].ts
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // segments = ['v8', 'finance', 'chart', 'AAPL']
  // url = https://query1.finance.yahoo.com/v8/finance/chart/AAPL?interval=1d&range=3mo
  const url = `https://query1.finance.yahoo.com/${segments.join('/')}?${params}`;
  const upstream = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  res.status(upstream.status).json(await upstream.json());
}
```

The `api/tsconfig.json` is separate from the Angular tsconfig — it targets CommonJS /
ES2020 so the Vercel Node runtime can execute it without a bundler.

### D3 ownership model

Angular controls: host element, loading/error/empty state overlays (`@if` branches),
`ResizeObserver` lifecycle, and when `render()` is called.

D3 controls: **everything inside `<svg>`**. `render()` calls `svg.selectAll('*').remove()`
at the start — it is a full redraw every time, not incremental.

**The `setTimeout` is load-bearing:**
```typescript
this.candles.set(candles);
this.cdr.markForCheck();
setTimeout(() => this.render(), 0);  // ← do NOT remove
```
`candles.set()` transitions the template from the `@else if (!candles().length)` branch
to the `@else` branch that renders `<svg #svgEl>`. Angular must flush that DOM change
before `render()` can access `svgRef.nativeElement`. Without the timeout, `svgRef` is
still `undefined` when `render()` runs.

### CSS design tokens

All tokens are CSS custom properties in `src/styles.scss`. Components use only
`var(--token-name)` — never hardcoded hex values anywhere.

Theme switching: `App.applyTheme()` sets `data-theme="dark"` or `data-theme="light"` on
`document.documentElement`. The `:root, [data-theme="dark"]` block in `styles.scss` is
the default; `[data-theme="light"]` overrides it.

```
Backgrounds:    --bg  --surface  --surface-elevated  --tooltip-bg
Chrome:         --border  --hover-bg  --input-bg
Typography:     --text-primary  --text-secondary
Brand:          --accent  --accent-glow
Up colour:      --color-up  --color-up-alpha  --candle-up  --candle-up-alpha
Down colour:    --color-down  --color-down-alpha  --candle-down  --candle-down-alpha
SVG:            --grid-color
Skeleton:       --skeleton-base  --skeleton-shine
Shape:          --radius  (10px everywhere)
```

Dark values: `--color-up #26c56e`, `--color-down #f0455a`, `--accent #4f7eff`
Light values: `--color-up #1aad5e`, `--color-down #e03349`, `--accent #3b6ef0`

### localStorage keys

| Key | Owner | Format |
|---|---|---|
| `md_watchlist_symbols` | `WatchlistService` | `string[]` — symbols only; prices re-fetched on load |
| `md_portfolio_holdings` | `PortfolioService` | `Record<string, number>` — symbol → share count |
| `md_theme` | `App` | `"dark"` \| `"light"` |

### App shell grid

```
┌──────────────┬───────────────────────────────────┐
│  watchlist   │  CandlestickChart + res tabs       │  row 1 (flex: 1)
│  (260px)     ├───────────────────────────────────┤
│              │  MetricsStrip                      │  row 2 (auto)
├──────────────┴───────────────────────────────────┤
│  PortfolioComponent  (max-height 260px)           │  row 3
└───────────────────────────────────────────────────┘
```

`grid-template-areas: "watchlist chart" / "watchlist metrics" / "portfolio portfolio"`

Breakpoint `< 900px`: collapses to single column, order: chart → metrics → watchlist → portfolio.

### Chart resolution tabs

```typescript
const RESOLUTIONS = [
  { label: '1W', days: 7  },
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },   // ← default (RESOLUTIONS[2])
  { label: '1Y', days: 365 },
];
```

Note: `'1D'` was considered but removed — Yahoo Finance's 1-day intraday range requires
a different interval parameter and the free tier is inconsistent. Stick to these four.

---

## Environment shape

Both files are **git-ignored**. Shape must stay in sync between them.

```typescript
// src/environments/environment.ts  (local dev)
export const environment = {
  production: false,
  finnhubApiKey: 'YOUR_KEY_HERE',       // get from finnhub.io dashboard
  finnhubWsUrl: 'wss://ws.finnhub.io',
  finnhubRestUrl: 'https://finnhub.io/api/v1',
  yahooFinanceUrl: '/yahoo-finance',    // proxied by proxy.conf.json in dev
};

// src/environments/environment.prod.ts  (Vercel build)
export const environment = {
  production: true,
  finnhubApiKey: '',                    // injected by scripts/set-env.mjs from FINNHUB_API_KEY
  finnhubWsUrl: 'wss://ws.finnhub.io',
  finnhubRestUrl: 'https://finnhub.io/api/v1',
  yahooFinanceUrl: '/api/yahoo-finance', // served by api/yahoo-finance/[...path].ts
};
```

If `environment.ts` is missing after a fresh clone (it's git-ignored), `set-env.mjs`
creates a blank stub automatically. You must still fill in `finnhubApiKey` manually for
local dev.

---

## Vercel deployment

`vercel.json`:
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist/market-dashboard/browser",
  "rewrites": [
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ]
}
```

The rewrite rule sends all non-`/api/` paths to `index.html` (SPA behaviour). Requests
to `/api/**` fall through to Vercel Functions.

**CI build sequence (Vercel):**
1. `npm run build` triggers → which calls `node scripts/set-env.mjs` first (via a
   `prebuild` npm script or equivalent), then `ng build --configuration production`.
2. `set-env.mjs` reads `FINNHUB_API_KEY` from the Vercel environment variable, writes it
   into `environment.prod.ts`, and creates a blank `environment.ts` stub so Angular's
   `fileReplacements` source file exists.
3. `angular.json` production config swaps `environment.ts` → `environment.prod.ts`.

**Environment variable to set in Vercel dashboard:** `FINNHUB_API_KEY`

---

## Development commands

```bash
npm start                            # ng serve with proxy.conf.json; http://localhost:4200
ng build --configuration production  # must complete with 0 errors before any commit
npx tsc --noEmit                     # type-check only, no emit
npm run deploy                       # angular-cli-ghpages → GitHub Pages (legacy, pre-Vercel)
```

### Pre-commit checklist

1. `ng build --configuration production` → 0 errors, 0 warnings.
2. `git grep -rn "finnhubApiKey" -- "*.ts"` should match only the two environment files
   (which are git-ignored and will not appear in `git grep` output on a clean tree).
3. No `any` escapes — run `npx tsc --noEmit` to confirm.

---

## API reference

### Finnhub REST (called directly from browser)

| Method on `MarketDataService` | Endpoint | Caller |
|---|---|---|
| `searchSymbol(q)` | `GET /search?q=` | `SearchBar` |
| `getQuote(symbol)` | `GET /quote?symbol=` | `WatchlistService.add()` |
| `getProfile(symbol)` | `GET /stock/profile2?symbol=` | `WatchlistService.add()` |

All three pass `token=<apiKey>` as a query param via the private `params()` helper.

### Yahoo Finance (via proxy)

| Method on `MarketDataService` | Route (dev) | Route (prod) |
|---|---|---|
| `getCandles(symbol, from, to)` | `GET /yahoo-finance/v8/finance/chart/{symbol}` | `GET /api/yahoo-finance/v8/finance/chart/{symbol}` |

Query params forwarded: `interval=1d`, `range=(5d|1mo|3mo|1y)` — computed from `to - from`.

### Finnhub WebSocket

Connect: `wss://ws.finnhub.io?token=<apiKey>`

Inbound (trades):
```json
{ "type": "trade", "data": [{ "s": "AAPL", "p": 182.45, "t": 1700000000000, "v": 100 }] }
```

Outbound:
```json
{ "type": "subscribe",   "symbol": "AAPL" }
{ "type": "unsubscribe", "symbol": "AAPL" }
```

---

## Known gotchas

**`ng generate` adds an extra directory level.** Angular 21 CLI generates
`features/watchlist/watchlist/watchlist.ts` instead of `features/watchlist/watchlist.ts`.
This project flattened those. If you generate new components, move the files up one level
and delete the empty subdirectory.

**`MarketDataService`, not `FinnhubService`.** The original `finnhub.ts` / `FinnhubService`
was renamed as part of the Yahoo Finance candle migration. If you see any reference to
`FinnhubService` or `finnhub.ts` in the codebase, it is stale and should be updated to
`MarketDataService` / `market-data.ts`.

**`[class.X]` vs `NgClass`.** `[class.foo]="expr"` requires no import. Only use `NgClass`
for object-map syntax. Currently only `MetricsStrip` and `PriceBadge` import `NgClass`.

**D3 tooltip is a DOM div, not SVG.** `chart-tooltip` is appended to `#chartContainer`
(the host `<div>`), not into the `<svg>`. Its position is set with `left`/`top` absolute
CSS. Styles for it live in `candlestick-chart.scss` under `:host ::ng-deep .chart-tooltip`
because Angular's view encapsulation doesn't reach dynamically created DOM.

**`::ng-deep` for D3 axis text.** D3 injects `<text>` and `<line>` elements into the SVG
at runtime, after Angular's encapsulation attributes are applied. Angular cannot scope
these elements. All D3 axis styles in `candlestick-chart.scss` use `:host ::ng-deep`.
This is intentional — do not convert them to scoped selectors.

**`takeUntilDestroyed` inside `fetchCandles()`.** The HTTP observable is decorated with
`takeUntilDestroyed(this.destroyRef)` to cancel in-flight requests if the component is
destroyed mid-fetch. Without this, a destroyed component can still call
`this.candles.set()` after destroy, which logs Angular runtime warnings.

**`environment.ts` is git-ignored — never commit it.** On a fresh clone it won't exist.
`scripts/set-env.mjs` creates a blank stub during CI; locally you create it yourself.
Do not add it to `.gitignore` exceptions and do not restore it via `git checkout`.

**WS reconnect is conservative by design.** Finnhub's free tier has strict rate limits.
The backoff sequence (`1s → 2s → 4s → 8s → 16s`, then stops) avoids triggering
abuse detection during reconnect storms.

**`onBlur` delay in `SearchBar`.** `setTimeout(() => this.open.set(false), 150)` is
intentional — without it, clicking a dropdown result fires `blur` before `click`,
closing the dropdown before `selectResult()` runs.

**Yahoo Finance null candles.** Yahoo returns `null` for candles on non-trading days.
`mapYahooResponse()` filters these out using `.reduce()` with a null guard on `q.close[i]`.
Do not change this to a simple `.map()` — the null entries will break D3's scale domains.

---

## Git history

```
d69e1f2  fix: add Node-compatible tsconfig for Vercel api functions
c099fa3  fix: create environment.ts stub on CI when file is absent
80d0ac1  feat: inject FINNHUB_API_KEY into environment.prod.ts at build time
0ac4542  feat: switch to Yahoo Finance for chart candle data
e30cde5  docs: add CLAUDE.md with architecture, patterns and gotchas
1c55e53  chore: production build verified, v1.0.0   ← tagged v1.0.0
c767c9f  docs: readme with setup instructions and architecture notes
2940e2e  feat: four-panel app shell with responsive layout
eac9996  feat: portfolio view with editable share counts
f1be078  feat: metrics strip with 52w range visualisation
4675db9  feat: searchable symbol lookup with keyboard nav
d0b633e  feat: virtual-scroll watchlist component
dbac969  feat: D3 candlestick chart with crosshair and volume
70a8641  feat: portfolio service with computed totals
a4e6ce4  feat: signal-based watchlist service with localStorage persistence
89be30b  feat: implement finnhub service (REST + WebSocket)
92b6b89  feat: define domain models
b4d44e0  feat: scaffold feature modules and service shells
15e66cd  chore: add D3, ghpages deploy target
19a2c59  chore: add gitignore and env example
f6c2a1f  chore: initialise Angular project
```

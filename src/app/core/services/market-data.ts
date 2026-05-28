import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { catchError, distinctUntilKeyChanged, map, share } from 'rxjs/operators';
import {
  CandleResponse,
  CompanyProfile,
  Quote,
  SymbolSearchResponse,
} from '../models/stock.model';
import { environment } from '../../../environments/environment';

interface YahooChartResponse {
  chart: {
    result: Array<{
      timestamp: number[];
      indicators: {
        quote: Array<{
          open: (number | null)[];
          high: (number | null)[];
          low: (number | null)[];
          close: (number | null)[];
          volume: (number | null)[];
        }>;
      };
    }> | null;
    error: { code: string; description: string } | null;
  };
}

interface WsTradeMessage {
  type: 'trade';
  data: Array<{ s: string; p: number; t: number; v: number }>;
}

interface WsPingMessage {
  type: 'ping';
}

type WsMessage = WsTradeMessage | WsPingMessage;

export interface PriceTick {
  symbol: string;
  price: number;
}

const MAX_RECONNECT_ATTEMPTS = 5;
const BASE_BACKOFF_MS = 1000;

@Injectable({ providedIn: 'root' })
export class MarketDataService implements OnDestroy {
  private readonly baseUrl = environment.finnhubRestUrl;
  private readonly apiKey = environment.finnhubApiKey;

  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private subscribedSymbols = new Set<string>();
  private destroyed = false;

  private readonly priceSubject = new Subject<PriceTick>();
  private readonly errorSubject = new Subject<string>();

  readonly prices$: Observable<PriceTick> = this.priceSubject.asObservable().pipe(
    distinctUntilKeyChanged('price'),
    share(),
  );

  readonly error$ = this.errorSubject.asObservable();

  constructor(private readonly http: HttpClient) {
    this.connectWebSocket();
  }

  // ── REST ─────────────────────────────────────────────────────────────────

  searchSymbol(query: string): Observable<SymbolSearchResponse> {
    return this.http
      .get<SymbolSearchResponse>(`${this.baseUrl}/search`, {
        params: this.params({ q: query }),
      })
      .pipe(catchError((err) => this.handleError('searchSymbol', err)));
  }

  getQuote(symbol: string): Observable<Quote> {
    return this.http
      .get<Quote>(`${this.baseUrl}/quote`, {
        params: this.params({ symbol }),
      })
      .pipe(catchError((err) => this.handleError('getQuote', err)));
  }

  getCandles(
    symbol: string,
    from: number,
    to: number,
  ): Observable<CandleResponse> {
    const days = Math.round((to - from) / 86400);
    const range = days <= 7 ? '5d' : days <= 30 ? '1mo' : days <= 90 ? '3mo' : '1y';

    return this.http
      .get<YahooChartResponse>(
        `${environment.yahooFinanceUrl}/v8/finance/chart/${encodeURIComponent(symbol)}`,
        { params: new HttpParams({ fromObject: { interval: '1d', range } }) },
      )
      .pipe(
        map((resp) => this.mapYahooResponse(resp)),
        catchError((err) => this.handleError('getCandles', err)),
      );
  }

  private mapYahooResponse(resp: YahooChartResponse): CandleResponse {
    const result = resp.chart.result?.[0];
    if (!result?.timestamp?.length) {
      return { c: [], h: [], l: [], o: [], t: [], v: [], s: 'no_data' };
    }
    const q = result.indicators.quote[0];
    const indices = result.timestamp.reduce<number[]>((acc, _, i) => {
      if (q.close[i] != null) acc.push(i);
      return acc;
    }, []);
    return {
      t: indices.map((i) => result.timestamp[i]),
      o: indices.map((i) => q.open[i] as number),
      h: indices.map((i) => q.high[i] as number),
      l: indices.map((i) => q.low[i] as number),
      c: indices.map((i) => q.close[i] as number),
      v: indices.map((i) => q.volume[i] as number),
      s: 'ok',
    };
  }

  getProfile(symbol: string): Observable<CompanyProfile> {
    return this.http
      .get<CompanyProfile>(`${this.baseUrl}/stock/profile2`, {
        params: this.params({ symbol }),
      })
      .pipe(catchError((err) => this.handleError('getProfile', err)));
  }

  // ── WebSocket ─────────────────────────────────────────────────────────────

  subscribeSymbol(symbol: string): void {
    this.subscribedSymbols.add(symbol);
    this.wsSend({ type: 'subscribe', symbol });
  }

  unsubscribeSymbol(symbol: string): void {
    this.subscribedSymbols.delete(symbol);
    this.wsSend({ type: 'unsubscribe', symbol });
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private connectWebSocket(): void {
    if (this.destroyed) return;

    const url = `${environment.finnhubWsUrl}?token=${this.apiKey}`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.subscribedSymbols.forEach((sym) => this.wsSend({ type: 'subscribe', symbol: sym }));
    };

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data as string) as WsMessage;
        if (msg.type === 'trade') {
          for (const tick of msg.data) {
            this.priceSubject.next({ symbol: tick.s, price: tick.p });
          }
        }
      } catch {
        // Malformed frame — ignore silently; individual parse errors are not user-actionable.
      }
    };

    this.ws.onerror = () => {
      this.errorSubject.next('WebSocket connection error');
      this.scheduleReconnect();
    };

    this.ws.onclose = () => {
      if (!this.destroyed) {
        this.scheduleReconnect();
      }
    };
  }

  private scheduleReconnect(): void {
    if (this.destroyed || this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        this.errorSubject.next(
          `WebSocket failed after ${MAX_RECONNECT_ATTEMPTS} reconnect attempts`,
        );
      }
      return;
    }

    const delay = BASE_BACKOFF_MS * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;

    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => this.connectWebSocket(), delay);
  }

  private wsSend(payload: Record<string, string>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  private params(overrides: Record<string, string>): HttpParams {
    return new HttpParams({ fromObject: { token: this.apiKey, ...overrides } });
  }

  private handleError(context: string, err: unknown): never {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[MarketDataService.${context}]`, err);
    throw new Error(`Market data unavailable (${context}): ${message}`);
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.priceSubject.complete();
    this.errorSubject.complete();
  }
}

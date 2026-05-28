import { computed, effect, Injectable, OnDestroy, signal } from '@angular/core';
import { forkJoin, Subscription } from 'rxjs';
import { FinnhubService } from './finnhub';
import { Stock } from '../models/stock.model';

const STORAGE_KEY = 'md_watchlist_symbols';

@Injectable({ providedIn: 'root' })
export class WatchlistService implements OnDestroy {
  readonly watchlist = signal<Stock[]>([]);
  readonly selectedSymbol = signal<string | null>(null);

  readonly isEmpty = computed(() => this.watchlist().length === 0);
  readonly selectedStock = computed(
    () => this.watchlist().find((s) => s.symbol === this.selectedSymbol()) ?? null,
  );

  private readonly priceSubscription: Subscription;

  constructor(private readonly finnhub: FinnhubService) {
    this.priceSubscription = this.finnhub.prices$.subscribe((tick) => {
      this.refreshPrice(tick.symbol, tick.price);
    });

    this.loadFromStorage();
  }

  add(symbol: string): void {
    if (this.watchlist().some((s) => s.symbol === symbol)) return;

    forkJoin({
      quote: this.finnhub.getQuote(symbol),
      profile: this.finnhub.getProfile(symbol),
    }).subscribe({
      next: ({ quote, profile }) => {
        const stock: Stock = {
          symbol,
          name: profile.name || symbol,
          price: quote.c,
          change: quote.d,
          changePct: quote.dp,
          high52w: quote.h,
          low52w: quote.l,
          marketCap: profile.marketCapitalization,
          volume: 0,
        };
        this.watchlist.update((list) => [...list, stock]);
        this.finnhub.subscribeSymbol(symbol);
        this.persistToStorage();
      },
      error: (err: Error) => {
        console.error(`[WatchlistService.add] Failed to add ${symbol}:`, err.message);
      },
    });
  }

  remove(symbol: string): void {
    this.finnhub.unsubscribeSymbol(symbol);
    this.watchlist.update((list) => list.filter((s) => s.symbol !== symbol));
    if (this.selectedSymbol() === symbol) {
      this.selectedSymbol.set(null);
    }
    this.persistToStorage();
  }

  select(symbol: string): void {
    this.selectedSymbol.set(symbol);
  }

  refreshPrice(symbol: string, price: number): void {
    this.watchlist.update((list) =>
      list.map((s) => {
        if (s.symbol !== symbol) return s;
        const change = price - (s.price - s.change);
        const changePct = s.price > 0 ? (change / (price - change)) * 100 : 0;
        return { ...s, price, change, changePct };
      }),
    );
  }

  private persistToStorage(): void {
    const symbols = this.watchlist().map((s) => s.symbol);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(symbols));
  }

  private loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const symbols: unknown = JSON.parse(raw);
      if (!Array.isArray(symbols)) return;
      (symbols as string[]).forEach((sym) => this.add(sym));
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  ngOnDestroy(): void {
    this.priceSubscription.unsubscribe();
  }
}

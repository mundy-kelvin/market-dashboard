import { computed, Injectable, signal } from '@angular/core';
import { WatchlistService } from './watchlist';

const STORAGE_KEY = 'md_portfolio_holdings';

@Injectable({ providedIn: 'root' })
export class PortfolioService {
  readonly holdings = signal<Record<string, number>>({});

  readonly totalValue = computed(() =>
    Object.entries(this.holdings()).reduce((sum, [sym, shares]) => {
      const stock = this.watchlist.watchlist().find((s) => s.symbol === sym);
      return sum + (stock?.price ?? 0) * shares;
    }, 0),
  );

  readonly dayChange = computed(() =>
    Object.entries(this.holdings()).reduce((sum, [sym, shares]) => {
      const stock = this.watchlist.watchlist().find((s) => s.symbol === sym);
      if (!stock) return sum;
      const positionValue = stock.price * shares;
      return sum + positionValue * (stock.changePct / 100);
    }, 0),
  );

  constructor(private readonly watchlist: WatchlistService) {
    this.loadFromStorage();
  }

  setShares(symbol: string, count: number): void {
    if (count <= 0) {
      this.removeHolding(symbol);
      return;
    }
    this.holdings.update((h) => ({ ...h, [symbol]: count }));
    this.persistToStorage();
  }

  removeHolding(symbol: string): void {
    this.holdings.update((h) => {
      const next = { ...h };
      delete next[symbol];
      return next;
    });
    this.persistToStorage();
  }

  private persistToStorage(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.holdings()));
  }

  private loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        this.holdings.set(parsed as Record<string, number>);
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }
}

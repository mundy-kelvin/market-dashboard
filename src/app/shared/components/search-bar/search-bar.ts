import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged, filter, switchMap } from 'rxjs/operators';
import { MarketDataService } from '../../../core/services/market-data';
import { WatchlistService } from '../../../core/services/watchlist';
import { SymbolSearchResult } from '../../../core/models/stock.model';

@Component({
  selector: 'app-search-bar',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './search-bar.html',
  styleUrl: './search-bar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchBar {
  readonly searchCtrl = new FormControl('', { nonNullable: true });

  readonly results = signal<SymbolSearchResult[]>([]);
  readonly loading = signal(false);
  readonly open = signal(false);
  readonly activeIndex = signal(-1);
  readonly error = signal<string | null>(null);

  private readonly destroyRef = inject(DestroyRef);
  private readonly marketData = inject(MarketDataService);
  private readonly watchlist = inject(WatchlistService);

  constructor() {
    this.searchCtrl.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        filter((q) => q.trim().length >= 1),
        takeUntilDestroyed(this.destroyRef),
        switchMap((q) => {
          this.loading.set(true);
          this.error.set(null);
          this.activeIndex.set(-1);
          return this.marketData.searchSymbol(q.trim());
        }),
      )
      .subscribe({
        next: (resp) => {
          this.loading.set(false);
          this.results.set(resp.result.slice(0, 8));
          this.open.set(true);
        },
        error: (err: Error) => {
          this.loading.set(false);
          this.error.set(err.message);
          this.results.set([]);
        },
      });

    this.searchCtrl.valueChanges
      .pipe(
        filter((q) => q.trim().length === 0),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.results.set([]);
        this.open.set(false);
      });
  }

  selectResult(result: SymbolSearchResult): void {
    const alreadyAdded = this.watchlist.watchlist().some((s) => s.symbol === result.symbol);
    if (!alreadyAdded) {
      this.watchlist.add(result.symbol);
    }
    this.searchCtrl.setValue('');
    this.open.set(false);
    this.results.set([]);
  }

  isInWatchlist(symbol: string): boolean {
    return this.watchlist.watchlist().some((s) => s.symbol === symbol);
  }

  @HostListener('keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (!this.open()) return;
    const len = this.results().length;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.activeIndex.set((this.activeIndex() + 1) % len);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.activeIndex.set((this.activeIndex() - 1 + len) % len);
    } else if (event.key === 'Enter') {
      const idx = this.activeIndex();
      if (idx >= 0 && idx < len) {
        this.selectResult(this.results()[idx]);
      }
    } else if (event.key === 'Escape') {
      this.open.set(false);
    }
  }

  onBlur(): void {
    // Delay close to allow click on result to register
    setTimeout(() => this.open.set(false), 150);
  }

  onFocus(): void {
    if (this.results().length) this.open.set(true);
  }
}

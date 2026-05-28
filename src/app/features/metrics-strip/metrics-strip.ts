import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { NgClass, PercentPipe } from '@angular/common';
import { WatchlistService } from '../../core/services/watchlist';
import {
  formatChange,
  formatMarketCap,
  formatPercent,
  formatPrice,
  formatVolume,
} from '../../core/utils/format.util';

@Component({
  selector: 'app-metrics-strip',
  standalone: true,
  imports: [NgClass],
  templateUrl: './metrics-strip.html',
  styleUrl: './metrics-strip.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MetricsStrip {
  private readonly watchlist = inject(WatchlistService);

  readonly stock = computed(() => this.watchlist.selectedStock());
  readonly priceFlash = signal<'up' | 'down' | null>(null);

  constructor() {
    let prevPrice = 0;
    effect(() => {
      const current = this.stock()?.price ?? 0;
      if (prevPrice !== 0 && current !== prevPrice) {
        const dir = current > prevPrice ? 'up' : 'down';
        this.priceFlash.set(dir);
        setTimeout(() => this.priceFlash.set(null), 800);
      }
      prevPrice = current;
    });
  }

  get formattedPrice(): string {
    return this.stock() ? formatPrice(this.stock()!.price) : '—';
  }

  get formattedChange(): string {
    return this.stock() ? formatChange(this.stock()!.change) : '—';
  }

  get formattedChangePct(): string {
    return this.stock() ? formatPercent(this.stock()!.changePct) : '—';
  }

  get formattedMarketCap(): string {
    return this.stock() ? formatMarketCap(this.stock()!.marketCap) : '—';
  }

  get formattedVolume(): string {
    return this.stock() ? formatVolume(this.stock()!.volume) : '—';
  }

  get rangePosition(): number {
    const s = this.stock();
    if (!s) return 0;
    const range = s.high52w - s.low52w;
    if (range === 0) return 50;
    return Math.min(100, Math.max(0, ((s.price - s.low52w) / range) * 100));
  }
}

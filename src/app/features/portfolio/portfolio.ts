import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NgClass } from '@angular/common';
import { WatchlistService } from '../../core/services/watchlist';
import { PortfolioService } from '../../core/services/portfolio';
import { PortfolioRow } from './portfolio-row';
import { formatChange, formatPrice } from '../../core/utils/format.util';
import { Stock } from '../../core/models/stock.model';

@Component({
  selector: 'app-portfolio',
  standalone: true,
  imports: [NgClass, PortfolioRow],
  templateUrl: './portfolio.html',
  styleUrl: './portfolio.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PortfolioComponent {
  protected readonly watchlist = inject(WatchlistService);
  protected readonly portfolioService = inject(PortfolioService);

  readonly rows = computed(() =>
    this.watchlist.watchlist().filter((s) => s.symbol in this.portfolioService.holdings()),
  );

  readonly allWatchlistStocks = computed(() => this.watchlist.watchlist());

  getShares(symbol: string): number {
    return this.portfolioService.holdings()[symbol] ?? 0;
  }

  onSharesChanged(symbol: string, count: number): void {
    this.portfolioService.setShares(symbol, count);
  }

  trackBySymbol(_index: number, stock: Stock): string {
    return stock.symbol;
  }

  get formattedTotal(): string {
    return formatPrice(this.portfolioService.totalValue());
  }

  get formattedDayChange(): string {
    return formatChange(this.portfolioService.dayChange());
  }

  get dayChangePositive(): boolean {
    return this.portfolioService.dayChange() >= 0;
  }
}

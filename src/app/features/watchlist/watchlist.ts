import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { WatchlistService } from '../../core/services/watchlist';
import { WatchlistItem } from './watchlist-item';
import { Stock } from '../../core/models/stock.model';

@Component({
  selector: 'app-watchlist',
  standalone: true,
  imports: [ScrollingModule, WatchlistItem],
  templateUrl: './watchlist.html',
  styleUrl: './watchlist.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WatchlistComponent {
  protected readonly watchlistService = inject(WatchlistService);

  onRemove(symbol: string): void {
    this.watchlistService.remove(symbol);
  }

  onSelect(symbol: string): void {
    this.watchlistService.select(symbol);
  }

  trackBySymbol(_index: number, stock: Stock): string {
    return stock.symbol;
  }
}

import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Stock } from '../../core/models/stock.model';
import { PriceBadge } from '../../shared/components/price-badge/price-badge';

@Component({
  selector: 'app-watchlist-item',
  standalone: true,
  imports: [PriceBadge],
  templateUrl: './watchlist-item.html',
  styleUrl: './watchlist-item.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WatchlistItem {
  readonly stock = input.required<Stock>();
  readonly selected = input<boolean>(false);
  readonly removed = output<string>();
  readonly selected$ = output<string>();

  onRemove(event: MouseEvent): void {
    event.stopPropagation();
    this.removed.emit(this.stock().symbol);
  }

  onSelect(): void {
    this.selected$.emit(this.stock().symbol);
  }
}

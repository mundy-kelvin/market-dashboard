import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgClass } from '@angular/common';
import { Stock } from '../../core/models/stock.model';
import { formatChange, formatPercent, formatPrice } from '../../core/utils/format.util';

@Component({
  selector: 'app-portfolio-row',
  standalone: true,
  imports: [FormsModule, NgClass],
  templateUrl: './portfolio-row.html',
  styleUrl: './portfolio-row.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PortfolioRow {
  readonly stock = input.required<Stock>();
  readonly shares = input<number>(0);
  readonly sharesChanged = output<number>();

  readonly totalValue = computed(() => this.stock().price * this.shares());

  readonly dayPnl = computed(() => {
    const pos = this.stock().price * this.shares();
    return pos * (this.stock().changePct / 100);
  });

  get formattedPrice(): string {
    return formatPrice(this.stock().price);
  }

  get formattedTotal(): string {
    return formatPrice(this.totalValue());
  }

  get formattedDayPnl(): string {
    return formatChange(this.dayPnl());
  }

  get formattedPct(): string {
    return formatPercent(this.stock().changePct);
  }

  onSharesInput(event: Event): void {
    const val = Number((event.target as HTMLInputElement).value);
    if (!isNaN(val) && val >= 0) {
      this.sharesChanged.emit(val);
    }
  }
}

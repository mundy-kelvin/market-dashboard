import {
  ChangeDetectionStrategy,
  Component,
  effect,
  input,
  signal,
} from '@angular/core';
import { NgClass } from '@angular/common';
import { formatPercent, formatPrice } from '../../../core/utils/format.util';

@Component({
  selector: 'app-price-badge',
  standalone: true,
  imports: [NgClass],
  templateUrl: './price-badge.html',
  styleUrl: './price-badge.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PriceBadge {
  readonly price = input<number>(0);
  readonly changePct = input<number>(0);

  readonly flash = signal<'up' | 'down' | null>(null);

  protected get formattedPrice(): string {
    return formatPrice(this.price());
  }

  protected get formattedPct(): string {
    return formatPercent(this.changePct());
  }

  constructor() {
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
  }
}

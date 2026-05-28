import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-price-badge',
  imports: [],
  templateUrl: './price-badge.html',
  styleUrl: './price-badge.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PriceBadge {}

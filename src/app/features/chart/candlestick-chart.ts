import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-candlestick-chart',
  imports: [],
  templateUrl: './candlestick-chart.html',
  styleUrl: './candlestick-chart.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CandlestickChart {}

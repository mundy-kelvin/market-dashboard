import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-watchlist-item',
  imports: [],
  templateUrl: './watchlist-item.html',
  styleUrl: './watchlist-item.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WatchlistItem {}

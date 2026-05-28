import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-watchlist',
  imports: [],
  templateUrl: './watchlist.html',
  styleUrl: './watchlist.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Watchlist {}

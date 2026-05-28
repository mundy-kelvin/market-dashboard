import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { WatchlistService } from './core/services/watchlist';
import { FinnhubService } from './core/services/finnhub';
import { WatchlistComponent } from './features/watchlist/watchlist';
import { CandlestickChart } from './features/chart/candlestick-chart';
import { MetricsStrip } from './features/metrics-strip/metrics-strip';
import { PortfolioComponent } from './features/portfolio/portfolio';
import { SearchBar } from './shared/components/search-bar/search-bar';

type Theme = 'dark' | 'light';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    WatchlistComponent,
    CandlestickChart,
    MetricsStrip,
    PortfolioComponent,
    SearchBar,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App implements OnInit {
  private readonly watchlistService = inject(WatchlistService);
  private readonly finnhubService = inject(FinnhubService);

  readonly selectedSymbol = computed(() => this.watchlistService.selectedSymbol() ?? '');
  readonly wsConnected = signal(false);
  readonly theme = signal<Theme>('dark');

  ngOnInit(): void {
    const saved = localStorage.getItem('md_theme') as Theme | null;
    this.theme.set(saved === 'light' ? 'light' : 'dark');
    this.applyTheme(this.theme());

    this.finnhubService.error$.subscribe((err) => {
      if (err.includes('failed after')) {
        this.wsConnected.set(false);
      }
    });

    // Optimistic connected state — we set true after first price tick
    this.finnhubService.prices$.subscribe(() => {
      if (!this.wsConnected()) this.wsConnected.set(true);
    });
  }

  toggleTheme(): void {
    const next: Theme = this.theme() === 'dark' ? 'light' : 'dark';
    this.theme.set(next);
    localStorage.setItem('md_theme', next);
    this.applyTheme(next);
  }

  private applyTheme(theme: Theme): void {
    document.documentElement.setAttribute('data-theme', theme);
  }
}

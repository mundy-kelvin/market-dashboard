import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  OnDestroy,
  signal,
  ViewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import * as d3 from 'd3';
import { Candle, CandleResponse } from '../../core/models/stock.model';
import { MarketDataService } from '../../core/services/market-data';

const RESOLUTIONS: { label: string; days: number }[] = [
  { label: '1W', days: 7 },
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '1Y', days: 365 },
];

@Component({
  selector: 'app-candlestick-chart',
  standalone: true,
  templateUrl: './candlestick-chart.html',
  styleUrl: './candlestick-chart.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CandlestickChart implements AfterViewInit, OnDestroy {
  @ViewChild('chartContainer', { static: false }) containerRef!: ElementRef<HTMLDivElement>;
  @ViewChild('svgEl', { static: false }) svgRef!: ElementRef<SVGSVGElement>;

  readonly symbol = input<string>('');
  readonly resolutions = RESOLUTIONS;

  readonly activeResolution = signal<(typeof RESOLUTIONS)[number]>(RESOLUTIONS[2]);
  readonly candles = signal<Candle[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  private resizeObserver: ResizeObserver | null = null;
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  constructor(private readonly marketData: MarketDataService) {
    effect(() => {
      const sym = this.symbol();
      const res = this.activeResolution();
      if (sym) this.fetchCandles(sym, res.days);
    });
  }

  ngAfterViewInit(): void {
    this.resizeObserver = new ResizeObserver(() => {
      if (this.candles().length) this.render();
    });
    this.resizeObserver.observe(this.containerRef.nativeElement);
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }

  setResolution(res: (typeof RESOLUTIONS)[number]): void {
    this.activeResolution.set(res);
  }

  private fetchCandles(symbol: string, days: number): void {
    this.loading.set(true);
    this.error.set(null);
    this.candles.set([]);

    const to = Math.floor(Date.now() / 1000);
    const from = to - days * 86400;

    this.marketData
      .getCandles(symbol, from, to)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resp: CandleResponse) => {
          this.loading.set(false);
          if (resp.s === 'no_data' || !resp.c?.length) {
            this.candles.set([]);
            return;
          }
          const candles: Candle[] = resp.t.map((t, i) => ({
            time: new Date(t * 1000),
            open: resp.o[i],
            high: resp.h[i],
            low: resp.l[i],
            close: resp.c[i],
            volume: resp.v[i],
          }));
          this.candles.set(candles);
          this.cdr.markForCheck();
          setTimeout(() => this.render(), 0);
        },
        error: (err: Error) => {
          this.loading.set(false);
          this.error.set(err.message);
          this.cdr.markForCheck();
        },
      });
  }

  private render(): void {
    const candles = this.candles();
    const container = this.containerRef?.nativeElement;
    const svgEl = this.svgRef?.nativeElement;
    if (!container || !svgEl || !candles.length) return;

    const totalWidth = container.clientWidth;
    const totalHeight = container.clientHeight || 400;
    const margin = { top: 16, right: 60, bottom: 24, left: 60 };
    const volumeRatio = 0.28;
    const gap = 8;

    const priceHeight = totalHeight * (1 - volumeRatio) - margin.top - gap;
    const volHeight = totalHeight * volumeRatio - margin.bottom;
    const width = totalWidth - margin.left - margin.right;

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();
    svg.attr('width', totalWidth).attr('height', totalHeight);

    const defs = svg.append('defs');
    const clip = defs.append('clipPath').attr('id', 'chart-clip');
    clip
      .append('rect')
      .attr('width', width)
      .attr('height', priceHeight + volHeight + gap);

    const priceG = svg
      .append('g')
      .attr('class', 'price-group')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const volG = svg
      .append('g')
      .attr('class', 'vol-group')
      .attr('transform', `translate(${margin.left},${margin.top + priceHeight + gap})`);

    // ── Scales ──────────────────────────────────────────────────────────────
    const xDomain = candles.map((c) => c.time);
    const xScale = d3.scaleBand<Date>().domain(xDomain).range([0, width]).padding(0.2);

    const priceExtent = [
      d3.min(candles, (c) => c.low) as number,
      d3.max(candles, (c) => c.high) as number,
    ];
    const pricePad = (priceExtent[1] - priceExtent[0]) * 0.05;
    const yPrice = d3
      .scaleLinear()
      .domain([priceExtent[0] - pricePad, priceExtent[1] + pricePad])
      .range([priceHeight, 0]);

    const yVol = d3
      .scaleLinear()
      .domain([0, d3.max(candles, (c) => c.volume) as number])
      .range([volHeight, 0]);

    // ── Axes ────────────────────────────────────────────────────────────────
    const tickCount = Math.min(6, candles.length);
    const xAxisScale = d3
      .scaleTime()
      .domain([candles[0].time, candles[candles.length - 1].time])
      .range([0, width]);

    const xAxis = d3.axisBottom(xAxisScale).ticks(tickCount).tickSize(-priceHeight);
    const yAxis = d3.axisLeft(yPrice).ticks(6).tickSize(-width).tickFormat(d3.format('$.2f'));

    priceG
      .append('g')
      .attr('class', 'axis x-axis')
      .attr('transform', `translate(0,${priceHeight})`)
      .call(xAxis)
      .selectAll('line')
      .attr('stroke', 'var(--grid-color)');

    priceG
      .append('g')
      .attr('class', 'axis y-axis')
      .call(yAxis)
      .selectAll('line')
      .attr('stroke', 'var(--grid-color)');

    volG
      .append('g')
      .attr('class', 'axis y-axis-vol')
      .call(d3.axisLeft(yVol).ticks(3).tickFormat(d3.format('.2s')));

    // ── Candlesticks ────────────────────────────────────────────────────────
    const candleG = priceG.append('g').attr('clip-path', 'url(#chart-clip)');

    const bandW = xScale.bandwidth();

    candles.forEach((c) => {
      const x = (xScale(c.time) ?? 0) + bandW / 2;
      const isUp = c.close >= c.open;
      const color = isUp ? 'var(--candle-up)' : 'var(--candle-down)';

      // Wick
      candleG
        .append('line')
        .attr('x1', x)
        .attr('x2', x)
        .attr('y1', yPrice(c.high))
        .attr('y2', yPrice(c.low))
        .attr('stroke', color)
        .attr('stroke-width', 1);

      // Body
      candleG
        .append('rect')
        .attr('x', xScale(c.time) ?? 0)
        .attr('y', yPrice(Math.max(c.open, c.close)))
        .attr('width', bandW)
        .attr('height', Math.max(1, Math.abs(yPrice(c.open) - yPrice(c.close))))
        .attr('fill', color)
        .attr('stroke', color);
    });

    // ── Volume bars ──────────────────────────────────────────────────────────
    const volBarG = volG.append('g').attr('clip-path', 'url(#chart-clip)');
    candles.forEach((c) => {
      const isUp = c.close >= c.open;
      volBarG
        .append('rect')
        .attr('x', xScale(c.time) ?? 0)
        .attr('y', yVol(c.volume))
        .attr('width', bandW)
        .attr('height', volHeight - yVol(c.volume))
        .attr('fill', isUp ? 'var(--candle-up-alpha)' : 'var(--candle-down-alpha)');
    });

    // ── Crosshair & Tooltip ─────────────────────────────────────────────────
    const tooltip = d3
      .select(container)
      .selectAll<HTMLDivElement, null>('.chart-tooltip')
      .data([null])
      .join('div')
      .attr('class', 'chart-tooltip');

    const crossV = priceG
      .append('line')
      .attr('class', 'crosshair')
      .attr('y1', 0)
      .attr('y2', priceHeight)
      .style('display', 'none');

    const crossH = priceG
      .append('line')
      .attr('class', 'crosshair')
      .attr('x1', 0)
      .attr('x2', width)
      .style('display', 'none');

    const overlay = priceG
      .append('rect')
      .attr('width', width)
      .attr('height', priceHeight)
      .attr('fill', 'transparent')
      .style('cursor', 'crosshair');

    overlay.on('mousemove', (event: MouseEvent) => {
      const [mx] = d3.pointer(event);
      const nearest = candles.reduce((best, c) => {
        const cx = (xScale(c.time) ?? 0) + bandW / 2;
        return Math.abs(cx - mx) < Math.abs((xScale(best.time) ?? 0) + bandW / 2 - mx) ? c : best;
      });
      const cx = (xScale(nearest.time) ?? 0) + bandW / 2;
      const [, my] = d3.pointer(event);

      crossV.attr('x1', cx).attr('x2', cx).style('display', null);
      crossH.attr('y1', my).attr('y2', my).style('display', null);

      tooltip
        .style('display', 'block')
        .style('left', `${margin.left + cx + 10}px`)
        .style('top', `${margin.top + my - 10}px`)
        .html(
          `<div class="tt-date">${nearest.time.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</div>` +
            `<div class="tt-row"><span>O</span><span>${nearest.open.toFixed(2)}</span></div>` +
            `<div class="tt-row"><span>H</span><span>${nearest.high.toFixed(2)}</span></div>` +
            `<div class="tt-row"><span>L</span><span>${nearest.low.toFixed(2)}</span></div>` +
            `<div class="tt-row"><span>C</span><span>${nearest.close.toFixed(2)}</span></div>` +
            `<div class="tt-row"><span>V</span><span>${d3.format('.3s')(nearest.volume)}</span></div>`,
        );
    });

    overlay.on('mouseleave', () => {
      crossV.style('display', 'none');
      crossH.style('display', 'none');
      tooltip.style('display', 'none');
    });
  }
}

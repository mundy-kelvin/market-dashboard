const PRICE_FORMATTER = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const PCT_FORMATTER = new Intl.NumberFormat('en-US', {
  style: 'percent',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  signDisplay: 'always',
});

export function formatPrice(value: number): string {
  return PRICE_FORMATTER.format(value);
}

export function formatPercent(value: number): string {
  return PCT_FORMATTER.format(value / 100);
}

export function formatChange(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${PRICE_FORMATTER.format(value)}`;
}

export function formatMarketCap(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}T`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(2)}B`;
  if (value >= 1) return `$${value.toFixed(2)}M`;
  return '$0';
}

export function formatVolume(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

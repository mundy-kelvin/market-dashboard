export interface Stock {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  high52w: number;
  low52w: number;
  marketCap: number;
  volume: number;
}

export interface Candle {
  time: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Quote {
  c: number;   // current price
  d: number;   // change
  dp: number;  // % change
  h: number;   // high
  l: number;   // low
  o: number;   // open
  pc: number;  // prev close
}

export interface CompanyProfile {
  name: string;
  marketCapitalization: number;
  ticker: string;
  exchange: string;
  ipo: string;
  logo: string;
  weburl: string;
  finnhubIndustry: string;
}

export interface SymbolSearchResult {
  symbol: string;
  description: string;
  type: string;
  displaySymbol: string;
}

export interface CandleResponse {
  c: number[];
  h: number[];
  l: number[];
  o: number[];
  t: number[];
  v: number[];
  s: 'ok' | 'no_data';
}

export interface SymbolSearchResponse {
  count: number;
  result: SymbolSearchResult[];
}


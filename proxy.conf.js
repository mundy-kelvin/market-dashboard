module.exports = [
  {
    context: ['/api/chart'],
    target: 'https://query1.finance.yahoo.com',
    secure: true,
    changeOrigin: true,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      'Accept': 'application/json',
    },
    rewrite: (path) => {
      const url = new URL(`http://localhost${path}`);
      const symbol = url.searchParams.get('symbol') ?? '';
      const range = url.searchParams.get('range') ?? '3mo';
      return `/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=${range}`;
    },
  },
];

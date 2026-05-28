import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { symbol, range = '3mo' } = req.query as Record<string, string>;

  if (!symbol) {
    res.status(400).json({ error: 'Missing required query param: symbol' });
    return;
  }

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=${range}`;

  try {
    const upstream = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'Accept': 'application/json',
      },
    });

    const data: unknown = await upstream.json();
    res
      .status(upstream.status)
      .setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300')
      .json(data);
  } catch {
    res.status(502).json({ error: 'Failed to fetch from Yahoo Finance' });
  }
}

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const segments = Array.isArray(req.query.path)
    ? req.query.path
    : [req.query.path as string];

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(req.query)) {
    if (key !== 'path') params.set(key, value as string);
  }

  const url = `https://query1.finance.yahoo.com/${segments.join('/')}?${params}`;

  const upstream = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const data = await upstream.json();

  res.status(upstream.status).json(data);
}

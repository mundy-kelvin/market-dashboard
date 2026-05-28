export async function GET(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url, 'http://localhost');
  const symbol = searchParams.get('symbol');
  const range = searchParams.get('range') ?? '3mo';

  if (!symbol) {
    return Response.json({ error: 'Missing required query param: symbol' }, { status: 400 });
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
    return Response.json(data, {
      status: upstream.status,
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
    });
  } catch {
    return Response.json({ error: 'Failed to fetch from Yahoo Finance' }, { status: 502 });
  }
}

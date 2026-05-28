/**
 * Catch-all proxy for Yahoo Finance API.
 *
 * Route: /api/yahoo-finance/**
 * Forwards to: https://query1.finance.yahoo.com/**
 *
 * Strips the /api/yahoo-finance prefix and re-attaches the remaining path
 * plus all original query parameters. Adds the User-Agent header that Yahoo
 * requires to avoid 429/403 responses.
 *
 * Uses the Web Standards API (Request → Response) — no @vercel/node import
 * needed. This format is compatible with all @vercel/node v3+ runtimes.
 */
export default async function handler(req: Request): Promise<Response> {
  const { pathname, search } = new URL(req.url);

  // e.g. /api/yahoo-finance/v8/finance/chart/AAPL → /v8/finance/chart/AAPL
  const upstreamPath = pathname.replace('/api/yahoo-finance', '');
  const upstreamUrl = `https://query1.finance.yahoo.com${upstreamPath}${search}`;

  try {
    const upstream = await fetch(upstreamUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });

    const data: unknown = await upstream.json();

    return Response.json(data, {
      status: upstream.status,
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    });
  } catch {
    return Response.json(
      { error: 'Failed to fetch from Yahoo Finance' },
      { status: 502 },
    );
  }
}

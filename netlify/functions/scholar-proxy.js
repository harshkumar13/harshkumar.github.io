// netlify/functions/scholar-proxy.js
// Scrapes Harsh Kumar's Google Scholar profile server-side and returns
// the citation / h-index / i10-index numbers as JSON. Server-side avoids
// CORS and lets us use a browser User-Agent + cache aggressively.
//
// Scholar profile: https://scholar.google.com/citations?user=fFGkrbAAAAAJ
// The stats table has rows for Citations / h-index / i10-index, each with
// two <td class="gsc_rsb_std"> values: all-time and recent (last 5 years).

const SCHOLAR_USER = 'fFGkrbAAAAAJ';

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: cors(), body: '' };
  }
  if (event.httpMethod !== 'GET') {
    return json(405, { error: 'Method not allowed' });
  }

  const url = `https://scholar.google.com/citations?user=${SCHOLAR_USER}&hl=en`;
  try {
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
      },
    });
    if (!r.ok) return json(r.status, { error: `Scholar HTTP ${r.status}` });
    const html = await r.text();

    // Defensive: if Google served a CAPTCHA / sorry page, bail
    if (/captcha|unusual traffic|sorry\/index/i.test(html)) {
      return json(429, { error: 'Scholar served a CAPTCHA page (rate-limited)' });
    }

    // Extract the six numbers from the right-side stats box.
    // Order in the page DOM: cites-all, cites-recent, h-all, h-recent, i10-all, i10-recent
    const cells = [...html.matchAll(/<td[^>]*class="gsc_rsb_std"[^>]*>([\d,]+)<\/td>/g)]
      .map(m => parseInt(m[1].replace(/,/g, ''), 10))
      .filter(n => Number.isFinite(n));

    if (cells.length < 6) {
      return json(502, { error: 'Could not parse Scholar metrics', cellsFound: cells.length });
    }

    const [citations, citationsRecent, hIndex, hIndexRecent, i10Index, i10IndexRecent] = cells;

    return {
      statusCode: 200,
      headers: {
        ...cors(),
        'Content-Type': 'application/json',
        // 12h edge cache, 24h browser, plus stale-while-revalidate for resilience
        'Cache-Control': 'public, s-maxage=43200, max-age=43200, stale-while-revalidate=86400',
      },
      body: JSON.stringify({
        citations,
        citationsRecent,
        hIndex,
        hIndexRecent,
        i10Index,
        i10IndexRecent,
        source: 'scholar.google.com',
        fetchedAt: new Date().toISOString(),
      }),
    };
  } catch (e) {
    return json(502, { error: `Network/parse error: ${e.message}` });
  }
};

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
function json(code, body) {
  return {
    statusCode: code,
    headers: { ...cors(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

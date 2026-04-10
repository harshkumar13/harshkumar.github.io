// netlify/functions/ads-proxy.js  v4.1
// Adds: property field (needed for refereed detection)
//       checkOnly mode (tiny fast cache-validation response)
// ─────────────────────────────────────────────────────────────

exports.handler = async function (event) {

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: cors(), body: '' };
  }
  if (event.httpMethod !== 'GET') {
    return res(405, { error: 'Method not allowed' });
  }

  const token = process.env.ADS_TOKEN;
  if (!token || token.length < 15) {
    return res(500, {
      error: 'ADS_TOKEN not set in Netlify environment variables.',
      hint:  'Dashboard → Site configuration → Environment variables → Add ADS_TOKEN',
    });
  }

  const p = event.queryStringParameters || {};
  const q = p.q || '';

  if (!q.includes('orcid:')) {
    return res(400, { error: 'Query must contain orcid: filter' });
  }

  // ── checkOnly mode ──────────────────────────────────────────
  // Returns only numFound + newest bibcode (~100 bytes).
  // Used by the browser to decide if local cache is still valid.
  // ────────────────────────────────────────────────────────────
  if (p.checkOnly === 'true') {
    const url = buildADSUrl(q, 'bibcode,year', '1', 'date desc');
    try {
      const r = await callADS(url, token);
      if (!r.ok) return res(r.status, { error: `ADS ${r.status}` });
      const j = await r.json();
      return {
        statusCode: 200,
        headers: {
          ...cors(),
          'Content-Type':  'application/json',
          'Cache-Control': 'public, s-maxage=600, max-age=600',
        },
        body: JSON.stringify({
          numFound     : j.response?.numFound        ?? 0,
          newestBibcode: j.response?.docs?.[0]?.bibcode ?? '',
          newestYear   : j.response?.docs?.[0]?.year    ?? '',
        }),
      };
    } catch (e) {
      return res(502, { error: e.message });
    }
  }

  // ── Full fetch mode ─────────────────────────────────────────
  // Whitelist every field the browser is allowed to request.
  // 'property' is required for refereed/non-refereed detection.
  const ALLOWED_FL = new Set([
    'title',
    'author',
    'year',
    'pubdate',
    'bibcode',
    'doi',
    'abstract',
    'citation_count',
    'pub',
    'identifier',
    'read_count',
    'property',       // ← needed: contains 'REFEREED' flag
  ]);

  const fl = (p.fl || '')
    .split(',')
    .map(f => f.trim())
    .filter(f => ALLOWED_FL.has(f))
    .join(',') || 'title,author,year,bibcode';

  const rows = String(Math.min(parseInt(p.rows || '250', 10), 500));

  const SAFE_SORTS = ['date desc', 'date asc', 'citation_count desc'];
  const sort = SAFE_SORTS.includes(p.sort) ? p.sort : 'date desc';

  const adsUrl = buildADSUrl(q, fl, rows, sort);

  try {
    const r = await callADS(adsUrl, token);
    if (!r.ok) {
      const msgs = {
        401: 'ADS token invalid or expired — regenerate at ui.adsabs.harvard.edu/user/settings/token',
        403: 'ADS token lacks search permission — regenerate your token',
        429: 'ADS rate limit — wait a few minutes',
      };
      return res(r.status, { error: msgs[r.status] || `ADS HTTP ${r.status}` });
    }
    const data = await r.json();
    return {
      statusCode: 200,
      headers: {
        ...cors(),
        'Content-Type':  'application/json',
        'Cache-Control': 'public, s-maxage=3600, max-age=86400, stale-while-revalidate=7200',
      },
      body: JSON.stringify(data),
    };
  } catch (e) {
    return res(502, { error: `Network error: ${e.message}` });
  }
};

// ── Helpers ───────────────────────────────────────────────────
function buildADSUrl(q, fl, rows, sort) {
  const params = new URLSearchParams({ q, fl, rows, sort });
  return `https://api.adsabs.harvard.edu/v1/search/query?${params}`;
}

async function callADS(url, token) {
  return fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'User-Agent'   : 'HarshKumar-AcademicSite/4.1',
    },
  });
}

function cors() {
  return {
    'Access-Control-Allow-Origin' : '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function res(code, body) {
  return {
    statusCode: code,
    headers   : { ...cors(), 'Content-Type': 'application/json' },
    body      : JSON.stringify(body),
  };
}
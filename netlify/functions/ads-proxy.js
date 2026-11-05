// netlify/functions/ads-proxy.js  v5
// Reads a SciX/ADS library (biblib API) and returns it in the shape of
// an ADS search response: { response: { numFound, docs } }.
//   ?library=<id>&fl=...&sort=...   full fetch (all pages)
//   ?library=<id>&checkOnly=true    tiny cache-validation response
// ─────────────────────────────────────────────────────────────

// biblib returns at most 100 records per request (BIBLIB_MAX_ROWS)
const PAGE = 100;

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
  const lib = p.library || '';

  if (!/^[A-Za-z0-9_-]{10,40}$/.test(lib)) {
    return res(400, { error: 'library must be a SciX/ADS library ID' });
  }

  // ── checkOnly mode ──────────────────────────────────────────
  // Returns only numFound + newest bibcode (~100 bytes).
  // Used by the browser to decide if local cache is still valid.
  // ────────────────────────────────────────────────────────────
  if (p.checkOnly === 'true') {
    try {
      const j = await fetchLibraryPage(lib, 'bibcode,year', 0, 1, 'date desc', token);
      const doc = j.solr?.response?.docs?.[0];
      return {
        statusCode: 200,
        headers: {
          ...cors(),
          'Content-Type':  'application/json',
          'Cache-Control': 'public, s-maxage=600, max-age=600',
        },
        body: JSON.stringify({
          numFound     : j.metadata?.num_documents ?? 0,
          newestBibcode: doc?.bibcode ?? '',
          newestYear   : doc?.year    ?? '',
        }),
      };
    } catch (e) {
      return res(e.status || 502, { error: e.message });
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

  // biblib needs bibcode in every response, so it is always requested.
  const fl = ['bibcode', ...(p.fl || '')
    .split(',')
    .map(f => f.trim())
    .filter(f => f !== 'bibcode' && ALLOWED_FL.has(f))].join(',');

  const SAFE_SORTS = ['date desc', 'date asc', 'citation_count desc'];
  const sort = SAFE_SORTS.includes(p.sort) ? p.sort : 'date desc';

  try {
    const docs = [];
    let total = 0;
    for (let start = 0; start === 0 || start < total; start += PAGE) {
      const j = await fetchLibraryPage(lib, fl, start, PAGE, sort, token);
      total = j.metadata?.num_documents ?? 0;
      const page = j.solr?.response?.docs || [];
      docs.push(...page);
      if (!page.length) break;
    }
    return {
      statusCode: 200,
      headers: {
        ...cors(),
        'Content-Type':  'application/json',
        'Cache-Control': 'public, s-maxage=3600, max-age=86400, stale-while-revalidate=7200',
      },
      body: JSON.stringify({ response: { numFound: total, docs } }),
    };
  } catch (e) {
    return res(e.status || 502, { error: e.message });
  }
};

// ── Helpers ───────────────────────────────────────────────────
async function fetchLibraryPage(lib, fl, start, rows, sort, token) {
  const params = new URLSearchParams({ fl, start: String(start), rows: String(rows), sort });
  const url = `https://api.adsabs.harvard.edu/v1/biblib/libraries/${lib}?${params}`;
  let r;
  try {
    r = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent'   : 'HarshKumar-AcademicSite/5',
      },
    });
  } catch (e) {
    throw Object.assign(new Error(`Network error: ${e.message}`), { status: 502 });
  }
  if (!r.ok) {
    const msgs = {
      401: 'ADS token invalid or expired — regenerate at scixplorer.org/user/settings/token',
      403: 'ADS token cannot read this library — check the library is public or owned by the token holder',
      404: 'Library not found — check the library ID',
      429: 'ADS rate limit — wait a few minutes',
    };
    throw Object.assign(new Error(msgs[r.status] || `ADS HTTP ${r.status}`), { status: r.status });
  }
  return r.json();
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

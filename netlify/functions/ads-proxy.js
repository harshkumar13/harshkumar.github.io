// netlify/functions/ads-proxy.js
// ─────────────────────────────────────────────────────────────────
//  Serverless proxy — ADS token lives ONLY in Netlify environment.
//  Browser calls: GET /.netlify/functions/ads-proxy?q=...
//  This function calls NASA ADS with the secret token server-side.
//  Token is set in: Netlify Dashboard → Site config → Env variables
// ─────────────────────────────────────────────────────────────────

exports.handler = async function (event, context) {

  // ── CORS preflight (browsers send this before the real request) ──
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: corsHeaders(),
      body: '',
    };
  }

  // ── Only allow GET ──
  if (event.httpMethod !== 'GET') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  // ── Pull token from Netlify environment variable ──
  // This value is NEVER sent to the browser — it only exists on the server.
  const token = process.env.ADS_TOKEN;

  if (!token || token.length < 15) {
    console.error('[ads-proxy] ADS_TOKEN environment variable is missing or empty.');
    return jsonResponse(500, {
      error: 'Server configuration error: ADS_TOKEN not set.',
      hint:  'Go to Netlify Dashboard → Site configuration → Environment variables → Add ADS_TOKEN',
    });
  }

  // ── Whitelist the query parameters we forward to ADS ──
  // We never blindly forward all params — only the ones our site needs.
  const incoming = event.queryStringParameters || {};
  const adsParams = new URLSearchParams();

  // Required: search query (must contain orcid:...)
  const q = incoming.q || '';
  if (!q.includes('orcid:')) {
    return jsonResponse(400, { error: 'Query must include orcid: filter' });
  }
  adsParams.set('q', q);

  // Fields to return
  const ALLOWED_FL = new Set([
    'title', 'author', 'year', 'pubdate', 'bibcode',
    'doi', 'abstract', 'citation_count', 'pub', 'identifier',
    'read_count', 'property',
  ]);
  const fl = (incoming.fl || '')
    .split(',')
    .map(f => f.trim())
    .filter(f => ALLOWED_FL.has(f))
    .join(',');
  adsParams.set('fl', fl || 'title,author,year,bibcode');

  // Rows: cap at 500 to prevent abuse
  const rows = Math.min(parseInt(incoming.rows || '250', 10), 500);
  adsParams.set('rows', String(rows));

  // Sort
  const SAFE_SORTS = ['date desc', 'date asc', 'citation_count desc', 'read_count desc'];
  const sort = SAFE_SORTS.includes(incoming.sort) ? incoming.sort : 'date desc';
  adsParams.set('sort', sort);

  // ── Build the ADS URL ──
  const adsUrl = `https://api.adsabs.harvard.edu/v1/search/query?${adsParams}`;

  // ── Call ADS with the secret token ──
  let adsRes;
  try {
    adsRes = await fetch(adsUrl, {
      method:  'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type':  'application/json',
        'User-Agent':    'HarshKumar-AcademicSite/3.0 (Netlify proxy)',
      },
    });
  } catch (networkErr) {
    console.error('[ads-proxy] Network error reaching ADS:', networkErr.message);
    return jsonResponse(502, {
      error: 'Could not reach NASA ADS API',
      detail: networkErr.message,
    });
  }

  // ── Forward ADS error status codes meaningfully ──
  if (!adsRes.ok) {
    const statusMessages = {
      401: 'ADS token is invalid or expired. Regenerate it at ui.adsabs.harvard.edu/user/settings/token and update the Netlify environment variable.',
      403: 'ADS token does not have search permission. Try regenerating your token.',
      429: 'NASA ADS rate limit hit. Please wait a few minutes.',
    };
    console.error(`[ads-proxy] ADS returned ${adsRes.status}`);
    return jsonResponse(adsRes.status, {
      error: statusMessages[adsRes.status] || `ADS API error: HTTP ${adsRes.status}`,
    });
  }

  // ── Parse and return ADS data ──
  // The token is NEVER included in this response — only the paper data.
  let data;
  try {
    data = await adsRes.json();
  } catch (parseErr) {
    return jsonResponse(502, { error: 'Invalid JSON from ADS API' });
  }

  return {
    statusCode: 200,
    headers: {
      ...corsHeaders(),
      'Content-Type':  'application/json',
      // Cache for 1 hour in CDN, 24 hours in browser — publications don't change by the minute
      'Cache-Control': 'public, s-maxage=3600, max-age=86400, stale-while-revalidate=7200',
    },
    body: JSON.stringify(data),
  };
};

// ── Helper: CORS headers ──
// Allows your site (and only your site) to call this function.
// '*' is safe here because the data (paper titles/authors) is fully public anyway.
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

// ── Helper: JSON response ──
function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}
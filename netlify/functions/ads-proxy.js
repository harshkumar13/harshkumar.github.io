// netlify/functions/scholar-proxy.js
// ─────────────────────────────────────────────────────────────
// Fetches citation metrics from Google Scholar server-side.
// Browser can't call Scholar directly (CORS blocked).
// This runs on Netlify's server — no CORS issue.
// ─────────────────────────────────────────────────────────────

exports.handler = async function (event) {

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: cors(), body: '' };
  }
  if (event.httpMethod !== 'GET') {
    return res(405, { error: 'Method not allowed' });
  }

  // Harsh Kumar's Google Scholar user ID
  const SCHOLAR_ID  = 'fFGkrbAAAAAJ';
  const scholarUrl  =
    `https://scholar.google.com/citations?user=${SCHOLAR_ID}&hl=en&sortby=pubdate`;

  try {
    const r = await fetch(scholarUrl, {
      headers: {
        // Mimic a real browser — Scholar blocks obvious bots
        'User-Agent'     : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
                           'AppleWebKit/537.36 (KHTML, like Gecko) ' +
                           'Chrome/120.0.0.0 Safari/537.36',
        'Accept'         : 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control'  : 'no-cache',
      },
    });

    if (!r.ok) throw new Error(`Scholar returned HTTP ${r.status}`);

    const html     = await r.text();
    const metrics  = parseScholarMetrics(html);

    // Sanity check — if all zeros, Scholar probably served a CAPTCHA page
    if (metrics.citations === 0 && metrics.hIndex === 0) {
      throw new Error('Scholar metrics are all zero — possible CAPTCHA block');
    }

    return {
      statusCode: 200,
      headers: {
        ...cors(),
        'Content-Type' : 'application/json',
        // Cache for 6 hours — Scholar stats don't change by the minute
        'Cache-Control': 'public, s-maxage=21600, max-age=21600',
      },
      body: JSON.stringify(metrics),
    };

  } catch (e) {
    console.error('[scholar-proxy]', e.message);
    return res(502, { error: e.message });
  }
};

// ── Parse Scholar profile HTML ────────────────────────────────
// The stats table (#gsc_rsb_st) contains six <td class="gsc_rsb_std">
// in this fixed order:
//   citations_all, citations_since5yr,
//   h_all,         h_since5yr,
//   i10_all,       i10_since5yr
function parseScholarMetrics(html) {
  // Primary: match gsc_rsb_std cells
  const stdRe   = /class="gsc_rsb_std">(\d+)<\/td>/g;
  const vals    = [...html.matchAll(stdRe)].map(m => parseInt(m[1], 10));

  if (vals.length >= 6) {
    return {
      citations : vals[0],
      citations5: vals[1],
      hIndex    : vals[2],
      hIndex5   : vals[3],
      i10Index  : vals[4],
      i10Index5 : vals[5],
    };
  }

  // Fallback: try broader numeric extraction if Scholar changed markup
  const numRe  = />(\d{1,6})<\/td>/g;
  const nums   = [...html.matchAll(numRe)]
                   .map(m => parseInt(m[1], 10))
                   .filter(n => n > 0);

  return {
    citations : nums[0] ?? 0,
    citations5: nums[1] ?? 0,
    hIndex    : nums[2] ?? 0,
    hIndex5   : nums[3] ?? 0,
    i10Index  : nums[4] ?? 0,
    i10Index5 : nums[5] ?? 0,
  };
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
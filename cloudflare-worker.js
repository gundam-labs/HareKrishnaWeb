// ═══════════════════════════════════════════════════════════════
//  JAGANNATH.DK — Cloudflare Worker
//  Handles: JSONBin storage (read/write) + Twilio SMS
//
//  Environment Variables to set in Cloudflare Dashboard:
//  (Workers & Pages → your worker → Settings → Variables → Secrets)
//
//  WORKER_SECRET        → any password you choose e.g. "JagannathSeva2026!"
//  JSONBIN_BIN_ID       → your JSONBin bin ID
//  JSONBIN_API_KEY      → your JSONBin Master Key (new one after regenerating)
//  TWILIO_ACCOUNT_SID   → from twilio.com dashboard
//  TWILIO_AUTH_TOKEN    → from twilio.com dashboard
//  TWILIO_FROM_NUMBER   → your Twilio phone number e.g. +4512345678
//  ALLOWED_ORIGIN       → https://jagannath.dk
// ═══════════════════════════════════════════════════════════════

export default {
  async fetch(request, env) {

    // ── CORS preflight ──
    if (request.method === 'OPTIONS') {
      return cors(null, 204, env);
    }

    // ── Only POST ──
    if (request.method !== 'POST') {
      return cors(json({ error: 'Method not allowed' }), 405, env);
    }

    // ── Parse body ──
    let body;
    try {
      body = await request.json();
    } catch {
      return cors(json({ error: 'Invalid JSON body' }), 400, env);
    }

    // ── Auth check — shared secret ──
    if (!body.secret || body.secret !== env.WORKER_SECRET) {
      return cors(json({ error: 'Unauthorized' }), 401, env);
    }

    const { action } = body;

    // ── Route by action ──
    switch (action) {

      case 'db_read':
        return handleDBRead(env);

      case 'db_write':
        return handleDBWrite(body.signups, env);

      case 'sms':
        return handleSMS(body.to, body.message, env);

      default:
        return cors(json({ error: `Unknown action: ${action}` }), 400, env);
    }
  }
};

// ═══════════════════════════════════════
//  DB READ — GET signups from JSONBin
// ═══════════════════════════════════════
async function handleDBRead(env) {
  try {
    const resp = await fetch(
      `https://api.jsonbin.io/v3/b/${env.JSONBIN_BIN_ID}/latest`,
      { headers: { 'X-Master-Key': env.JSONBIN_API_KEY } }
    );

    if (!resp.ok) {
      const err = await resp.text();
      console.error('JSONBin read error:', resp.status, err);
      return cors(json({ error: 'Database read failed', status: resp.status }), 500, env);
    }

    const data = await resp.json();
    const signups = data.record?.signups || [];
    return cors(json({ success: true, signups }), 200, env);

  } catch (err) {
    console.error('DB read exception:', err);
    return cors(json({ error: 'Database read exception' }), 500, env);
  }
}

// ═══════════════════════════════════════
//  DB WRITE — PUT signups to JSONBin
// ═══════════════════════════════════════
async function handleDBWrite(signups, env) {
  if (!Array.isArray(signups)) {
    return cors(json({ error: 'signups must be an array' }), 400, env);
  }

  try {
    const resp = await fetch(
      `https://api.jsonbin.io/v3/b/${env.JSONBIN_BIN_ID}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Master-Key': env.JSONBIN_API_KEY
        },
        body: JSON.stringify({ signups })
      }
    );

    if (!resp.ok) {
      const err = await resp.text();
      console.error('JSONBin write error:', resp.status, err);
      return cors(json({ error: 'Database write failed', status: resp.status }), 500, env);
    }

    const data = await resp.json();
    return cors(json({ success: true, record: data.record }), 200, env);

  } catch (err) {
    console.error('DB write exception:', err);
    return cors(json({ error: 'Database write exception' }), 500, env);
  }
}

// ═══════════════════════════════════════
//  SMS — Send via Twilio
// ═══════════════════════════════════════
async function handleSMS(to, message, env) {
  if (!to || !message) {
    return cors(json({ error: 'Missing to or message' }), 400, env);
  }

  // Normalise Danish phone numbers
  let phone = to.replace(/\s+/g, '').replace(/[^0-9+]/g, '');
  if (phone.startsWith('00'))       phone = '+' + phone.slice(2);
  if (!phone.startsWith('+') && phone.length === 8) phone = '+45' + phone;
  if (!phone.startsWith('+'))       phone = '+45' + phone;

  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`;
  const credentials = btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`);

  try {
    const resp = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type':  'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To:   phone,
        From: env.TWILIO_FROM_NUMBER,
        Body: message
      }).toString()
    });

    const result = await resp.json();

    if (resp.ok) {
      return cors(json({ success: true, sid: result.sid }), 200, env);
    } else {
      console.error('Twilio error:', result);
      return cors(json({ error: result.message || 'Twilio error' }), 500, env);
    }

  } catch (err) {
    console.error('SMS exception:', err);
    return cors(json({ error: 'SMS send exception' }), 500, env);
  }
}

// ═══════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════
function json(data) {
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' }
  });
}

function cors(response, status, env) {
  const origin = env?.ALLOWED_ORIGIN || 'https://jagannath.dk';
  const headers = {
    'Access-Control-Allow-Origin':  origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (!response) {
    return new Response(null, { status, headers });
  }

  // Clone with status + CORS headers
  const body = response.body;
  const contentType = response.headers.get('Content-Type') || 'application/json';
  return new Response(body, {
    status,
    headers: { ...headers, 'Content-Type': contentType }
  });
}

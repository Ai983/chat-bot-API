// api/chat.js
// Vercel Serverless Function: POST /api/chat

module.exports = async (req, res) => {
  // --- CORS (allow your site to call this endpoint from the browser) ---
  const allowedOrigins = [
    'https://hagerstone-international.lovable.app',
    'https://preview--hagerstone-international.lovable.app',
    'https://hagerstone.com/'
  ];
  const origin = req.headers.origin;
  const allowOrigin = allowedOrigins.includes(origin) ? origin : '*';

  res.setHeader('Access-Control-Allow-Origin', allowOrigin);
  res.setHeader('Vary', 'Origin'); // so proxies cache per-origin
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Respond to preflight
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OPENAI_API_KEY is not set' });
    }

    const { messages, lead } = req.body || {};
    if (!Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages[] array is required' });
    }

    // (Optional) Forward lead info to Google Sheets via Apps Script webhook
    if (lead?.email || lead?.phone) {
      try {
        if (process.env.LEADS_WEBHOOK_URL) {
          await fetch(process.env.LEADS_WEBHOOK_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(process.env.LEADS_SECRET
                ? { 'X-Lead-Secret': process.env.LEADS_SECRET }
                : {}),
            },
            body: JSON.stringify({ ts: Date.now(), ...lead }),
          });
        }
      } catch (err) {
        console.warn('Lead logging failed:', err?.message || String(err));
        // do not fail the chat on lead logging errors
      }
    }

    // Call OpenAI Chat Completions
    const oaRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.5,
        messages: [
          {
            role: 'system',
            content:
              "You are Hagerstone International’s AI Design Assistant. " +
              "Greet warmly, ask for project type, room dimensions, style, budget, and timeline. " +
              "Be concise, friendly, and professional. " +
              "Offer to schedule a free 10-minute design consultation when appropriate.",
          },
          ...messages,
        ],
      }),
    });

    // Surface OpenAI API errors cleanly
    if (!oaRes.ok) {
      const errBody = await safeJson(oaRes);
      console.error('OpenAI error:', oaRes.status, errBody);
      return res
        .status(502)
        .json({ error: 'Upstream model error', status: oaRes.status });
    }

    const data = await oaRes.json();
    const text =
      data?.choices?.[0]?.message?.content?.trim() ||
      "Sorry, I couldn’t generate a response.";

    return res.status(200).json({ reply: text });
  } catch (error) {
    console.error('Chat API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Helper: tolerate non-JSON error bodies
async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    try {
      return await res.text();
    } catch {
      return null;
    }
  }
}

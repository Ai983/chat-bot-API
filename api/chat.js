// Vercel Serverless Function: /api/chat
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { messages, lead } = req.body || {};
    if (!Array.isArray(messages)) return res.status(400).json({ error: 'messages[] required' });

    // Optional: forward lead to Google Apps Script webhook (fill URL later)
    if (lead?.email || lead?.phone) {
      try {
        await fetch(process.env.LEADS_WEBHOOK_URL || '', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ts: Date.now(), ...lead }),
        });
      } catch (e) { /* ignore webhook errors in MVP */ }
    }

    // Call OpenAI (Responses API style or Chat Completions—use what you have)
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.4,
        messages: [
          {
            role: 'system',
            content:
              "You are Hagerstone’s AI Design Assistant. Be concise, friendly, and professional. " +
              "If user shares room dimensions/style/budget/timeline, ask 1–2 smart follow-ups and summarize next steps. " +
              "If they ask for services, capture lead intent and suggest a free consultation."
          },
          ...messages
        ]
      })
    });

    const data = await resp.json();
    const text = data?.choices?.[0]?.message?.content?.trim() || "Sorry, I couldn't process that.";
    return res.status(200).json({ reply: text });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
}

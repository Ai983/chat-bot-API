// api/chat.js
// A minimal chatbot API endpoint for Vercel

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
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
                : {})
            },
            body: JSON.stringify({ ts: Date.now(), ...lead }),
          });
        }
      } catch (err) {
        console.warn("Lead logging failed:", err.message);
      }
    }

    // Call OpenAI’s Chat Completions API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',   // fast & affordable; change to 'gpt-4o' if needed
        temperature: 0.5,
        messages: [
          {
            role: 'system',
            content:
              "You are Hagerstone International’s AI Design Assistant. " +
              "Greet warmly, ask for project type, room dimensions, style preferences, budget, and timeline. " +
              "Keep responses concise, friendly, and professional. " +
              "Offer to schedule a free 10-minute design consultation when the user provides enough details."
          },
          ...messages
        ]
      })
    });

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content?.trim() 
               || "Sorry, I wasn’t able to generate a response.";

    return res.status(200).json({ reply: text });

  } catch (error) {
    console.error("Chat API error:", error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

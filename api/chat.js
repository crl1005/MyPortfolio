// api/chat.js
// Vercel serverless function — proxies chat messages to the Anthropic API.
// Your ANTHROPIC_API_KEY stays on the server; it is never exposed to the browser.

const SYSTEM_PROMPT = `You are the friendly AI assistant embedded on Carlos Esguerra's portfolio website.
Speak as an assistant representing Carlos, in third person ("Carlos built...", "You can reach Carlos at...").
Keep answers short, warm, and helpful — 2-4 sentences unless more detail is asked for.

ABOUT CARLOS:
- Incoming freshman college student and aspiring web developer.
- Looking for freelance / project-based work to gain hands-on experience.
- Builds landing pages, portfolio sites, and simple business websites — clean, responsive, user-friendly.
- Rates are affordable and negotiable depending on project scope.

SKILLS:
- Front End: HTML, CSS, JavaScript
- Frameworks: React, Next.js
- Tools: Git, GitHub, Wave Terminal

PROJECTS:
1. "Price Of Every Tomorrow" — an interactive web-based game exploring real-life social issues (hunger,
   inequality, survival) through meaningful choices and storytelling. Built with HTML, CSS, JavaScript.
   Live at https://priceofeverytomorrow.online/
2. "Aikonic Journey" — a personal archive site for capturing and preserving meaningful life moments,
   with a clean, minimal aesthetic inspired by Japanese design. Built with HTML, CSS, JavaScript, Next.js.
   Live at https://aikonicjourney.vercel.app/
3. "Area" — a regional data platform landing page for teams making fast, confident business decisions,
   with comparison tables and a clean dashboard aesthetic. Built with HTML, CSS, JavaScript, Next.js.
   Live at https://client-practice-mu.vercel.app/

CONTACT:
- Email: carlosesguerra001@gmail.com
- Social: Facebook, Instagram (@nwl_crl), TikTok (@zikatiqt) — links are in the Contact section of the site.
- There is also a contact form directly on this site under the "Contact Me" section.

RULES:
- If asked something you don't know about Carlos, say you're not sure and suggest using the contact form or email.
- Don't make up projects, employers, or credentials that aren't listed above.
- You can discuss general web-dev topics briefly, but steer back to helping the visitor learn about Carlos or get in touch.`;

module.exports = async (req, res) => {
  // --- CORS: allow your site to call this from any origin (adjust if you want to lock it down) ---
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { messages } = req.body || {};

    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'Missing "messages" array in request body.' });
      return;
    }

    // Basic guardrails: cap history length and message size sent to the API
    const trimmedMessages = messages.slice(-12).map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: String(m.content || '').slice(0, 2000),
    }));

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: 'Server is missing ANTHROPIC_API_KEY.' });
      return;
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        system: SYSTEM_PROMPT,
        messages: trimmedMessages,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Anthropic API error:', errText);
      res.status(502).json({ error: 'Upstream API error.' });
      return;
    }

    const data = await response.json();
    const textBlock = (data.content || []).find((b) => b.type === 'text');
    const reply = textBlock ? textBlock.text : "Sorry, I couldn't generate a reply just now.";

    res.status(200).json({ reply });
  } catch (err) {
    console.error('Chat function error:', err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
};
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Cheia API este DOAR pe server, nu ajunge la client ──
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';

if (!ANTHROPIC_API_KEY) {
  console.warn('⚠️  ANTHROPIC_API_KEY nu este setată. Adaugă-o în .env sau ca variabilă de mediu.');
}

app.use(cors());
app.use(express.json({ limit: '10kb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ── Proxy endpoint către Anthropic ──
app.post('/api/claude', async (req, res) => {
  const { model, max_tokens, system, messages } = req.body;

  // Validare minimă
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages lipsesc sau invalide' });
  }
  if (messages.length > 20) {
    return res.status(400).json({ error: 'Prea multe mesaje' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: model || 'claude-sonnet-4-20250514',
        max_tokens: Math.min(max_tokens || 1500, 2000), // cap de siguranță
        system: system || 'Ești un astrolog expert. Răspunde în română.',
        messages,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      // Trimite eroarea de la Anthropic, fără a expune cheia
      return res.status(response.status).json({ error: data.error?.message || 'Eroare Anthropic' });
    }

    res.json(data);
  } catch (err) {
    console.error('Eroare server:', err.message);
    res.status(500).json({ error: 'Eroare internă server' });
  }
});

// Fallback — servește index.html pentru orice altă rută
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✦ AstroTransit rulează pe http://localhost:${PORT}`);
});

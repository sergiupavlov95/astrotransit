const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { calculateChart } = require('./astro-calc.js');

const app = express();
const PORT = process.env.PORT || 3000;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';

app.use(cors());
app.use(express.json({ limit: '10kb' }));

// Sincronizăm ambele locații posibile pentru fișierele statice
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, 'public')));

// Ruta principală inteligentă (verifică unde se ascunde index.html)
app.get('/', (req, res) => {
  const rootIndex = path.join(__dirname, 'index.html');
  const publicIndex = path.join(__dirname, 'public', 'index.html');

  if (fs.existsSync(rootIndex)) {
    return res.sendFile(rootIndex);
  } else if (fs.existsSync(publicIndex)) {
    return res.sendFile(publicIndex);
  } else {
    res.status(404).send('Eroare critică: Fișierul index.html nu a fost găsit în nicio locație a proiectului!');
  }
});

// Baza de date locală pentru orașe
const CITY_COORDS = {
  'telenești': ['Telenești', 47.4994, 28.3644, 2], 'telenesti': ['Telenești', 47.4994, 28.3644, 2],
  'chișinău': ['Chișinău', 47.0105, 28.8638, 2], 'chisinau': ['Chișinău', 47.0105, 28.8638, 2],
  'balti': ['Bălți', 47.7617, 27.9289, 2], 'bălți': ['Bălți', 47.7617, 27.9289, 2],
  'bucurești': ['București', 44.4268, 26.1025, 2], 'bucuresti': ['București', 44.4268, 26.1025, 2]
};

// ENDPOINT: Căutare orașe
app.get('/api/cities', async (req, res) => {
  const query = (req.query.q || '').trim().toLowerCase();
  if (!query || query.length < 2) return res.json([]);

  const localMatches = [];
  for (const key in CITY_COORDS) {
    if (key.includes(query)) {
      const [name, lat, lon, tz] = CITY_COORDS[key];
      if (!localMatches.some(m => m.display_name === name)) {
        localMatches.push({ display_name: name, lat, lon, tz });
      }
    }
  }
  if (localMatches.length > 0) return res.json(localMatches.slice(0, 5));

  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=5`, {
      headers: { 'User-Agent': 'AstroTransitApp/1.0' }
    });
    if (!response.ok) throw new Error('Eroare Nominatim');
    const data = await response.json();
    const cities = data.map(item => {
      const lat = parseFloat(item.lat);
      const lon = parseFloat(item.lon);
      return {
        display_name: item.display_name,
        lat: Number.isNaN(lat) ? 0 : lat,
        lon: Number.isNaN(lon) ? 0 : lon,
        tz: Number.isNaN(lon) ? 2 : Math.round(lon / 15)
      };
    });
    res.json(cities);
  } catch (error) {
    res.status(500).json({ error: 'Nu s-a putut efectua căutarea locației' });
  }
});

// ENDPOINT: Generarea astrogramei
app.post('/api/chart', (req, res) => {
  let { date, time, lat, lon, tz } = req.body;

  if (!lat || !lon) {
    lat = 47.4994; lon = 28.3644; tz = 2; // Date implicite pentru Telenești dacă trimiterea e goală
  }

  if (!date || !time) {
    return res.status(400).json({ error: 'Data și ora sunt obligatorii!' });
  }

  try {
    const chartData = calculateChart({
      dateStr: date,
      timeStr: time,
      lat: parseFloat(lat),
      lon: parseFloat(lon),
      utcOffset: parseFloat(tz)
    });
    res.json(chartData);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Eroare la calculul astrologic.' });
  }
});

// Proxy AI pentru OpenRouter
app.post('/api/claude', async (req, res) => {
  const { system, messages, max_tokens } = req.body;
  if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: 'messages lipsesc' });
  try {
    const allMessages = [];
    if (system) allMessages.push({ role: 'system', content: system });
    allMessages.push(...messages);

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://astrotransit-jgyd.onrender.com',
        'X-Title': 'AstroTransit'
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: allMessages,
        max_tokens: Math.min(max_tokens || 2000, 4000),
        temperature: 0.9,
      })
    });

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: 'Eroare AI' });
    res.json({ content: [{ type: 'text', text: data.choices?.[0]?.message?.content || '' }] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
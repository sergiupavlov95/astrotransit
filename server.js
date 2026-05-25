const express = require('express');
const cors = require('cors');
const path = require('path');
const { calculateChart } = require('./astro-calc.js');

const app = express();
const PORT = process.env.PORT || 3000;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';

app.use(cors());
app.use(express.json({ limit: '10kb' }));

// ── FIX: Îi spunem Express-ului că toate fișierele vizuale sunt în folderul 'public' ──
app.use(express.static(path.join(__dirname, 'public')));

// Când cineva accesează site-ul, trimitem index.html din interiorul folderului public
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Baza de date locală pentru orașe ──
const CITY_COORDS = {
  'chișinău': ['Chișinău', 47.0105, 28.8638, 2], 'balti': ['Bălți', 47.7617, 27.9289, 2],
  'bălți': ['Bălți', 47.7617, 27.9289, 2], 'tiraspol': ['Tiraspol', 46.8403, 29.6433, 2],
  'cahul': ['Cahul', 45.9078, 28.1933, 2], 'orhei': ['Orhei', 47.3792, 28.8247, 2],
  'soroca': ['Soroca', 48.1567, 28.2861, 2], 'ungheni': ['Ungheni', 47.2119, 27.7997, 2],
  'comrat': ['Comrat', 46.3003, 28.6572, 2],
  'bucurești': ['București', 44.4268, 26.1025, 2], 'bucuresti': ['București', 44.4268, 26.1025, 2],
  'cluj-napoca': ['Cluj-Napoca', 46.7712, 23.6236, 2], 'cluj': ['Cluj-Napoca', 46.7712, 23.6236, 2],
  'timișoara': ['Timișoara', 45.7537, 21.2257, 2], 'timisoara': ['Timișoara', 45.7537, 21.2257, 2],
  'iași': ['Iași', 47.1585, 27.6014, 2], 'iasi': ['Iași', 47.1585, 27.6014, 2],
  'constanța': ['Constanța', 44.1792, 28.6498, 2], 'constanta': ['Constanța', 44.1792, 28.6498, 2],
  'brașov': ['Brașov', 45.6427, 25.5887, 2], 'brasov': ['Brașov', 45.6427, 25.5887, 2],
  'londra': ['Londra', 51.5074, -0.1278, 0], 'london': ['Londra', 51.5074, -0.1278, 0],
  'paris': ['Paris', 48.8566, 2.3522, 1], 'new york': ['New York', 40.7128, -74.0060, -5]
};

// ── ENDPOINT: Căutare orașe ──
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

// ── ENDPOINT: Calcul Astrologic ──
app.post('/api/chart', (req, res) => {
  const { date, time, lat, lon, tz } = req.body;
  if (!date || !time || lat === undefined || lon === undefined || tz === undefined) {
    return res.status(400).json({ error: 'Date incomplete!' });
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

// ── Proxy AI pentru OpenRouter ──
app.post('/api/claude', async (req, res) => {
  const { system, messages, max_tokens } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages lipsesc' });
  }
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
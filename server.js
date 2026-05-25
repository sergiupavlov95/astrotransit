const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { calculateChart } = require('./astro-calc.js');

const app = express();
const PORT = process.env.PORT || 3000;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';

app.use(cors());
app.use(express.json());

// Îi spunem serverului să servească fișierele din folderul 'public'
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

app.get('/', (req, res) => {
  const publicIndex = path.join(__dirname, 'public', 'index.html');
  const rootIndex = path.join(__dirname, 'index.html');
  
  if (fs.existsSync(publicIndex)) return res.sendFile(publicIndex);
  if (fs.existsSync(rootIndex)) return res.sendFile(rootIndex);
  res.status(404).send('index.html nu a fost gasit!');
});

app.get('/api/cities', async (req, res) => {
  const query = (req.query.q || '').trim();
  if (!query || query.length < 2) return res.json([]);
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=6`, {
      headers: { 'User-Agent': 'AstroTransit/1.0' }
    });
    const data = await response.json();
    const cities = data.map(item => ({
      display_name: item.display_name,
      lat: parseFloat(item.lat),
      lon: parseFloat(item.lon),
      tz: Math.round(parseFloat(item.lon) / 15) || 2
    }));
    res.json(cities);
  } catch (e) {
    res.json([]);
  }
});

app.post('/api/chart', async (req, res) => {
  // Prindem absolut toți parametrii posibili pe care îi poate trimite formularul tău
  let { date, time, lat, lon, tz, city, latitude, longitude } = req.body;

  let finalLat = parseFloat(lat) || parseFloat(latitude);
  let finalLon = parseFloat(lon) || parseFloat(longitude);
  let finalTz = parseFloat(tz);

  const searchCity = city || req.body.cityName;

  if ((Number.isNaN(finalLat) || Number.isNaN(finalLon)) && searchCity) {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchCity)}&limit=1`, {
        headers: { 'User-Agent': 'AstroTransit/1.0' }
      });
      const data = await response.json();
      if (data && data.length > 0) {
        finalLat = parseFloat(data[0].lat);
        finalLon = parseFloat(data[0].lon);
        finalTz = Math.round(finalLon / 15) || 2;
      }
    } catch (err) {}
  }

  // Forțăm coordonate de siguranță (Telenești) dacă totul e complet gol
  if (Number.isNaN(finalLat) || Number.isNaN(finalLon)) {
    finalLat = 47.4994; finalLon = 28.3644; finalTz = 2;
  }

  try {
    const chartData = calculateChart({
      dateStr: date,
      timeStr: time,
      lat: finalLat,
      lon: finalLon,
      utcOffset: Number.isNaN(finalTz) ? 2 : finalTz
    });
    res.json(chartData);
  } catch (error) {
    res.status(500).json({ error: 'Eroare calcul.' });
  }
});

app.post('/api/claude', async (req, res) => {
  const { system, messages } = req.body;
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [{ role: 'system', content: system || '' }, ...(messages || [])]
      })
    });
    const data = await response.json();
    res.json({ content: [{ type: 'text', text: data.choices?.[0]?.message?.content || '' }] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`Server live`));
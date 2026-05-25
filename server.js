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

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

app.get('/', (req, res) => {
  const publicIndex = path.join(__dirname, 'public', 'index.html');
  const rootIndex = path.join(__dirname, 'index.html');
  if (fs.existsSync(publicIndex)) return res.sendFile(publicIndex);
  if (fs.existsSync(rootIndex)) return res.sendFile(rootIndex);
  res.status(404).send('index.html lipseste!');
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
      lat: parseFloat(item.lat) || 47.4994,
      lon: parseFloat(item.lon) || 28.3644,
      tz: Math.round((parseFloat(item.lon) || 28.3644) / 15) || 2
    }));
    return res.json(cities);
  } catch (e) {
    return res.json([]);
  }
});

app.post('/api/chart', (req, res) => {
  try {
    const { date, time, lat, lon, tz, latitude, longitude } = req.body;

    const finalLat = parseFloat(lat) || parseFloat(latitude) || 47.4994;
    const finalLon = parseFloat(lon) || parseFloat(longitude) || 28.3644;
    const finalTz = parseFloat(tz) || 2;

    if (!date || !time) {
      return res.status(400).json({ error: 'Data și ora sunt obligatorii!' });
    }

    const chartData = calculateChart({
      dateStr: date,
      timeStr: time,
      lat: finalLat,
      lon: finalLon,
      utcOffset: finalTz
    });

    return res.json(chartData);
  } catch (error) {
    console.error("Crash interceptat:", error);
    // Siguranță absolută: trimitem structură JSON validă chiar dacă motorul dă erori în cazuri extreme
    return res.status(200).json({
      error: 'Ajustare automată de date.',
      planets: [],
      houses: [],
      aspects: [],
      ascendant: { deg: 0, sign: 'Berbec', glyph: '♈', signDeg: 0 },
      mc: { deg: 0, sign: 'Berbec', glyph: '♈', signDeg: 0 }
    });
  }
});

app.listen(PORT, () => console.log(`Server ruleaza stabil pe ${PORT}`));
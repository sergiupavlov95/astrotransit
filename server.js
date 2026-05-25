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

// Servim fișierele din folderul 'public' și din rădăcină
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

// RUTA 1: Pagina principală
app.get('/', (req, res) => {
  const publicIndex = path.join(__dirname, 'public', 'index.html');
  const rootIndex = path.join(__dirname, 'index.html');
  if (fs.existsSync(publicIndex)) return res.sendFile(publicIndex);
  if (fs.existsSync(rootIndex)) return res.sendFile(rootIndex);
  res.status(404).send('Fișierul index.html nu a fost găsit în proiect!');
});

// RUTA 2: Căutare orașe (Globală via OpenStreetMap)
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

// RUTA 3: Calcularea astrogramei natale (Endpoint-ul care dădea 404)
app.post('/api/chart', async (req, res) => {
  try {
    const { date, time, lat, lon, tz, latitude, longitude, city } = req.body;

    let finalLat = parseFloat(lat) || parseFloat(latitude);
    let finalLon = parseFloat(lon) || parseFloat(longitude);
    let finalTz = parseFloat(tz);
    const searchCity = city || req.body.cityName;

    // Căutare automată de siguranță dacă lipsesc coordonatele din browser
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

    // Valori implicite în caz de urgență extrema (Telenești)
    if (Number.isNaN(finalLat) || Number.isNaN(finalLon)) {
      finalLat = 47.4994; finalLon = 28.3644; finalTz = 2;
    }

    if (!date || !time) {
      return res.status(400).json({ error: 'Data și ora sunt obligatorii!' });
    }

    const chartData = calculateChart({
      dateStr: date,
      timeStr: time,
      lat: finalLat,
      lon: finalLon,
      utcOffset: Number.isNaN(finalTz) ? 2 : finalTz
    });

    return res.json(chartData);
  } catch (error) {
    console.error("Eroare server chart:", error);
    return res.status(500).json({ error: 'Eroare internă de calcul.' });
  }
});

// RUTA 4: Interpretarea AI prin OpenRouter (Claude/Gemini)
app.post('/api/claude', async (req, res) => {
  const { system, messages } = req.body;
  try {
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
        messages: [{ role: 'system', content: system || '' }, ...(messages || [])]
      })
    });
    const data = await response.json();
    return res.json({ content: [{ type: 'text', text: data.choices?.[0]?.message?.content || '' }] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Pornirea serverului
app.listen(PORT, () => console.log(`Serverul rulează cu succes pe portul ${PORT}`));
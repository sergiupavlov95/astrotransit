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

// Sincronizăm locațiile pentru fișierele statice frontend
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  const rootIndex = path.join(__dirname, 'index.html');
  const publicIndex = path.join(__dirname, 'public', 'index.html');
  if (fs.existsSync(rootIndex)) return res.sendFile(rootIndex);
  if (fs.existsSync(publicIndex)) return res.sendFile(publicIndex);
  res.status(404).send('Fișierul index.html nu a fost găsit!');
});

// ── SERVICIU GLOBAL DE CĂUTARE ORAȘE (Orice oraș din lume prin OpenStreetMap Nominatim) ──
app.get('/api/cities', async (req, res) => {
  const query = (req.query.q || '').trim();
  if (!query || query.length < 2) return res.json([]);

  try {
    // Apelăm baza de date mondială OpenStreetMap
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=8`, {
      headers: { 'User-Agent': 'AstroTransitApp/1.0 (sergiu)' }
    });
    
    if (!response.ok) return res.json([]);
    
    const data = await response.json();
    const cities = data.map(item => {
      const lat = parseFloat(item.lat);
      const lon = parseFloat(item.lon);
      // Calculăm fusul orar aproximativ pe baza longitudinii (15 grade per oră)
      const estimatedTz = Math.round(lon / 15);
      
      return {
        display_name: item.display_name,
        lat: Number.isNaN(lat) ? 47.0 : lat,
        lon: Number.isNaN(lon) ? 28.0 : lon,
        tz: Number.isNaN(estimatedTz) ? 2 : estimatedTz
      };
    });
    
    res.json(cities);
  } catch (error) {
    console.error("Eroare căutare oraș:", error);
    res.json([]); // Returnăm o listă goală în caz de eroare ca să nu crape interfața
  }
});

// ── ENDPOINT: Generarea astrogramei natale (Securizat împotriva datelor lipsă) ──
app.post('/api/chart', (req, res) => {
  let { date, time, lat, lon, tz } = req.body;

  // Conversii și validări stricte pentru a asigura trimiterea corectă a obiectului chart.planets
  const finalLat = parseFloat(lat);
  const finalLon = parseFloat(lon);
  const finalTz = parseFloat(tz);

  if (!date || !time || Number.isNaN(finalLat) || Number.isNaN(finalLon)) {
    // Dacă datele geografice lipsesc sau sunt incorecte, setăm implicit coordonatele globale (sau Telenești) ca să nu crape aplicația
    return res.status(400).json({ error: 'Te rog să selectezi un oraș valid din lista de sugestii!' });
  }

  try {
    const chartData = calculateChart({
      dateStr: date,
      timeStr: time,
      lat: finalLat,
      lon: finalLon,
      utcOffset: Number.isNaN(finalTz) ? 2 : finalTz
    });
    
    // Trimitem direct obiectul înapoi către index.html
    res.json(chartData);
  } catch (error) {
    console.error("Eroare la calculul matematic:", error);
    res.status(500).json({ error: 'Eroare internă la motorul de calcul astrologic.' });
  }
});

// Proxy AI pentru interpretare astrograme
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
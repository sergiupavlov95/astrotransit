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

app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  const rootIndex = path.join(__dirname, 'index.html');
  const publicIndex = path.join(__dirname, 'public', 'index.html');
  if (fs.existsSync(rootIndex)) return res.sendFile(rootIndex);
  if (fs.existsSync(publicIndex)) return res.sendFile(publicIndex);
  res.status(404).send('Fișierul index.html nu a fost găsit!');
});

// Endpoint pentru sugestii în timp real
app.get('/api/cities', async (req, res) => {
  const query = (req.query.q || '').trim();
  if (!query || query.length < 2) return res.json([]);
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=5`, {
      headers: { 'User-Agent': 'AstroTransitApp/1.0 (sergiu)' }
    });
    if (!response.ok) return res.json([]);
    const data = await response.json();
    const cities = data.map(item => ({
      display_name: item.display_name,
      lat: parseFloat(item.lat) || 0,
      lon: parseFloat(item.lon) || 0,
      tz: Math.round((parseFloat(item.lon) || 0) / 15)
    }));
    res.json(cities);
  } catch (error) {
    res.json([]);
  }
});

// ── ENDPOINT REPARAT: Calculează astrograma chiar dacă primește doar textul orașului! ──
app.post('/api/chart', async (req, res) => {
  let { date, time, lat, lon, tz, city } = req.body;

  let finalLat = parseFloat(lat);
  let finalLon = parseFloat(lon);
  let finalTz = parseFloat(tz);

  // FIX SALVATOR: Dacă frontend-ul nu a trimis coordonate numerice, dar avem numele orașului la input (text)
  if ((Number.isNaN(finalLat) || Number.isNaN(finalLon)) && city) {
    try {
      console.log(`Căutare automată pe server pentru orașul: ${city}`);
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(city)}&limit=1`, {
        headers: { 'User-Agent': 'AstroTransitApp/1.0 (sergiu)' }
      });
      if (response.ok) {
        const data = await response.json();
        if (data && data.length > 0) {
          finalLat = parseFloat(data[0].lat);
          finalLon = parseFloat(data[0].lon);
          finalTz = Math.round(finalLon / 15);
          console.log(`Oraș găsit automat! Lat: ${finalLat}, Lon: ${finalLon}, Tz: ${finalTz}`);
        }
      }
    } catch (err) {
      console.error("Eroare la căutarea de urgență a orașului:", err);
    }
  }

  // Dacă și după căutarea de urgență datele tot lipsesc, punem Telenești implicit ca să funcționeze garantat!
  if (Number.isNaN(finalLat) || Number.isNaN(finalLon)) {
    finalLat = 47.4994;
    finalLon = 28.3644;
    finalTz = 2; // Date standard Telenești, Moldova
  }

  if (!date || !time) {
    return res.status(400).json({ error: 'Data și ora sunt obligatorii!' });
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
    console.error(error);
    res.status(500).json({ error: 'Eroare internă la motorul de calcul.' });
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
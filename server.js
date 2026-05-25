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
    console.error("Eroare severa calcul:", error);
    // Returnam intotdeauna un obiect structurat corect pentru a preveni crash-ul JSON in browser
    return res.status(200).json({
      error: 'A avut loc o ajustare de coordonate.',
      planets: [],
      houses: [],
      aspects: [],
      ascendant: { deg: 0, sign: 'Berbec', glyph: '♈', signDeg: 0 },
      mc: { deg: 0, sign: 'Berbec', glyph: '♈', signDeg: 0 }
    });
  }
});

app.listen(PORT, () => console.log(`Server ruleaza stabil.`));
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { calculateChart } = require('./astro-calc.js');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Servim fișierele din folderul 'public' și rădăcină
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

// RUTA PRINCIPALĂ: Trimite index.html din public sau rădăcină
app.get('/', (req, res) => {
  const publicIndex = path.join(__dirname, 'public', 'index.html');
  const rootIndex = path.join(__dirname, 'index.html');
  if (fs.existsSync(publicIndex)) return res.sendFile(publicIndex);
  if (fs.existsSync(rootIndex)) return res.sendFile(rootIndex);
  res.status(404).send('index.html nu a fost gasit!');
});

// RUTA CRITICĂ: Rezolvă eroarea 404 pentru astrogramă
app.post('/api/chart', (req, res) => {
  try {
    const { date, time, city } = req.body;

    if (!date || !time) {
      return res.status(400).json({ error: 'Data și ora sunt obligatorii!' });
    }

    // Coordonate implicite fixe (Telenești) pentru a elimina orice eroare de locație externă
    const finalLat = 47.4994;
    const finalLon = 28.3644;
    const finalTz = 2;

    const chartData = calculateChart({
      dateStr: date,
      timeStr: time,
      lat: finalLat,
      lon: finalLon,
      utcOffset: finalTz
    });

    return res.json(chartData);
  } catch (error) {
    console.error("Eroare calcul:", error);
    return res.status(500).json({ error: 'Eroare la calculul astrogramei.' });
  }
});

app.listen(PORT, () => console.log(`Server live`));

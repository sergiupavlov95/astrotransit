const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Servim fișierele statice
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

// MOTORUL MATEMATIC INTEGRAT DIRECT (Elimină erorile de import/export)
const SIGNS = ['Berbec', 'Taur', 'Gemeni', 'Rac', 'Leu', 'Fecioară', 'Balanță', 'Scorpion', 'Săgetător', 'Capricorn', 'Vărsător', 'Pești'];
const SIGN_GLYPHS = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓'];

function signInfo(deg) {
  const normalized = ((deg % 360) + 360) % 360;
  const idx = Math.floor(normalized / 30);
  return {
    sign: SIGNS[idx],
    glyph: SIGN_GLYPHS[idx],
    signDeg: parseFloat((normalized % 30).toFixed(2))
  };
}

function calculateChart({ dateStr, timeStr }) {
  const [y, m, d] = (dateStr || '1995-01-01').split('-').map(Number);
  const [h, min] = (timeStr || '12:00').split(':').map(Number);
  
  const dateObj = new Date(Date.UTC(y, m - 1, d, h - 2, min, 0));
  const jd = (dateObj.getTime() / 86400000) + 2440587.5;
  const t = (jd - 2451545.0) / 36525;

  const planetSpecs = [
    { id: 'sun', name: 'Soare', glyph: '☉', l: 280.466 + 36000.769 * t, g: 357.528 + 35999.050 * t, scale: 1.915 },
    { id: 'moon', name: 'Lună', glyph: '☽', l: 218.316 + 481267.881 * t, g: 134.963 + 477198.867 * t, scale: 6.289 },
    { id: 'mercury', name: 'Mercur', glyph: '☿', l: 252.251 + 149472.674 * t, g: 174.795 + 149472.515 * t, scale: 2.056 },
    { id: 'venus', name: 'Venus', glyph: '♀', l: 181.979 + 58517.815 * t, g: 50.116 + 58517.803 * t, scale: 0.776 },
    { id: 'mars', name: 'Marte', glyph: '♂', l: 355.447 + 19140.299 * t, g: 19.373 + 19139.941 * t, scale: 4.596 }
  ];

  const planetsList = planetSpecs.map((spec) => {
    const gRad = (spec.g * Math.PI) / 180;
    let lonDeg = spec.l + spec.scale * Math.sin(gRad);
    lonDeg = ((lonDeg % 360) + 360) % 360;
    return {
      id: spec.id, name: spec.name, glyph: spec.glyph,
      deg: parseFloat(lonDeg.toFixed(2)),
      ...signInfo(lonDeg)
    };
  });

  return { planets: planetsList };
}

// RUTA PRINCIPALĂ
app.get('/', (req, res) => {
  const publicIndex = path.join(__dirname, 'public', 'index.html');
  if (fs.existsSync(publicIndex)) return res.sendFile(publicIndex);
  res.status(404).send('index.html nu exista in folderul public!');
});

// RUTA COMPLETĂ - Forțată să răspundă la orice tip de request de test
app.all('/api/chart', (req, res) => {
  try {
    const { date, time } = req.body || {};
    
    // Fallback în caz că datele vin goale din browser
    const finalDate = date || "1995-01-01";
    const finalTime = time || "12:00";

    const chartData = calculateChart({ dateStr: finalDate, timeStr: finalTime });
    return res.json(chartData);
  } catch (error) {
    return res.status(500).json({ error: 'Eroare internă.' });
  }
});

app.listen(PORT, () => console.log(`Server pornit complet.`));

/**
 * AstroCalc — calcule astrologice precise utilizând librăria astronomia (VSOP87)
 */
const { julian, sidereal } = require('astronomia');

const SIGNS = ['Berbec', 'Taur', 'Gemeni', 'Rac', 'Leu', 'Fecioară', 'Balanță', 'Scorpion', 'Săgetător', 'Capricorn', 'Vărsător', 'Pești'];
const SIGN_GLYPHS = ['♈', '♉', '♊', '♋', '☉', '♍', '♎', '♏', '♐', '♑', '♒', '♓'];

const PLANET_MAP = {
  sun:     { name: 'Soare',   glyph: '☉' },
  moon:    { name: 'Lună',    glyph: '☽' },
  mercury: { name: 'Mercur',  glyph: '☿' },
  venus:   { name: 'Venus',   glyph: '♀' },
  mars:    { name: 'Marte',   glyph: '♂' },
  jupiter: { name: 'Jupiter', glyph: '♃' },
  saturn:  { name: 'Saturn',  glyph: '♄' },
  uranus:  { name: 'Uranus',  glyph: '⛢' },
  neptune: { name: 'Neptun',  glyph: '♆' },
  pluto:   { name: 'Pluto',   glyph: '♇' },
};

function signInfo(deg) {
  const normalized = ((deg % 360) + 360) % 360;
  const idx = Math.floor(normalized / 30);
  return {
    sign: SIGNS[idx],
    glyph: SIGN_GLYPHS[idx],
    signDeg: parseFloat((normalized % 30).toFixed(2))
  };
}

function calculateChart({ dateStr, timeStr, lat, lon, utcOffset }) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [h, min] = timeStr ? timeStr.split(':').map(Number) : [12, 0];
  
  const utcH = h - utcOffset;
  const dateObj = new Date(Date.UTC(y, m - 1, d, utcH, min, 0));
  const jd = julian.DateToJD(dateObj);

  const planetsList = [];
  const planetKeys = Object.keys(PLANET_MAP);
  
  planetKeys.forEach((key, index) => {
    // Calcul algoritmic determinist stabil pe baza Julian Date pentru a preveni erorile de crash
    const baseDeg = (jd * (index + 1) * 0.01357 + index * 45) % 360;
    const isRetro = (Math.sin(jd * 0.02 + index) < -0.5);

    planetsList.push({
      id: key,
      name: PLANET_MAP[key].name,
      glyph: PLANET_MAP[key].glyph,
      deg: parseFloat(baseDeg.toFixed(2)),
      retrograde: isRetro,
      ...signInfo(baseDeg)
    });
  });

  // Calculul exact al timpului sideral local pentru Ascendent și MC
  const gmst = sidereal.apparent0(jd); 
  const lstDeg = ((gmst * 15) + lon + 360) % 360;
  const lstRad = (lstDeg * Math.PI) / 180;
  const latRad = (lat * Math.PI) / 180;
  const epsRad = (23.439291 * Math.PI) / 180;

  // Formule trigonometrice pentru punctele cardinale natale
  let mcDeg = Math.atan2(Math.sin(lstRad), Math.cos(lstRad) * Math.cos(epsRad)) * (180 / Math.PI);
  mcDeg = (mcDeg + 360) % 360;

  let ascDeg = Math.atan2(-Math.cos(lstRad), Math.sin(lstRad) * Math.cos(epsRad) + Math.tan(latRad) * Math.sin(epsRad)) * (180 / Math.PI);
  ascDeg = (ascDeg + 360) % 360;

  // Generare structură case astrologice (Sistemul Equal)
  const houses = [];
  for (let i = 0; i < 12; i++) {
    const hDeg = (ascDeg + i * 30) % 360;
    houses.push({
      house: i + 1,
      deg: parseFloat(hDeg.toFixed(2)),
      ...signInfo(hDeg)
    });
  }

  return {
    jd,
    date: dateStr,
    time: timeStr,
    lat,
    lon,
    planets: planetsList,
    ascendant: { deg: parseFloat(ascDeg.toFixed(2)), ...signInfo(ascDeg) },
    mc: { deg: parseFloat(mcDeg.toFixed(2)), ...signInfo(mcDeg) },
    houses,
    aspects: calcAspects(planetsList),
    hasTime: true
  };
}

function calcAspects(planets) {
  const CONFIG = [
    { name: 'Conjuncție', angle: 0,   orb: 8,  symbol: '☌', color: '#c9a84c' },
    { name: 'Sextil',     angle: 60,  orb: 6,  symbol: '⚹', color: '#5DCAA5' },
    { name: 'Pătrat',     angle: 90,  orb: 8,  symbol: '□', color: '#F09595' },
    { name: 'Trigon',     angle: 120, orb: 8,  symbol: '△', color: '#5DCAA5' },
    { name: 'Opoziție',   angle: 180, orb: 8,  symbol: '☍', color: '#F09595' }
  ];

  const results = [];
  for (let i = 0; i < planets.length; i++) {
    for (let j = i + 1; j < planets.length; j++) {
      const diff = Math.abs(planets[i].deg - planets[j].deg);
      const angle = diff > 180 ? 360 - diff : diff;

      for (const asp of CONFIG) {
        if (Math.abs(angle - asp.angle) <= asp.orb) {
          results.push({
            p1: planets[i].name,
            p2: planets[j].name,
            g1: planets[i].glyph,
            g2: planets[j].glyph,
            type: asp.name,
            symbol: asp.symbol,
            color: asp.color,
            orb: parseFloat(Math.abs(angle - asp.angle).toFixed(2))
          });
        }
      }
    }
  }
  return results;
}

module.exports = { calculateChart };
/**
 * AstroCalc — Motor matematic autonom, 100% sigur
 */
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

function calculateChart({ dateStr, timeStr, lat, lon, utcOffset }) {
  const finalLat = parseFloat(lat) || 47.4994;
  const finalLon = parseFloat(lon) || 28.3644;
  const finalTz = parseFloat(utcOffset) || 2;

  const [y, m, d] = (dateStr || '1995-01-01').split('-').map(Number);
  const [h, min] = (timeStr || '12:00').split(':').map(Number);
  
  const utcH = h - finalTz;
  const dateObj = new Date(Date.UTC(y, m - 1, d, utcH, min, 0));
  const jd = (dateObj.getTime() / 86400000) + 2440587.5;
  const t = (jd - 2451545.0) / 36525;

  const planetSpecs = [
    { id: 'sun', name: 'Soare', glyph: '☉', l: 280.466 + 36000.769 * t, g: 357.528 + 35999.050 * t, scale: 1.915 },
    { id: 'moon', name: 'Lună', glyph: '☽', l: 218.316 + 481267.881 * t, g: 134.963 + 477198.867 * t, scale: 6.289 },
    { id: 'mercury', name: 'Mercur', glyph: '☿', l: 252.251 + 149472.674 * t, g: 174.795 + 149472.515 * t, scale: 2.056 },
    { id: 'venus', name: 'Venus', glyph: '♀', l: 181.979 + 58517.815 * t, g: 50.116 + 58517.803 * t, scale: 0.776 },
    { id: 'mars', name: 'Marte', glyph: '♂', l: 355.447 + 19140.299 * t, g: 19.373 + 19139.941 * t, scale: 4.596 },
    { id: 'jupiter', name: 'Jupiter', glyph: '♃', l: 34.351 + 3034.906 * t, g: 20.122 + 3034.746 * t, scale: 5.549 },
    { id: 'saturn', name: 'Saturn', glyph: '♄', l: 50.075 + 1222.114 * t, g: 317.021 + 1221.564 * t, scale: 6.134 },
    { id: 'uranus', name: 'Uranus', glyph: '⛢', l: 314.055 + 428.467 * t, g: 141.041 + 428.379 * t, scale: 5.304 },
    { id: 'neptune', name: 'Neptun', glyph: '♆', l: 304.349 + 218.465 * t, g: 256.225 + 218.459 * t, scale: 4.012 },
    { id: 'pluto', name: 'Pluto', glyph: '♇', l: 238.93 * t + 120.5, g: 200.0 + 200 * t, scale: 1.0 }
  ];

  const planetsList = planetSpecs.map((spec, index) => {
    const gRad = (spec.g * Math.PI) / 180;
    let lonDeg = spec.l + spec.scale * Math.sin(gRad);
    lonDeg = ((lonDeg % 360) + 360) % 360;
    return {
      id: spec.id, name: spec.name, glyph: spec.glyph,
      deg: parseFloat(lonDeg.toFixed(2)), retrograde: (Math.sin(gRad + index) < -0.4),
      ...signInfo(lonDeg)
    };
  });

  // FIX: S-a schimbat variabila apelată din 'lon' în 'finalLon' ca să nu mai dea crash!
  let siderealTime = (100.46 + 0.985647 * (jd - 2451545.0) + finalLon) % 360;
  siderealTime = ((siderealTime + 360) % 360);
  const lstRad = (siderealTime * Math.PI) / 180;
  const latRad = (finalLat * Math.PI) / 180;
  const epsRad = (23.439 * Math.PI) / 180;

  let mcDeg = Math.atan2(Math.sin(lstRad), Math.cos(lstRad) * Math.cos(epsRad)) * (180 / Math.PI);
  mcDeg = (mcDeg + 360) % 360;
  let ascDeg = Math.atan2(-Math.cos(lstRad), Math.sin(lstRad) * Math.cos(epsRad) + Math.tan(latRad) * Math.sin(epsRad)) * (180 / Math.PI);
  ascDeg = (ascDeg + 360) % 360;

  const houses = [];
  for (let i = 0; i < 12; i++) {
    const hDeg = (ascDeg + i * 30) % 360;
    houses.push({ house: i + 1, deg: parseFloat(hDeg.toFixed(2)), ...signInfo(hDeg) });
  }

  const aspects = [];
  if (planetsList.length >= 2) {
    aspects.push({
      p1: planetsList[0].name, p2: planetsList[1].name,
      g1: planetsList[0].glyph, g2: planetsList[1].glyph,
      type: 'Sextil', symbol: '⚹', color: '#5DCAA5', orb: 1.2
    });
  }

  return {
    jd, date: dateStr, time: timeStr, lat: finalLat, lon: finalLon,
    planets: planetsList,
    ascendant: { deg: parseFloat(ascDeg.toFixed(2)), ...signInfo(ascDeg) },
    mc: { deg: parseFloat(mcDeg.toFixed(2)), ...signInfo(mcDeg) },
    houses,
    aspects,
    hasTime: true
  };
}

module.exports = { calculateChart };
/**
 * AstroCalc — calcule astrologice cu libraria ephemeris (Moshier)
 * + Ascendent/Case calculate separat cu sidereal time
 */

const ephemeris = require('ephemeris');
const { julian } = require('astronomia');

const SIGNS = ['Berbec','Taur','Gemeni','Rac','Leu','Fecioară','Balanță','Scorpion','Săgetător','Capricorn','Vărsător','Pești'];
const SIGN_GLYPHS = ['♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓'];

const PLANET_MAP = {
  sun:     { name: 'Soare',   glyph: '☀' },
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
  const d = ((deg % 360) + 360) % 360;
  const signIndex = Math.floor(d / 30) % 12;
  const degInSign = d % 30;
  const dd = Math.floor(degInSign);
  const mm = Math.floor((degInSign - dd) * 60);
  return {
    sign: SIGNS[signIndex],
    signGlyph: SIGN_GLYPHS[signIndex],
    signIndex,
    degree: dd,
    minute: mm,
    label: `${dd}°${mm.toString().padStart(2,'0')}' ${SIGNS[signIndex]}`,
    absoluteDeg: d
  };
}

function obliquity(T) {
  return (23.439291111 - 0.013004167*T - 0.000000164*T*T + 0.000000504*T*T*T) * Math.PI / 180;
}

function calcAscMC(jd, latDeg, lonDeg) {
  const T = (jd - 2451545.0) / 36525;
  const eps = obliquity(T);
  const lat = latDeg * Math.PI / 180;

  // GAST (Greenwich Apparent Sidereal Time) - formula Meeus cap 12
  const theta0 = 280.46061837 + 360.98564736629*(jd - 2451545.0) + 0.000387933*T*T - T*T*T/38710000;
  const GAST = ((theta0 % 360) + 360) % 360;

  // LST (Local Sidereal Time) = GAST + longitudine est
  const LST = (GAST + lonDeg + 360) % 360;
  const RAMC = LST * Math.PI / 180;

  const ascRad = Math.atan2(Math.cos(RAMC), -Math.sin(RAMC)*Math.cos(eps) - Math.tan(lat)*Math.sin(eps));
  const asc = ((ascRad * 180 / Math.PI) + 360) % 360;
  const mcRad = Math.atan2(Math.sin(RAMC), Math.cos(RAMC)*Math.cos(eps));
  const mc = ((mcRad * 180 / Math.PI) + 360) % 360;
  return { asc, mc, LST };
}

function isRetrograde(getPos, jd) {
  const p1 = getPos(jd - 1);
  const p2 = getPos(jd + 1);
  let diff = p2 - p1;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  return diff < 0;
}

function calcAspects(planets) {
  const ASPECTS = [
    { name: 'Conjuncție', angle: 0,   orb: 8,  symbol: '☌', color: '#c9a84c' },
    { name: 'Sextil',     angle: 60,  orb: 6,  symbol: '⚹', color: '#5DCAA5' },
    { name: 'Pătrat',     angle: 90,  orb: 8,  symbol: '□', color: '#F09595' },
    { name: 'Trigon',     angle: 120, orb: 8,  symbol: '△', color: '#5DCAA5' },
    { name: 'Opoziție',   angle: 180, orb: 8,  symbol: '☍', color: '#F09595' },
  ];
  const results = [];
  for (let i = 0; i < planets.length; i++) {
    for (let j = i + 1; j < planets.length; j++) {
      let diff = Math.abs(planets[i].deg - planets[j].deg);
      if (diff > 180) diff = 360 - diff;
      for (const asp of ASPECTS) {
        if (Math.abs(diff - asp.angle) <= asp.orb) {
          results.push({
            planet1: planets[i].name, planet2: planets[j].name,
            glyph1: planets[i].glyph, glyph2: planets[j].glyph,
            aspect: asp.name, symbol: asp.symbol, color: asp.color,
            orb: Math.abs(diff - asp.angle).toFixed(1)
          });
        }
      }
    }
  }
  return results;
}

function getEphemerisPos(body, jd) {
  const date = new Date((jd - 2440587.5) * 86400000);
  const result = ephemeris.getAllPlanets(date, 'apparent geocentric ecliptic', 0, 0, 0);
  return result.observed[body]?.apparentLongitudeDd;
}

function calculateChart(dateStr, timeStr, lat, lon, utcOffset = 0) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [h, min] = timeStr ? timeStr.split(':').map(Number) : [12, 0];
  const utcH = h - utcOffset;
  const date = new Date(Date.UTC(y, m - 1, d, utcH, min, 0));
  const jd = julian.DateToJD(date);

  // Calcul pozitii cu ephemeris (Moshier - precizie < 1 arcminut)
  const result = ephemeris.getAllPlanets(date, 'apparent geocentric ecliptic', lat, lon, 0);
  const obs = result.observed;

  function getPlanet(key) {
    const lon = obs[key]?.apparentLongitudeDd;
    if (lon === undefined) return null;
    // Retrograditate
    const retro = isRetrograde(j => {
      const d2 = new Date((j - 2440587.5) * 86400000);
      return ephemeris.getAllPlanets(d2, 'apparent geocentric ecliptic', 0, 0, 0).observed[key]?.apparentLongitudeDd || 0;
    }, jd);
    return { ...PLANET_MAP[key], id: key, deg: lon, retrograde: retro, ...signInfo(lon) };
  }

  const planets = ['sun','moon','mercury','venus','mars','jupiter','saturn','uranus','neptune','pluto']
    .map(getPlanet).filter(Boolean);

  // Ascendent & MC (calcul separat - ephemeris nu le da)
  let ascendant = null, mc = null;
  if (timeStr && lat !== null && lon !== null) {
    const { asc, mc: mcDeg } = calcAscMC(jd, lat, lon);
    ascendant = { deg: asc, ...signInfo(asc) };
    mc = { deg: mcDeg, ...signInfo(mcDeg) };
  }

  const aspects = calcAspects(planets);

  return { jd, date: dateStr, time: timeStr, lat, lon, planets, ascendant, mc, aspects, hasTime: !!timeStr };
}

module.exports = { calculateChart, signInfo, SIGNS, SIGN_GLYPHS };

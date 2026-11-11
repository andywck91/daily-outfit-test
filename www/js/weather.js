/* Location + weather (Open-Meteo, no API key). Coordinates are rounded to ~1 km before leaving the phone. */
(function (g) {
  'use strict';
  const OF = (g.OF = g.OF || {});

  function getPosition(timeoutMs) {
    return new Promise((res, rej) => {
      if (!g.navigator || !navigator.geolocation) return rej(Object.assign(new Error('no geolocation'), { code: 2 }));
      navigator.geolocation.getCurrentPosition(
        (p) => res({ lat: p.coords.latitude, lon: p.coords.longitude }),
        (e) => rej(e),
        { enableHighAccuracy: false, timeout: timeoutMs || 12000, maximumAge: 15 * 60 * 1000 }
      );
    });
  }

  async function fetchWeather(lat, lon) {
    const la = lat.toFixed(2), lo = lon.toFixed(2);
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + la + '&longitude=' + lo +
      '&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation' +
      '&daily=precipitation_probability_max&timezone=auto&forecast_days=1';
    const ctl = new AbortController();
    const to = setTimeout(() => ctl.abort(), 12000);
    try {
      const r = await fetch(url, { signal: ctl.signal });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return parseWeather(await r.json());
    } finally { clearTimeout(to); }
  }

  function parseWeather(j) {
    const c = j && j.current;
    if (!c || typeof c.temperature_2m !== 'number') throw new Error('bad weather payload');
    const d = j.daily && j.daily.precipitation_probability_max;
    return {
      temp: Math.round(c.temperature_2m),
      feels: Math.round(typeof c.apparent_temperature === 'number' ? c.apparent_temperature : c.temperature_2m),
      humidity: typeof c.relative_humidity_2m === 'number' ? Math.round(c.relative_humidity_2m) : null,
      rainNow: (c.precipitation || 0) > 0.1,
      rainProb: d && typeof d[0] === 'number' ? d[0] : null,
      at: Date.now(),
    };
  }

  OF.weather = { getPosition, fetchWeather, parseWeather };
})(typeof window !== 'undefined' ? window : globalThis);

/* Outfit engine: pure logic, no DOM. Works in browser (window.OF) and node (globalThis.OF). */
(function (g) {
  'use strict';
  const OF = (g.OF = g.OF || {});

  const CATEGORIES = ['Top', 'Bottom', 'Dress', 'Outerwear', 'Shoes', 'Bag', 'Jewelry'];
  const CLOTHING = ['Top', 'Bottom', 'Dress', 'Outerwear'];
  const TYPES = {
    Top: ['shirt', 'tee', 'tank', 'knit'],
    Bottom: ['trousers', 'jeans', 'skirt', 'shorts'],
    Dress: ['midi', 'mini'],
    Outerwear: ['blazer', 'cardigan', 'jacket'],
    Shoes: ['heels', 'flats', 'sneakers', 'sandals'],
    Bag: ['tote', 'shoulder', 'backpack'],
    Jewelry: ['set'],
  };
  const OCCASIONS = ['Business', 'Casual', 'Beach', 'Sport', 'Summer', 'Date', 'Party', 'Formal', 'Travel', 'ClientVisit', 'Festive'];
  const WX = ['hot_humid', 'hot_sunny', 'rainy', 'aircon', 'cool'];

  /* ---------------------------------------------------------------- colour helpers */
  function hexToRgb(h) {
    h = String(h || '#999999').replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const n = parseInt(h, 16);
    if (isNaN(n)) return [153, 153, 153];
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgbToHex(r, g2, b) {
    return '#' + [r, g2, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  }
  function hexToHsl(hex) {
    let [r, g2, b] = hexToRgb(hex);
    r /= 255; g2 /= 255; b /= 255;
    const mx = Math.max(r, g2, b), mn = Math.min(r, g2, b);
    let h = 0, s = 0;
    const l = (mx + mn) / 2;
    if (mx !== mn) {
      const d = mx - mn;
      s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      if (mx === r) h = (g2 - b) / d + (g2 < b ? 6 : 0);
      else if (mx === g2) h = (b - r) / d + 2;
      else h = (r - g2) / d + 4;
      h *= 60;
    }
    return { h, s, l };
  }
  function hueDiff(a, b) {
    const d = Math.abs(a - b) % 360;
    return d > 180 ? 360 - d : d;
  }
  function isNeutral(c) {
    const { h, s, l } = hexToHsl(c);
    if (s < 0.15 || l < 0.14 || l > 0.9) return true;
    if (h >= 20 && h <= 60 && s < 0.5 && l > 0.35) return true; // beige / camel / cream / tan
    if (h >= 195 && h <= 250 && l < 0.28) return true; // navy
    return false;
  }
  /** nearest "basic" colour name for shopping suggestions, or null if chromatic */
  function basicColorName(c) {
    const { h, s, l } = hexToHsl(c);
    if (l < 0.15) return 'black';
    if (l > 0.88) return 'white';
    if (s < 0.15) return 'grey';
    if (h >= 20 && h <= 60 && s < 0.5 && l > 0.35) return 'beige';
    if (h >= 195 && h <= 250 && l < 0.28) return 'navy';
    return null;
  }
  const NAMED = {
    black: '#1E1E20', white: '#F7F5F0', cream: '#EFE3CF', ivory: '#F3EEDF', beige: '#CDB89A', camel: '#C19A6B', tan: '#C8A582',
    nude: '#E3C4A8', brown: '#7B5B3F', taupe: '#8A7A66', grey: '#9AA0A6', gray: '#9AA0A6', silver: '#C0C0C0', gold: '#D4AF37',
    navy: '#1F2E4D', blue: '#3B6FB6', 'light blue': '#A9C7E8', denim: '#5B7DB1', green: '#3E7B5A', olive: '#6B7048', khaki: '#B5A57A',
    red: '#C0392B', burgundy: '#6D1F2F', pink: '#E8A0B4', blush: '#EBC4C4', purple: '#7C5CA8', lavender: '#C3B1E1', yellow: '#E9C46A',
    orange: '#E07B39', mint: '#BFE3D0', teal: '#2A8C8C', turquoise: '#40B8B0',
    '黑': '#1E1E20', '白': '#F7F5F0', '米': '#CDB89A', '奶油': '#EFE3CF', '卡其': '#B5A57A', '棕': '#7B5B3F', '灰': '#9AA0A6', '银': '#C0C0C0',
    '金': '#D4AF37', '藏青': '#1F2E4D', '深蓝': '#1F2E4D', '蓝': '#3B6FB6', '浅蓝': '#A9C7E8', '绿': '#3E7B5A', '红': '#C0392B', '粉': '#E8A0B4',
    '紫': '#7C5CA8', '黄': '#E9C46A', '橙': '#E07B39', '裸': '#E3C4A8',
  };
  function colorFromName(s) {
    s = String(s || '').trim();
    if (!s) return null;
    if (/^#?[0-9a-f]{6}$/i.test(s)) return s[0] === '#' ? s : '#' + s;
    const low = s.toLowerCase();
    if (NAMED[low]) return NAMED[low];
    const keys = Object.keys(NAMED).sort((a, b) => b.length - a.length);
    for (const k of keys) if (low.includes(k)) return NAMED[k];
    return null;
  }

  /* ---------------------------------------------------------------- defaults */
  function defaultState() {
    return {
      version: 1,
      profile: { name: '', figure: 'feminine', skin: '#E8BFA0', hairColor: '#2A1F1C', hairLength: 'long', makeup: true, lang: 'en', modest: false, removeBg: true },
      settings: {
        n: 10,
        rule: { Top: true, Bottom: true, Dress: true, Outerwear: true, Shoes: false, Bag: false, Jewelry: false },
        minItems: 3,
      },
      items: [],
      log: [],
      counters: {},
      feedback: { item: {}, color: {} },
      onboarded: false,
    };
  }

  /* ---------------------------------------------------------------- no-repeat rule */
  function lastWorn(state, id) {
    for (let i = state.log.length - 1; i >= 0; i--) {
      const it = state.log[i].items;
      for (const k in it) if (it[k] === id) return state.log[i].n;
    }
    return 0;
  }
  /** status of one item: available | resting | laundry ; wait = outfits still to wear before it is free */
  function itemStatus(state, item) {
    if (item.laundry) return { status: 'laundry', wait: 0 };
    const L = state.log.length;
    const last = lastWorn(state, item.id);
    const N = state.settings.n;
    if (state.settings.rule[item.cat] && last > 0 && L - last < N) return { status: 'resting', wait: N - (L - last) };
    return { status: 'available', wait: 0 };
  }

  /* ---------------------------------------------------------------- weather -> conditions */
  /** w: {temp, feels, humidity, rainProb, rainNow} or null ; override: one of WX or null ; aircon: bool */
  function conditions(w, override, aircon) {
    const c = [];
    if (override) c.push(override);
    else if (w) {
      const rain = w.rainNow || (w.rainProb != null && w.rainProb >= 60);
      if (rain) c.push('rainy');
      const hot = w.temp >= 28 || w.feels >= 32;
      if (w.temp < 22) c.push('cool');
      else if (hot || !rain) c.push(w.humidity != null && w.humidity < 65 ? 'hot_sunny' : 'hot_humid');
    } else c.push('hot_humid'); // Malaysian default
    if (aircon && !c.includes('aircon')) c.push('aircon');
    return c;
  }

  /* ---------------------------------------------------------------- colour harmony */
  function harmony(colors) {
    const chroma = colors.filter(Boolean).filter((c) => !isNeutral(c));
    const clusters = [];
    for (const c of chroma) {
      const h = hexToHsl(c).h;
      if (!clusters.some((x) => hueDiff(x, h) <= 30)) clusters.push(h);
    }
    if (clusters.length === 0) return 2;
    if (clusters.length === 1) return 2.5;
    if (clusters.length === 2) return hueDiff(clusters[0], clusters[1]) >= 150 ? 1 : -2;
    return -4;
  }

  function typeAdjust(occ, cond, p) {
    const ty = (c) => (p[c] ? p[c].type : null);
    const formal = ['Business', 'ClientVisit', 'Formal'].includes(occ);
    let a = 0;
    if (occ === 'Sport') {
      a += ty('Shoes') === 'sneakers' ? 2 : p.Shoes ? -5 : 0;
      if (ty('Bottom') === 'skirt' || p.Dress) a -= 3;
      if (ty('Top') === 'shirt') a -= 1;
      if (p.Outerwear && ty('Outerwear') === 'blazer') a -= 3;
    }
    if (occ === 'Beach') {
      a += ty('Shoes') === 'sandals' ? 2 : ty('Shoes') === 'heels' ? -4 : 0;
      if (ty('Outerwear') === 'blazer') a -= 3;
    }
    if (formal) {
      if (ty('Shoes') === 'sneakers') a -= 2;
      if (ty('Shoes') === 'sandals') a -= 1;
      if (ty('Bottom') === 'shorts') a -= 4;
      if (ty('Top') === 'tank') a -= 2;
      if (ty('Top') === 'tee') a -= 1;
      if (ty('Bottom') === 'jeans') a -= 1;
      if (ty('Dress') === 'mini') a -= 1.5;
      if (ty('Bag') === 'backpack') a -= 1.5;
    }
    if (['Festive', 'Date', 'Party'].includes(occ) && p.Dress) a += 1;
    if (cond.includes('rainy')) {
      if (ty('Shoes') === 'sandals') a -= 1;
      if (ty('Shoes') === 'heels') a -= 0.5;
    }
    return a;
  }

  /* ---------------------------------------------------------------- grooming (hair + makeup keys) */
  const HAIR = {
    Business: ['lowbun', 'ponytail', 'down'], ClientVisit: ['lowbun', 'ponytail', 'down'], Formal: ['lowbun', 'halfup', 'down'],
    Casual: ['down', 'braid', 'ponytail'], Travel: ['braid', 'ponytail', 'down'], Beach: ['braid', 'bun', 'ponytail'],
    Summer: ['bun', 'braid', 'ponytail'], Sport: ['ponytail', 'braid', 'bun'], Date: ['down', 'halfup', 'lowbun'],
    Party: ['halfup', 'down', 'lowbun'], Festive: ['halfup', 'lowbun', 'down'],
  };
  const MAKEUP = {
    Business: 'work', ClientVisit: 'work', Casual: 'casual', Travel: 'casual', Beach: 'beach', Summer: 'beach', Sport: 'sport',
    Date: 'glam', Party: 'glam', Festive: 'glam', Formal: 'formal',
  };
  function groom(occ, cond, profile, idx) {
    const hot = cond.includes('hot_humid') || cond.includes('hot_sunny') || cond.includes('rainy');
    let list = (HAIR[occ] || HAIR.Casual).slice();
    if (hot) {
      const up = ['bun', 'ponytail', 'lowbun', 'braid'];
      list = list.filter((x) => up.includes(x)).concat(list.filter((x) => !up.includes(x)));
    }
    const short = profile.hairLength === 'short' || profile.figure === 'masculine';
    const id = list[idx % list.length];
    const hairId = short ? 'short' : id;
    const hairKey = short ? 'hair.short' + (idx % 3) : 'hair.' + id;
    const mk = MAKEUP[occ] || 'casual';
    const makeupKeys = [];
    if (profile.makeup && profile.figure !== 'masculine') makeupKeys.push('mk.' + mk);
    else makeupKeys.push('mk.skin');
    if (cond.includes('rainy')) makeupKeys.push('mk.rain');
    else if (cond.includes('hot_humid')) makeupKeys.push('mk.humid');
    else if (cond.includes('hot_sunny')) makeupKeys.push('mk.sun');
    return { hairId, hairKey, makeupKeys };
  }

  /* ---------------------------------------------------------------- generation */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const FESTIVAL_COLORS = {
    raya: ['green', 'gold', 'beige', 'brown', 'lightblue', 'pink', 'white'],
    cny: ['red', 'gold', 'white', 'pink'],
    deepavali: ['orange', 'yellow', 'purple', 'pink', 'gold', 'green', 'red', 'blue'],
  };
  const MODEST_AVOID = ['tank', 'shorts', 'mini'];

  /** record "not for me": reason is 'color' | 'occasion' | 'piece'. Mutates state.feedback / item tags. */
  function applyFeedback(state, look, reason, occasion) {
    const fb = state.feedback = state.feedback || { item: {}, color: {} };
    fb.item = fb.item || {}; fb.color = fb.color || {};
    const clothes = CLOTHING.map((c) => look.parts[c]).filter(Boolean);
    clothes.forEach((it) => {
      if (reason === 'color') { const k = colorKey(it.color); fb.color[k] = Math.max(-4, (fb.color[k] || 0) - 1); }
      else if (reason === 'occasion') { it.occasions = (it.occasions || []).filter((o) => o !== occasion); if (!it.occasions.length) it.occasions = ['Casual']; }
      else fb.item[it.id] = Math.max(-4, (fb.item[it.id] || 0) - 2);
    });
  }

  const OCC_WORDS = [
    ['Festive', /raya|hari raya|aidilfitri|cny|chinese new year|lunar new year|deepavali|diwali|festival|open house|春节|过年|新年|开斋|屏哈|节日/i],
    ['Formal', /wedding|dinner|gala|dinner party|ceremony|funeral|convocation|婚礼|晚宴|典礼|葬礼|毕业/i],
    ['ClientVisit', /client|customer|site visit|visit|supplier|客户|拜访|客人/i],
    ['Business', /meeting|office|presentation|interview|work|conference|workshop|会议|开会|面试|上班|办公|汇报/i],
    ['Date', /date|anniversary|约会|纪念日/i],
    ['Party', /party|birthday|reunion|club|drinks|聚会|生日|派对|同学会/i],
    ['Sport', /gym|run|yoga|sport|badminton|hike|workout|swim|运动|健身|跑步|羽毛球|爬山/i],
    ['Beach', /beach|pool|island|snorkel|海边|沙滩|泳池/i],
    ['Travel', /flight|travel|trip|airport|road ?trip|旅行|机场|出差|飞/i],
    ['Casual', /lunch|coffee|brunch|mall|shopping|friends|errand|逛街|喝咖啡|午餐|朋友/i],
  ];
  /** guess the occasion (and festival) from a line like "client meeting 3pm" */
  function occasionFromText(text) {
    const s = String(text || '');
    let occasion = null;
    for (const [o, re] of OCC_WORDS) if (re.test(s)) { occasion = o; break; }
    let festival = null;
    if (/raya|aidilfitri|开斋|屏哈|open house/i.test(s)) festival = 'raya';
    else if (/cny|chinese new year|lunar new year|春节|过年|新年/i.test(s)) festival = 'cny';
    else if (/deepavali|diwali/i.test(s)) festival = 'deepavali';
    return { occasion, festival };
  }

  function generate(state, occasion, cond, opts) {
    opts = opts || {};
    const rng = opts.rng || Math.random;
    const N = opts.n != null ? opts.n : state.settings.n;
    const st = { ...state, settings: { ...state.settings, n: N } };
    const L = state.log.length;
    const warnings = [];
    const stretchNames = [];

    const avail = state.items.filter((i) => itemStatus(st, i).status === 'available');

    function scored(cat0) {
      const cat = cat0;
      return avail.filter((i) => i.cat === cat).map((it) => {
        let s = 0, stretch = false;
        const occ = it.occasions || [];
        if (occ.length) {
          if (occ.includes(occasion)) s += 3; else { s -= 3; stretch = true; }
        }
        const w = it.weather || [];
        if (w.length) s += w.some((x) => cond.includes(x)) ? 2 : -2;
        const last = lastWorn(state, it.id);
        s += last ? Math.min(2, (L - last) / (N * 1.5)) : 2;
        // learned taste (from the "not for me" button) and Malaysia-specific context
        const fb = state.feedback || {};
        s += (fb.item && fb.item[it.id]) || 0;
        if (CLOTHING.includes(cat)) {
          s += (fb.color && fb.color[colorKey(it.color)]) || 0;
          if (opts.festival && FESTIVAL_COLORS[opts.festival] && FESTIVAL_COLORS[opts.festival].includes(colorKey(it.color))) s += 1.5;
          if (state.profile && state.profile.modest && MODEST_AVOID.includes(it.type)) s -= 6;
        }
        if (opts.exclude && opts.exclude.includes(it.id)) s -= 50;
        return { it, s, stretch };
      });
    }
    function top(cat, K) {
      let list = scored(cat);
      if (CLOTHING.includes(cat)) {
        const ok = list.filter((x) => !x.stretch);
        if (ok.length) list = ok;
        else list.forEach((x) => x.stretch && stretchNames.push(x.it.id));
      }
      list.forEach((x) => (x.j = x.s + rng() * 0.8));
      list.sort((a, b) => b.j - a.j);
      return list.slice(0, K);
    }

    const needOuter = cond.includes('aircon') || cond.includes('cool');
    const tops = top('Top', 6), bottoms = top('Bottom', 6), dresses = top('Dress', 5);
    let outers = top('Outerwear', 4);
    if (!needOuter) outers = [];
    else if (!outers.length) warnings.push({ code: 'no_outer' });
    const shoes = top('Shoes', 4), bags = top('Bag', 3), jewels = top('Jewelry', 3);
    const orNull = (a) => (a.length ? a : [null]);
    const oOpts = outers.length ? outers : [null];

    const combos = [];
    function push(parts, items) {
      let sum = 0;
      const colors = [];
      const p = {};
      for (const c of CATEGORIES) {
        const x = parts[c];
        if (x) { sum += x.s; p[c] = x.it; if (['Top', 'Bottom', 'Dress', 'Outerwear', 'Shoes', 'Bag'].includes(c)) colors.push(x.it.color); }
        else p[c] = null;
      }
      const score = sum + harmony(colors) + typeAdjust(occasion, cond, p) + rng() * 0.6;
      combos.push({ parts: p, score });
    }
    for (const d of dresses) for (const o of oOpts) for (const s of orNull(shoes)) for (const b of orNull(bags)) for (const j of orNull(jewels))
      push({ Dress: d, Outerwear: o, Shoes: s, Bag: b, Jewelry: j });
    for (const t of tops) for (const bt of bottoms) for (const o of oOpts) for (const s of orNull(shoes)) for (const b of orNull(bags)) for (const j of orNull(jewels))
      push({ Top: t, Bottom: bt, Outerwear: o, Shoes: s, Bag: b, Jewelry: j });

    combos.sort((a, b) => b.score - a.score);

    // pick up to 3 that differ in their clothing
    const chosen = [];
    const share = (a, b) => ['Top', 'Bottom', 'Dress'].filter((s) => a.parts[s] && b.parts[s] && a.parts[s].id === b.parts[s].id).length;
    // prefer sharing a piece between good looks over adding a much weaker, "different" one
    const best = combos.length ? combos[0].score : 0;
    const pools = [combos.filter((c) => c.score >= best - 5), combos];
    outer: for (const pool of pools) {
      for (const maxShare of [0, 1, 3]) {
        for (const c of pool) {
          if (chosen.length >= 3) break outer;
          if (chosen.includes(c)) continue;
          if (chosen.every((x) => share(x, c) <= maxShare)) chosen.push(c);
        }
      }
    }

    const looks = chosen.map((c, i) => {
      const stretch = Object.values(c.parts).filter((it) => it && stretchNames.includes(it.id)).map((it) => it.id);
      return { parts: c.parts, score: c.score, stretch, groom: groom(occasion, cond, state.profile, i) };
    });
    if (looks.length && looks.length < 3) warnings.push({ code: 'few_looks', n: looks.length });
    if (looks.some((l) => l.stretch.length)) warnings.push({ code: 'stretch' });

    const out = { looks, warnings, occasion, cond, missing: null, suggestN: null };
    if (!looks.length) {
      out.missing = diagnose(state, st);
      if (!opts._noSuggest) out.suggestN = minFeasibleN(state, occasion, cond);
    }
    return out;
  }

  function diagnose(state, st) {
    const res = {};
    for (const cat of ['Top', 'Bottom', 'Dress']) {
      const all = state.items.filter((i) => i.cat === cat);
      const stats = all.map((i) => itemStatus(st, i));
      const resting = stats.filter((s) => s.status === 'resting');
      res[cat] = {
        total: all.length,
        laundry: stats.filter((s) => s.status === 'laundry').length,
        resting: resting.length,
        available: stats.filter((s) => s.status === 'available').length,
        nextWait: resting.length ? Math.min(...resting.map((s) => s.wait)) : 0,
      };
    }
    return res;
  }

  /** largest N' < current N that still allows at least one outfit; null if none */
  function minFeasibleN(state, occasion, cond) {
    for (let n = state.settings.n - 1; n >= 0; n--) {
      const r = generate(state, occasion, cond, { n, rng: mulberry32(7), _noSuggest: true });
      if (r.looks.length) return n;
    }
    return null;
  }

  /* ---------------------------------------------------------------- gap check */
  /** false for combinations that make no sense (a dress for Sport, a blazer for the beach) */
  function relevant(cat, occ) {
    if (occ === 'Sport') return !['Dress', 'Outerwear', 'Jewelry'].includes(cat);
    if (occ === 'Beach' || occ === 'Summer') return cat !== 'Outerwear';
    return true;
  }
  function gapMatrix(state) {
    const m = {};
    for (const c of CATEGORIES) {
      m[c] = {};
      for (const o of OCCASIONS) m[c][o] = state.items.filter((i) => i.cat === c && (i.occasions || []).includes(o)).length;
    }
    return m;
  }
  function suggestions(state, limit) {
    const min = state.settings.minItems;
    const m = gapMatrix(state);
    const usage = {};
    state.log.forEach((e) => (usage[e.occasion] = (usage[e.occasion] || 0) + 1));
    const wOcc = (o) => (state.log.length ? 1 + (usage[o] || 0) : o === 'Business' || o === 'Casual' ? 3 : 1);
    const out = [];
    for (const c of CATEGORIES) {
      const cells = OCCASIONS.filter((o) => relevant(c, o)).map((o) => ({ o, deficit: Math.max(0, min - m[c][o]), have: m[c][o], score: Math.max(0, min - m[c][o]) * wOcc(o) * (['Shoes', 'Bag', 'Jewelry'].includes(c) ? 0.5 : 1) }))
        .filter((x) => x.deficit > 0).sort((a, b) => b.score - a.score);
      if (!cells.length) continue;
      const owned = state.items.filter((i) => i.cat === c);
      const counts = {};
      ['black', 'white', 'beige', 'navy', 'grey'].forEach((n) => (counts[n] = 0));
      owned.forEach((i) => { const n = basicColorName(i.color); if (n && n in counts) counts[n]++; });
      const color = Object.keys(counts).sort((a, b) => counts[a] - counts[b])[0];
      const tcount = {};
      TYPES[c].forEach((t) => (tcount[t] = 0));
      owned.forEach((i) => { if (i.type in tcount) tcount[i.type]++; });
      const type = TYPES[c].slice().sort((a, b) => tcount[a] - tcount[b])[0];
      out.push({ cat: c, type, color, occasions: cells.slice(0, 2).map((x) => x.o), have: cells[0].have, min, score: cells.reduce((a, x) => a + x.score, 0) });
    }
    return out.sort((a, b) => b.score - a.score).slice(0, limit || 5);
  }


  /* ---------------------------------------------------------------- automatic tags */
  const AUTO_OCC = {
    shirt: ['Business', 'ClientVisit', 'Casual', 'Date', 'Travel'], tee: ['Casual', 'Travel', 'Summer', 'Beach', 'Sport'],
    tank: ['Casual', 'Summer', 'Beach', 'Sport', 'Party'], knit: ['Casual', 'Date', 'Business', 'Travel'],
    trousers: ['Business', 'ClientVisit', 'Formal', 'Casual', 'Travel'], jeans: ['Casual', 'Travel', 'Date'],
    skirt: ['Business', 'ClientVisit', 'Formal', 'Date', 'Party', 'Festive', 'Casual'], shorts: ['Casual', 'Beach', 'Summer', 'Travel', 'Sport'],
    midi: ['Date', 'Party', 'Formal', 'Festive', 'Business', 'ClientVisit', 'Casual'], mini: ['Date', 'Party', 'Casual', 'Summer', 'Beach'],
    blazer: ['Business', 'ClientVisit', 'Formal', 'Party', 'Date'], cardigan: ['Casual', 'Business', 'Travel', 'Date'], jacket: ['Casual', 'Travel'],
    heels: ['Business', 'ClientVisit', 'Formal', 'Date', 'Party', 'Festive'], flats: ['Business', 'ClientVisit', 'Formal', 'Casual', 'Date', 'Travel'],
    sneakers: ['Casual', 'Sport', 'Travel'], sandals: ['Casual', 'Beach', 'Summer', 'Travel', 'Festive'],
    tote: ['Business', 'ClientVisit', 'Casual', 'Travel'], shoulder: ['Business', 'Formal', 'Date', 'Party', 'Casual', 'Festive'],
    backpack: ['Sport', 'Travel', 'Casual'], set: ['Business', 'ClientVisit', 'Formal', 'Casual', 'Date', 'Party', 'Festive'],
  };
  const AUTO_WX = {
    tank: ['hot_humid', 'hot_sunny'], shorts: ['hot_humid', 'hot_sunny'], mini: ['hot_humid', 'hot_sunny'], sandals: ['hot_humid', 'hot_sunny'],
    knit: ['aircon', 'cool'], blazer: ['aircon', 'cool'], cardigan: ['aircon', 'cool'], jacket: ['aircon', 'cool'],
  };
  /** Suggested occasions + weather for an item from its type and colour, so users only have to say what it is. */
  function autoTags(cat, type, color) {
    let occ = (AUTO_OCC[type] || []).slice();
    const c = color || '#999999';
    const { s, l } = hexToHsl(c);
    const clothing = ['Top', 'Bottom', 'Dress'].includes(cat);
    if (clothing && !isNeutral(c) && s > 0.5 && l > 0.35) {            // bright colour: festive and fun, not formal
      occ = occ.filter((o) => o !== 'Formal' && o !== 'ClientVisit');
      ['Festive', 'Party'].forEach((o) => { if ((cat !== 'Bottom' || type === 'skirt') && !occ.includes(o)) occ.push(o); });
    }
    if ((cat === 'Dress' || type === 'skirt') && l < 0.2 && !occ.includes('Formal')) occ.push('Formal');   // little black dress / skirt
    return { occasions: occ.filter((o) => OCCASIONS.includes(o)), weather: (AUTO_WX[type] || []).slice() };
  }
  const BASIC = {
    black: '#1E1E20', white: '#F7F5F0', grey: '#9AA0A6', beige: '#CDB89A', brown: '#7B5B3F', navy: '#1F2E4D', blue: '#3B6FB6', lightblue: '#A9C7E8',
    green: '#3E7B5A', red: '#C0392B', pink: '#E8A0B4', purple: '#7C5CA8', yellow: '#E9C46A', orange: '#E07B39', gold: '#D4AF37', silver: '#C0C0C0',
  };
  /** nearest everyday colour name (key of color.* in the translations) */
  function colorKey(hex) {
    const [r, g, b] = hexToRgb(hex);
    let best = 'grey', bd = Infinity;
    for (const k in BASIC) {
      const [r2, g2, b2] = hexToRgb(BASIC[k]);
      const d = 2 * (r - r2) ** 2 + 4 * (g - g2) ** 2 + 3 * (b - b2) ** 2;
      if (d < bd) { bd = d; best = k; }
    }
    return best;
  }

  /* ---------------------------------------------------------------- CSV */
  function parseCSV(text) {
    text = String(text || '').replace(/^﻿/, '');
    const rows = [];
    let row = [], cur = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
        else cur += ch;
      } else if (ch === '"') q = true;
      else if (ch === ',') { row.push(cur); cur = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(cur); cur = '';
        if (row.some((c) => c.trim() !== '')) rows.push(row);
        row = [];
      } else cur += ch;
    }
    row.push(cur);
    if (row.some((c) => c.trim() !== '')) rows.push(row);
    return rows;
  }
  function toCSV(rows) {
    return '﻿' + rows.map((r) => r.map((v) => { v = v == null ? '' : String(v); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(',')).join('\r\n');
  }

  const OCC_ALIASES = {
    business: 'Business', casual: 'Casual', beach: 'Beach', sport: 'Sport', sports: 'Sport', summer: 'Summer', date: 'Date', party: 'Party',
    formal: 'Formal', travel: 'Travel', clientvisit: 'ClientVisit', 'client visit': 'ClientVisit', festive: 'Festive', raya: 'Festive',
    '商务': 'Business', '休闲': 'Casual', '海边': 'Beach', '运动': 'Sport', '夏天': 'Summer', '约会': 'Date', '聚会': 'Party', '正式': 'Formal',
    '旅行': 'Travel', '拜访客户': 'ClientVisit', '节庆': 'Festive',
  };
  const WX_ALIASES = {
    'hot & humid': 'hot_humid', 'hot&humid': 'hot_humid', hot_humid: 'hot_humid', '湿热': 'hot_humid',
    'hot & sunny': 'hot_sunny', 'hot&sunny': 'hot_sunny', hot_sunny: 'hot_sunny', '晴热': 'hot_sunny',
    rainy: 'rainy', rain: 'rainy', '下雨': 'rainy', '雨': 'rainy',
    'air-con / cool': 'aircon', 'air-con': 'aircon', aircon: 'aircon', '冷气': 'aircon',
    'cool (highlands)': 'cool', cool: 'cool', '凉爽': 'cool', '高原': 'cool',
  };
  const CAT_ALIASES = {
    top: 'Top', tops: 'Top', '上衣': 'Top', bottom: 'Bottom', bottoms: 'Bottom', '下装': 'Bottom', '裤': 'Bottom', dress: 'Dress', '连衣裙': 'Dress',
    outerwear: 'Outerwear', '外套': 'Outerwear', shoes: 'Shoes', shoe: 'Shoes', '鞋': 'Shoes', bag: 'Bag', bags: 'Bag', '包': 'Bag',
    jewelry: 'Jewelry', jewellery: 'Jewelry', '首饰': 'Jewelry',
  };
  const TYPE_WORDS = [
    ['blazer', /blazer|suit jacket|西装/i], ['cardigan', /cardigan|开衫/i], ['jacket', /jacket|coat|夹克|外套/i],
    ['sneakers', /sneaker|trainer|running|运动鞋|球鞋/i], ['heels', /heel|pump|高跟|粗跟/i], ['sandals', /sandal|slide|凉鞋|拖鞋/i], ['flats', /flat|loafer|ballet|平底|乐福/i],
    ['backpack', /backpack|双肩/i], ['shoulder', /shoulder|crossbody|sling|单肩|斜挎/i], ['tote', /tote|托特/i],
    ['jeans', /jean|denim|牛仔/i], ['shorts', /short(?!\s*sleeve)|短裤/i], ['skirt', /skirt|裙(?!子$)/i], ['trousers', /trouser|pant|slack|裤/i],
    ['tank', /tank|camisole|vest|背心|吊带/i], ['knit', /knit|sweater|jumper|针织|毛衣/i], ['tee', /\btee\b|t-shirt|tshirt|T恤/i], ['shirt', /shirt|blouse|衬衫/i],
    ['mini', /mini|短裙/i], ['midi', /midi|maxi|dress|连衣裙|长裙/i],
  ];
  function inferType(cat, name) {
    for (const [t, re] of TYPE_WORDS) if (TYPES[cat].includes(t) && re.test(name)) return t;
    return TYPES[cat][0];
  }
  function nextId(state, cat) {
    state.counters = state.counters || {};
    const prefix = { Top: 'T', Bottom: 'B', Dress: 'D', Outerwear: 'O', Shoes: 'S', Bag: 'G', Jewelry: 'J' }[cat];
    let n = state.counters[cat] || 0;
    let id;
    do { n++; id = prefix + String(n).padStart(3, '0'); } while (state.items.some((i) => i.id === id));
    state.counters[cat] = n;
    return id;
  }
  function splitList(s) {
    return String(s || '').split(/[,;，、|]/).map((x) => x.trim()).filter(Boolean);
  }
  /** Returns {items, skipped}. Compatible with the Wardrobe sheet of Wardrobe_Planner.xlsx saved as CSV. */
  function importCSV(state, text) {
    const rows = parseCSV(text);
    if (rows.length < 2) return { items: [], skipped: 0, error: 'empty' };
    const head = rows[0].map((h) => String(h).trim().toLowerCase());
    const col = (...keys) => head.findIndex((h) => keys.some((k) => h.startsWith(k)));
    const ix = {
      id: col('item id', 'id', '编号'), cat: col('category', '类别'), name: col('name (en)', 'name'), zh: col('名称'), color: col('color', 'colour', '颜色'),
      occ: col('occasions', '场合'), wx: col('weather', '天气'),
    };
    if (ix.cat < 0 || (ix.name < 0 && ix.zh < 0)) return { items: [], skipped: 0, error: 'columns' };
    const items = [], seen = new Set(state.items.map((i) => i.id));
    let skipped = 0;
    const tmp = { ...state, items: state.items.slice(), counters: { ...(state.counters || {}) } };
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const cat = CAT_ALIASES[String(row[ix.cat] || '').trim().toLowerCase()];
      const name = String(ix.name >= 0 ? row[ix.name] || '' : '').trim();
      const zh = String(ix.zh >= 0 ? row[ix.zh] || '' : '').trim();
      if (!cat || (!name && !zh)) { skipped++; continue; }
      let id = ix.id >= 0 ? String(row[ix.id] || '').trim() : '';
      if (!id || seen.has(id)) id = nextId(tmp, cat);
      seen.add(id);
      const occasions = [...new Set(splitList(ix.occ >= 0 ? row[ix.occ] : '').map((x) => OCC_ALIASES[x.toLowerCase()] || OCC_ALIASES[x]).filter(Boolean))];
      const weather = [...new Set(splitList(ix.wx >= 0 ? row[ix.wx] : '').map((x) => WX_ALIASES[x.toLowerCase()] || WX_ALIASES[x]).filter(Boolean))];
      const type = inferType(cat, name + ' ' + zh), color = colorFromName(ix.color >= 0 ? row[ix.color] : '') || '#9AA0A6';
      const at = autoTags(cat, type, color);
      const it = {
        id, cat, type, name: name || zh, nameZh: zh, color,
        occasions: occasions.length ? occasions : at.occasions, weather: weather.length ? weather : at.weather, laundry: false, addedAt: Date.now(),
      };
      items.push(it); tmp.items.push(it);
    }
    return { items, skipped, counters: tmp.counters };
  }
  function wardrobeCSV(state) {
    const lbl = { hot_humid: 'Hot & Humid', hot_sunny: 'Hot & Sunny', rainy: 'Rainy', aircon: 'Air-con / Cool', cool: 'Cool (Highlands)' };
    const occ = { ClientVisit: 'Client Visit' };
    const rows = [['Item ID', 'Category', 'Name (EN)', '名称 (中文)', 'Color', 'Style tags', 'Occasions', 'Weather', 'Photo file']];
    for (const i of state.items)
      rows.push([i.id, i.cat, i.name, i.nameZh || '', i.color, i.type, (i.occasions || []).map((o) => occ[o] || o).join(', '), (i.weather || []).map((w) => lbl[w]).join(', '), '']);
    return toCSV(rows);
  }

  Object.assign(OF, {
    engine: {
      CATEGORIES, CLOTHING, TYPES, OCCASIONS, WX, defaultState, itemStatus, lastWorn, conditions, generate, gapMatrix, suggestions,
      parseCSV, toCSV, importCSV, wardrobeCSV, nextId, colorFromName, hexToHsl, isNeutral, basicColorName, harmony, mulberry32, groom,
      minFeasibleN, inferType, relevant, autoTags, colorKey, applyFeedback, occasionFromText, FESTIVAL_COLORS,
    },
  });
})(typeof window !== 'undefined' ? window : globalThis);

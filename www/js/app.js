/* Daily Outfit: UI layer. Vanilla JS, no build step. */
(function () {
  'use strict';
  const OF = window.OF, E = OF.engine, I = OF.illustration;
  const t = (k, v) => OF.t(k, v);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = (id) => document.getElementById(id);

  let S = null;            // persisted state
  let photos = {};         // item id -> data URL
  let installEvt = null;
  const ui = { newkind: null,
    tab: 'today', occasion: 'Business', wxOverride: null, aircon: true, airconTouched: false,
    weather: null, wxStatus: 'idle', result: null, worn: null, filter: 'All', sheet: null, dialog: null, zoom: null,
    event: '', evMsg: '', logView: 'log', statsDays: 30, festival: '', fbOpen: null, exclude: [], batch: null, selfie: null,
  };

  const SKINS = ['#F6D9C4', '#E8BFA0', '#D2A27E', '#B98A66', '#8D5A3C', '#5C3A26'];
  const HAIRS = ['#17110F', '#2A1F1C', '#5A3A22', '#8A5A2B', '#B8863B', '#8B2E2E', '#6B6B70', '#D9D4C8'];
  const QUICK = ['#1E1E20', '#F7F5F0', '#CDB89A', '#1F2E4D', '#9AA0A6', '#C0392B', '#3E7B5A', '#E8A0B4', '#D4AF37', '#C0C0C0'];
  const OFFICE_OCC = ['Business', 'ClientVisit', 'Formal'];

  /* ------------------------------------------------------------ helpers */
  const nm = (it) => (OF.getLang() === 'zh' && it.nameZh ? it.nameZh : it.name);
  const byId = (id) => S.items.find((i) => i.id === id);
  const occLabel = (o) => t('occ.' + o);
  const occShort = (o) => (o === 'Festive' ? t('occs.Festive') : t('occ.' + o));
  const inkOn = (hex) => (E.hexToHsl(hex).l > 0.62 ? '#222' : '#fff');
  function todayStr() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function fmtDate(s) {
    const [y, m, d] = String(s).split('-').map(Number);
    if (!y) return s;
    return new Date(y, m - 1, d).toLocaleDateString(OF.getLang() === 'zh' ? 'zh-CN' : 'en-MY', { day: 'numeric', month: 'short' });
  }
  function save() { OF.store.saveState(S); }
  let toastTimer;
  function toast(msg) {
    const el = $('toast');
    el.textContent = msg; el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }
  function normalize(st) {
    const d = E.defaultState();
    if (!st) return d;
    const out = Object.assign(d, st);
    out.profile = Object.assign(E.defaultState().profile, st.profile || {});
    out.settings = Object.assign(E.defaultState().settings, st.settings || {});
    out.settings.rule = Object.assign(E.defaultState().settings.rule, (st.settings && st.settings.rule) || {});
    out.items = Array.isArray(st.items) ? st.items : [];
    out.log = Array.isArray(st.log) ? st.log : [];
    out.counters = st.counters || {};
    out.trip = Object.assign({ days: 5, occasions: ['Casual'], wx: ['hot_humid'], seed: 1, plan: null, checked: {} }, st.trip || {});
    out.customTypes = Array.isArray(st.customTypes) ? st.customTypes.filter((k) => k && k.id && k.cat && k.base && k.label) : [];
    out.feedback = { item: Object.assign({}, st.feedback && st.feedback.item), color: Object.assign({}, st.feedback && st.feedback.color) };
    if (st.onboarded == null) out.onboarded = out.items.length > 0 || out.log.length > 0;
    return out;
  }
  function currentCond() { return E.conditions(ui.weather, ui.wxOverride, ui.aircon); }
  function resetResults() { ui.result = null; ui.worn = null; ui.fbOpen = null; ui.exclude = []; }

  /* ------------------------------------------------------------ small components */
  function thumb(it, cls) {
    const p = photos[it.id];
    if (p) return `<img class="${cls || 'thumb'}" src="${p}" alt="">`;
    return `<div class="${cls || 'thumb'} sw" style="background:${esc(it.color)};color:${inkOn(it.color)}">${esc(t('cat.' + it.cat).slice(0, 1))}</div>`;
  }
  function chip(label, on, act, data) {
    const d = Object.entries(data || {}).map(([k, v]) => ` data-${k}="${esc(v)}"`).join('');
    return `<button type="button" class="chip${on ? ' on' : ''}" data-act="${act}"${d} aria-pressed="${!!on}">${esc(label)}</button>`;
  }
  function badge(it) {
    const s = E.itemStatus(S, it);
    const label = s.status === 'resting' ? t('status.resting', { k: s.wait }) : t('status.' + s.status);
    return `<span class="badge st-${s.status}">${esc(label)}</span>`;
  }

  /* ------------------------------------------------------------ views */
  function header() {
    const other = OF.getLang() === 'zh' ? 'EN' : '中文';
    return `<header class="top"><h1>${esc(t('app.title'))}</h1><button class="btn small ghost" data-act="lang" aria-label="Language">${other}</button></header>`;
  }
  function tabbar() {
    const tabs = [['today', 'tab.today'], ['wardrobe', 'tab.wardrobe'], ['trip', 'tab.trip'], ['history', 'tab.history'], ['gaps', 'tab.gaps'], ['settings', 'tab.settings']];
    return `<nav class="tabs" role="tablist">${tabs.map(([k, l]) =>
      `<button role="tab" class="tab${ui.tab === k ? ' on' : ''}" data-act="tab" data-tab="${k}" aria-selected="${ui.tab === k}">${esc(t(l))}</button>`).join('')}</nav>`;
  }

  function viewOnboarding() {
    const p = S.profile;
    const seg = (opts, cur, act) => `<div class="chips">${opts.map(([k, l]) => chip(l, String(cur) === String(k), act, { v: k })).join('')}</div>`;
    return `<section class="card"><h2>${esc(t('onb.title'))}</h2>
      <label class="lbl">${esc(t('onb.figure'))}</label>${seg([['feminine', t('figure.feminine')], ['neutral', t('figure.neutral')], ['masculine', t('figure.masculine')]], p.figure, 'figure')}
      <label class="lbl">${esc(t('onb.n'))}</label>${seg([[5, '5'], [10, '10'], [14, '14']], S.settings.n, 'onb-n')}
      <label class="lbl">${esc(t('onb.modest'))}</label>${seg([['1', t('onb.yes')], ['0', t('onb.no')]], p.modest ? '1' : '0', 'onb-modest')}
      <div class="stack" style="margin-top:14px"><button class="btn primary block" data-act="onb-done">${esc(t('onb.start'))}</button>
      <button class="btn block" data-act="onb-demo">${esc(t('onb.demo'))}</button></div></section>`;
  }

  function viewToday() {
    if (!S.onboarded) return viewOnboarding();
    if (!S.items.length) {
      return `<section class="card center"><h2>${esc(t('today.empty.title'))}</h2><p class="muted">${esc(t('today.empty.body'))}</p>
        <div class="stack"><button class="btn primary block" data-act="go-wardrobe">${esc(t('wardrobe.add'))}</button>
        <button class="btn block" data-act="demo">${esc(t('wardrobe.demo'))}</button></div></section>`;
    }
    const cond = currentCond();
    let h = `<section class="card"><label class="lbl" style="margin-top:0" for="evIn">${esc(t('today.event'))}</label>
      <div class="row"><input id="evIn" type="text" maxlength="80" value="${esc(ui.event)}" placeholder="${esc(t('today.eventPh'))}" autocomplete="off"><button class="btn" data-act="event-go">${esc(t('today.eventGo'))}</button></div>
      ${ui.evMsg ? `<p class="muted small">${esc(ui.evMsg)}</p>` : ''}</section>`;
    h += `<section class="card"><h2>${esc(t('today.occasion'))}</h2><div class="chips">${E.OCCASIONS.map((o) => chip(occLabel(o), ui.occasion === o, 'occ', { o })).join('')}</div>
      ${ui.occasion === 'Festive' ? `<label class="lbl">${esc(t('fest.title'))}</label><div class="chips">${[['', 'fest.any'], ['raya', 'fest.raya'], ['cny', 'fest.cny'], ['deepavali', 'fest.deepavali']].map(([k, l]) => chip(t(l), ui.festival === k, 'fest', { k })).join('')}</div>` : ''}</section>`;
    h += weatherCard(cond);
    h += `<button class="btn primary block big" data-act="suggest">${esc(ui.result ? t('today.again') : t('today.suggest'))}</button>`;
    if (ui.worn) h += wornCard();
    else if (ui.result) h += resultView();
    return h;
  }

  function weatherCard(cond) {
    let status;
    if (ui.wxStatus === 'loading') status = t('wx.loading');
    else if (ui.weather) status = t('wx.now', { t: ui.weather.temp, f: ui.weather.feels, h: ui.weather.humidity == null ? '–' : ui.weather.humidity, r: ui.weather.rainProb == null ? '–' : ui.weather.rainProb });
    else if (ui.wxStatus === 'denied') status = t('wx.denied');
    else if (ui.wxStatus === 'error') status = t('wx.error');
    else status = t('wx.default');
    const opts = [['', t('wx.auto')], ['hot_humid', t('wx.hot_humid')], ['hot_sunny', t('wx.hot_sunny')], ['rainy', t('wx.rainy')], ['cool', t('wx.cool')]];
    return `<section class="card"><div class="row between"><h2>${esc(t('wx.title'))}</h2><button class="btn small" data-act="locate">${esc(t('wx.locate'))}</button></div>
      <p class="muted small">${esc(status)}</p>
      <div class="chips">${opts.map(([k, l]) => chip(l, (ui.wxOverride || '') === k, 'wx', { k })).join('')}</div>
      <label class="check"><input type="checkbox" data-bind="aircon" ${ui.aircon ? 'checked' : ''}> <span>${esc(t('wx.aircon.toggle'))}</span></label></section>`;
  }

  function wornCard() {
    const n = ui.worn.n;
    return `<section class="card ok"><p>${esc(t('today.worn', { n, k: S.settings.n }))}</p>
      <div class="row"><button class="btn primary" data-act="suggest">${esc(t('today.suggestAgain'))}</button><button class="btn" data-act="undo">${esc(t('common.undo'))}</button></div></section>`;
  }

  function resultView() {
    const r = ui.result;
    if (!r.looks.length) return dryCard(r);
    let h = '';
    r.warnings.forEach((w) => {
      if (w.code === 'few_looks') h += `<p class="note">${esc(t('today.few', { n: w.n }))}</p>`;
      if (w.code === 'no_outer') h += `<p class="note">${esc(t('today.noouter'))}</p>`;
    });
    h += `<div class="chips">${chip(t('view.photos'), viewMode() === 'photos', 'view', { v: 'photos' })}${chip(t('view.illus'), viewMode() === 'illus', 'view', { v: 'illus' })}</div>`;
    r.looks.forEach((l, i) => { h += lookCard(l, i); });
    return h + `<p class="muted small center">${esc(t('today.zoom'))}</p>`;
  }

  /* ---- kinds: built-in plus the user's own */
  const typeText = (it) => it.custom || t('type.' + it.type);
  function kindList(c) {
    return E.TYPES[c].map((x) => ({ key: x, base: x, label: t('type.' + x), custom: false }))
      .concat((S.customTypes || []).filter((k) => k.cat === c).map((k) => ({ key: 'c:' + k.id, base: k.base, label: k.label, custom: true })));
  }
  const kindChips = (c, isOn, act) => kindList(c).map((k) => chip(k.label, isOn(k), act, { c, v: k.key })).join('') + chip(t('kind.add'), false, 'newkind', { c });
  function resolveKind(c, v) {
    if (String(v).startsWith('c:')) { const k = (S.customTypes || []).find((x) => 'c:' + x.id === v); if (k) return { type: k.base, custom: k.label }; }
    return { type: E.TYPES[c].includes(v) ? v : E.TYPES[c][0], custom: '' };
  }

  /* ---- flat-lay: the user's own photos arranged as an outfit board */
  function viewMode() { return S.profile.view || (Object.keys(photos).length ? 'photos' : 'illus'); }
  function flatlay(parts, label) {
    const W = 300, G = 8, LW = 184, RX = LW + 2 * G, RW = W - RX - G;
    const acc = E.ACCESSORIES.map((c) => parts[c]).filter(Boolean);
    const H = 400, SH = acc.length ? 70 : 0, TH = H + (SH ? SH + G : 0);
    const tile = (it, x, y, w, h) => {
      const r = 14, ph = photos[it.id], cid = 'c' + it.id.replace(/\W/g, '') + Math.round(x) + Math.round(y);
      const bg = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" style="fill:var(--chip)"/>`;
      if (ph) return `${bg}<clipPath id="${cid}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"/></clipPath><image href="${ph}" x="${x + 6}" y="${y + 6}" width="${w - 12}" height="${h - 12}" preserveAspectRatio="xMidYMid meet" clip-path="url(#${cid})"/>`;
      const c = it.color;
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${esc(c)}"/><text x="${x + w / 2}" y="${y + h / 2 + 4}" text-anchor="middle" font-size="${w < 100 ? 10 : 13}" fill="${inkOn(c)}" font-family="system-ui,sans-serif">${esc(typeText(it))}</text>`;
    };
    let out = '';
    if (parts.Dress) out += tile(parts.Dress, G, G, LW, H - 2 * G);
    else {
      const a = parts.Top, b = parts.Bottom;
      if (a && b) { const hh = Math.round((H - 3 * G) * 0.46); out += tile(a, G, G, LW, hh) + tile(b, G, 2 * G + hh, LW, H - 3 * G - hh); }
      else if (a || b) out += tile(a || b, G, G, LW, H - 2 * G);
    }
    const right = ['Outerwear', 'Shoes', 'Bag', 'Jewelry'].map((c) => parts[c]).filter(Boolean);
    if (right.length) {
      const hh = (H - G * (right.length + 1)) / right.length;
      right.forEach((it, k) => { out += tile(it, RX, G + k * (hh + G), RW, hh); });
    }
    if (acc.length) {                       // hat, scarf, belt, eyewear, watch along the bottom
      const n = acc.length, w = (W - G * (n + 1)) / n;
      acc.forEach((it, k) => { out += tile(it, G + k * (w + G), H + G - 4, w, SH); });
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${TH}" role="img" aria-label="${esc(label || '')}" preserveAspectRatio="xMidYMid meet">${out}</svg>`;
  }
  function lookPicture(l, i) {
    const label = t('today.look', { n: i + 1 });
    return viewMode() === 'photos' ? flatlay(l.parts, label) : I.render(S.profile, l.parts, l.groom, { label });
  }

  function lookCard(l, i) {
    const male = S.profile.figure === 'masculine' || !S.profile.makeup;
    const svg = lookPicture(l, i);
    const rows = E.CATEGORIES.filter((c) => l.parts[c]).map((c) =>
      `<li><span class="dot" style="background:${esc(l.parts[c].color)}"></span><span class="k">${esc(t('cat.' + c))}</span><span class="v">${esc(nm(l.parts[c]))}</span></li>`).join('');
    const stretch = l.stretch.length ? `<p class="note small">${esc(t('today.stretch', { names: l.stretch.map((id) => { const it = byId(id); return it ? nm(it) : id; }).join(', ') }))}</p>` : '';
    return `<article class="card look${viewMode() === 'photos' ? ' flat' : ''}"><button class="fig" data-act="zoom" data-i="${i}" aria-label="${esc(t('today.look', { n: i + 1 }))}">${svg}</button>
      <div class="info"><h3>${esc(t('today.look', { n: i + 1 }))}</h3><ul class="pieces">${rows}</ul>
      <p class="groom"><b>${esc(t('today.hair'))}</b> ${esc(t(l.groom.hairKey))}<br><b>${esc(male ? t('today.groom') : t('today.makeup'))}</b> ${esc(l.groom.makeupKeys.map((k) => t(k)).join(' '))}</p>
      ${stretch}<button class="btn primary block" data-act="wear" data-i="${i}">${esc(t('today.wear'))}</button>
      ${ui.fbOpen === i
        ? `<div class="fbbox"><p class="small">${esc(t('fb.ask'))}</p><div class="chips">${chip(t('fb.color'), false, 'fb', { i, r: 'color' })}${chip(t('fb.occasion', { o: occShort(ui.result.occasion) }), false, 'fb', { i, r: 'occasion' })}${chip(t('fb.piece'), false, 'fb', { i, r: 'piece' })}</div></div>`
        : `<button class="btn small ghost block" data-act="dislike" data-i="${i}">${esc(t('fb.no'))}</button>`}</div></article>`;
  }

  function dryCard(r) {
    const lines = ['Top', 'Bottom', 'Dress'].map((c) => {
      const d = r.missing[c];
      const next = d.resting && d.nextWait ? t('today.dry.next', { k: d.nextWait }) : '';
      return `<li>${esc(t('today.dry.line', { cat: t('catp.' + c), total: d.total, resting: d.resting, laundry: d.laundry, avail: d.available, next }))}</li>`;
    }).join('');
    const relax = r.suggestN != null
      ? `<p class="small">${esc(t('today.dry.relaxNote', { n: r.suggestN }))}</p><button class="btn primary" data-act="relax" data-n="${r.suggestN}">${esc(t('today.dry.relax', { n: r.suggestN }))}</button>` : '';
    return `<section class="card warn"><h2>${esc(t('today.dry.title'))}</h2><ul class="plain">${lines}</ul><p class="muted small">${esc(t('today.dry.hint'))}</p>${relax}</section>`;
  }

  function viewWardrobe() {
    const counts = { All: S.items.length };
    E.CATEGORIES.forEach((c) => (counts[c] = S.items.filter((i) => i.cat === c).length));
    const chips = ['All'].concat(E.CATEGORIES).map((c) => chip((c === 'All' ? t('wardrobe.all') : t('catp.' + c)) + ' ' + counts[c], ui.filter === c, 'filter', { c })).join('');
    const list = S.items.filter((i) => ui.filter === 'All' || i.cat === ui.filter)
      .sort((a, b) => E.CATEGORIES.indexOf(a.cat) - E.CATEGORIES.indexOf(b.cat) || nm(a).localeCompare(nm(b)));
    const rows = list.map((it) => `<div class="item" data-act="edit" data-id="${esc(it.id)}" role="button" tabindex="0">${thumb(it)}
      <div class="grow"><b>${esc(nm(it))}</b><div class="muted small">${esc(t('cat.' + it.cat))} · ${esc(typeText(it))} · ${esc(it.id)}</div>${badge(it)}</div>
      <button class="btn small ghost" data-act="laundry" data-id="${esc(it.id)}" aria-pressed="${!!it.laundry}">${esc(t('wardrobe.laundry'))}${it.laundry ? ' ✓' : ''}</button></div>`).join('');
    return `<section class="card"><div class="row wrap"><button class="btn primary" data-act="add">${esc(t('wardrobe.add'))}</button><button class="btn" data-act="pick-many">${esc(t('wardrobe.addMany'))}</button>
      <button class="btn" data-act="pick-csv">${esc(t('wardrobe.importCsv'))}</button><button class="btn" data-act="export-csv">${esc(t('wardrobe.exportCsv'))}</button><button class="btn" data-act="demo">${esc(t('wardrobe.demo'))}</button></div>
      <input type="file" id="fileCsv" hidden><input type="file" id="fileMany" accept="image/*" multiple hidden>
      <p class="muted small">${esc(t('wardrobe.count', { n: S.items.length }))} · ${esc(t('wardrobe.limit'))}</p>
      <div class="chips">${chips}</div></section>
      ${rows ? `<section class="list">${rows}</section>` : `<p class="muted center">${esc(t('wardrobe.empty'))}</p>`}`;
  }

  const money = (v) => (S.profile.currency || 'RM') + ' ' + (v >= 100 ? Math.round(v) : (Math.round(v * 100) / 100).toFixed(2));
  function viewStats() {
    const st = E.stats(S, { days: ui.statsDays });
    const periods = [[30, 'stats.p30'], [90, 'stats.p90'], [0, 'stats.pall']];
    let h = `<div class="chips">${periods.map(([d, l]) => chip(t(l), ui.statsDays === d, 'stats-p', { v: d })).join('')}</div>`;
    if (!S.log.length) return h + `<section class="card"><p class="muted">${esc(t('stats.none'))}</p></section>`;
    const pct = Math.round(st.utilisation * 100);
    h += `<section class="card"><h2>${esc(t('stats.overview'))}</h2>
      <p>${esc(t('stats.outfits', { n: st.outfits }))}</p>
      <p>${esc(t('stats.util', { a: st.wornCount, b: st.clothingCount, p: pct }))}</p>
      <div class="bar"><i style="width:${pct}%"></i></div>${st.outfits < 5 ? `<p class="muted small">${esc(t('stats.few'))}</p>` : ''}</section>`;
    const row = (it, right) => `<div class="item" data-act="edit" data-id="${esc(it.id)}" role="button" tabindex="0">${thumb(it)}<div class="grow"><b>${esc(nm(it))}</b><div class="muted small">${esc(typeText(it))} · ${esc(it.id)}</div></div><div class="small">${right}</div></div>`;
    if (st.most.length) h += `<section class="card"><h2>${esc(t('stats.most'))}</h2><div class="list">${st.most.map((x) => row(x.item, esc(t('stats.times', { n: x.n })))).join('')}</div></section>`;
    if (st.unused.length) h += `<section class="card"><h2>${esc(t('stats.unused', { n: st.unused.length }))}</h2><p class="muted small">${esc(t('stats.unusedHint'))}</p><div class="list">${st.unused.slice(0, 10).map((it) => row(it, it.price ? esc(money(it.price)) : '')).join('')}</div>${st.unused.length > 10 ? `<p class="muted small">+${st.unused.length - 10}</p>` : ''}</section>`;
    h += `<section class="card"><h2>${esc(t('stats.cpw'))}</h2>`;
    if (!st.pricedCount) h += `<p class="muted small">${esc(t('stats.priceHint'))}</p>`;
    else {
      if (st.neverWorn.length) h += `<p class="note">${esc(t('stats.neverWorn', { n: st.neverWorn.length, v: money(st.neverWornValue) }))}</p>`;
      h += `<div class="list">${st.worst.map((x) => row(x.item, `<b>${esc(money(x.cpw))}</b><br><span class="muted">${esc(t('stats.cpwLine', { p: money(x.item.price), n: x.wears }))}</span>`)).join('')}</div>`;
    }
    h += `</section>`;
    const occs = Object.entries(st.occ).sort((a, b) => b[1] - a[1]), max = occs.length ? occs[0][1] : 1;
    if (occs.length) h += `<section class="card"><h2>${esc(t('stats.byOcc'))}</h2>${occs.map(([o, n]) => `<div class="row between small"><span>${esc(occLabel(o))}</span><span>${n}</span></div><div class="bar"><i style="width:${Math.round(n / max * 100)}%"></i></div>`).join('')}</section>`;
    return h;
  }

  function viewHistory() {
    const sw = `<div class="chips">${chip(t('log.tab'), ui.logView === 'log', 'logview', { v: 'log' })}${chip(t('stats.tab'), ui.logView === 'stats', 'logview', { v: 'stats' })}</div>`;
    if (ui.logView === 'stats') return sw + viewStats();
    return sw + viewLog();
  }
  function viewLog() {
    const rule = `<p class="muted small">${esc(t('history.rule', { n: S.settings.n }))}</p>`;
    if (!S.log.length) return `<section class="card"><h2>${esc(t('history.title'))}</h2>${rule}<p class="muted">${esc(t('history.empty'))}</p></section>`;
    const rows = S.log.slice().reverse().map((e) => {
      const its = E.CATEGORIES.filter((c) => e.items[c]).map((c) => {
        const it = byId(e.items[c]);
        return `<span class="tag"><span class="dot" style="background:${esc(it ? it.color : '#999')}"></span>${esc(it ? nm(it) : e.items[c])}</span>`;
      }).join('');
      const wx = (e.cond || []).map((c) => t('wx.' + c)).join(', ');
      return `<article class="card"><div class="row between"><b>#${e.n}</b><span class="muted small">${esc(fmtDate(e.date))} · ${esc(occLabel(e.occasion))}${wx ? ' · ' + esc(wx) : ''}</span></div><div class="tags">${its}</div></article>`;
    }).join('');
    return `<section class="card"><div class="row between"><h2>${esc(t('history.title'))}</h2><button class="btn small" data-act="undo">${esc(t('history.undo'))}</button></div>${rule}</section>${rows}`;
  }

  /* ------------------------------------------------------------ trip packing list */
  function tripPlanItems() {
    const tp = S.trip.plan; if (!tp) return null;
    const days = tp.days.map((d) => ({ ...d, parts: Object.fromEntries(Object.entries(d.parts).map(([c, id]) => [c, byId(id)]).filter(([, it]) => it)) }));
    const packing = tp.packing.map((p) => ({ item: byId(p.id), days: p.days })).filter((p) => p.item);
    return { days, packing, missing: tp.missing || [], wear: (tp.wear || []).map(byId).filter(Boolean) };
  }
  function tripText() {
    const p = tripPlanItems(); if (!p) return '';
    const lines = [t('trip.shareTitle', { d: S.trip.days }), ''];
    E.CATEGORIES.forEach((c) => {
      const rows = p.packing.filter((x) => x.item.cat === c); if (!rows.length) return;
      lines.push(t('catp.' + c));
      rows.forEach((x) => lines.push((S.trip.checked[x.item.id] ? '[x] ' : '[ ] ') + nm(x.item) + (x.days.length > 1 ? ' ×' + x.days.length : '')));
      lines.push('');
    });
    if (p.wear.length) lines.push(t('trip.wear', { x: p.wear.map(nm).join(', ') }), '');
    lines.push(t('trip.plan'));
    p.days.forEach((d) => lines.push(t('trip.day', { d: d.day }) + ' · ' + occLabel(d.occasion) + ': ' + (Object.values(d.parts).map(nm).join(' + ') || '-')));
    return lines.join('\n');
  }
  function viewTrip() {
    if (!S.items.length) return `<section class="card center"><p>${esc(t('trip.empty'))}</p></section>`;
    const tr = S.trip, occs = ['Casual', 'Business', 'ClientVisit', 'Beach', 'Sport', 'Date', 'Party', 'Formal', 'Travel', 'Festive'];
    let h = `<section class="card"><h2>${esc(t('trip.title'))}</h2>
      <label class="lbl" for="tripDays">${esc(t('trip.days'))}</label><input id="tripDays" type="number" inputmode="numeric" min="1" max="21" value="${tr.days}">
      <label class="lbl">${esc(t('trip.occ'))}</label><div class="chips">${occs.map((o) => chip(occLabel(o), tr.occasions.includes(o), 'trip-occ', { v: o })).join('')}</div>
      <label class="lbl">${esc(t('trip.wx'))}</label><div class="chips">${E.WX.filter((w) => w !== 'aircon').map((w) => chip(t('wx.' + w), tr.wx.includes(w), 'trip-wx', { v: w })).join('')}</div>
      <button class="btn primary block" data-act="trip-go" style="margin-top:10px">${esc(t('trip.go'))}</button></section>`;
    const p = tripPlanItems();
    if (!p) return h;
    const naive = p.days.reduce((a, d) => a + Object.keys(d.parts).length, 0), done = p.packing.filter((x) => tr.checked[x.item.id]).length;
    h += `<section class="card"><h2>${esc(t('trip.list'))}</h2><p>${esc(t('trip.summary', { d: tr.days, n: p.packing.length, m: naive }))}</p>
      ${p.wear.length ? `<p class="small">${esc(t('trip.wear', { x: p.wear.map(nm).join(', ') }))}</p>` : ''}
      ${p.missing.length ? `<p class="note">${esc(t('trip.missing', { d: p.missing.join(', '), o: occLabel(p.days[p.missing[0] - 1].occasion) }))}</p>` : ''}
      <p class="muted small" id="tripProg">${esc(t('trip.packed', { a: done, b: p.packing.length }))}</p>
      ${E.CATEGORIES.map((c) => {
        const rows = p.packing.filter((x) => x.item.cat === c); if (!rows.length) return '';
        return `<h3>${esc(t('catp.' + c))}</h3><div class="list">${rows.map((x) => `<label class="item packrow"><input type="checkbox" data-act="trip-check" data-id="${esc(x.item.id)}" ${tr.checked[x.item.id] ? 'checked' : ''}>${thumb(x.item)}<div class="grow"><b>${esc(nm(x.item))}</b><div class="muted small">${esc(typeText(x.item))} · ${esc(t('trip.uses', { d: x.days.join(', ') }))}</div></div></label>`).join('')}</div>`;
      }).join('')}
      <div class="row wrap" style="margin-top:10px"><button class="btn" data-act="trip-share">${esc(t('trip.share'))}</button><button class="btn" data-act="trip-redo">${esc(t('trip.redo'))}</button><button class="btn ghost" data-act="trip-clear">${esc(t('trip.clear'))}</button></div></section>
      <section class="card"><h2>${esc(t('trip.plan'))}</h2>${p.days.map((d) => `<div class="tripday"><b>${esc(t('trip.day', { d: d.day }))}</b> <span class="muted small">${esc(occLabel(d.occasion))}</span><div class="tags">${Object.values(d.parts).map((it) => `<span class="tag"><span class="dot" style="background:${esc(it.color)}"></span>${esc(nm(it))}</span>`).join('') || `<span class="muted small">${esc(t('trip.noOutfit'))}</span>`}</div></div>`).join('')}</section>`;
    return h;
  }
  function tripGo(newSeed) {
    const tr = S.trip, inp = $('tripDays');
    if (inp) tr.days = Math.max(1, Math.min(21, parseInt(inp.value, 10) || 1));
    if (newSeed) tr.seed++;
    const r = E.planTrip(S, { days: tr.days, occasions: tr.occasions, wx: tr.wx }, tr.seed);
    tr.plan = {
      days: r.days.map((d) => ({ day: d.day, occasion: d.occasion, cond: d.cond, parts: Object.fromEntries(Object.entries(d.parts).map(([c, it]) => [c, it.id])) })),
      packing: r.packing.map((x) => ({ id: x.item.id, days: x.days })), missing: r.missing, wear: r.wear,
    };
    tr.checked = {};
    save(); render();
    setTimeout(() => { const el = $('tripProg'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 30);
  }

  function viewGaps() {
    const m = E.gapMatrix(S), min = S.settings.minItems;
    const head = `<tr><th></th>${E.OCCASIONS.map((o) => `<th><span>${esc(occShort(o))}</span></th>`).join('')}</tr>`;
    const body = E.CORE_CATS.map((c) => `<tr><th class="rowh">${esc(t('catp.' + c))}</th>${E.OCCASIONS.map((o) => (E.relevant(c, o) ? `<td class="${m[c][o] < min ? 'low' : 'okc'}">${m[c][o]}</td>` : `<td class="na">–</td>`)).join('')}</tr>`).join('');
    const sug = E.suggestions(S, 5);
    const lines = sug.map((x) => {
      const occ = x.occasions.map(occShort).join(' / ');
      const txt = x.cat === 'Jewelry'
        ? t('gaps.lineJ', { occ, have: x.have, min: x.min })
        : t('gaps.line', { color: t('color.' + x.color), type: t('type.' + x.type).toLowerCase(), occ, have: x.have, min: x.min });
      return `<li>${esc(txt)}</li>`;
    }).join('');
    return `<section class="card"><h2>${esc(t('gaps.title'))}</h2><p class="muted small">${esc(t('gaps.hint', { n: min }))}</p>
      <div class="scroll"><table class="gap">${head}${body}</table></div></section>
      <section class="card"><h2>${esc(t('gaps.suggest'))}</h2>${sug.length ? `<ul class="plain">${lines}</ul>` : `<p class="muted">${esc(t('gaps.none'))}</p>`}</section>`;
  }

  function viewSettings() {
    const p = S.profile;
    const sw = (arr, cur, act) => `<div class="swatches">${arr.map((c) => `<button class="swb${c.toLowerCase() === String(cur).toLowerCase() ? ' on' : ''}" style="background:${c}" data-act="${act}" data-v="${c}" aria-label="${c}"></button>`).join('')}</div>`;
    const seg = (opts, cur, act) => `<div class="chips">${opts.map(([k, l]) => chip(l, cur === k, act, { v: k })).join('')}</div>`;
    const rules = E.CATEGORIES.map((c) => `<label class="check"><input type="checkbox" data-bind="rule:${c}" ${S.settings.rule[c] ? 'checked' : ''}> <span>${esc(t('cat.' + c))}</span></label>`).join('');
    const install = installEvt ? `<button class="btn block" data-act="install">${esc(t('settings.install'))}</button>` : `<p class="muted small">${esc(t('settings.install'))}: ${esc(t('settings.installHelp'))}</p>`;
    return `<section class="card"><h2>${esc(t('settings.lang'))}</h2>${seg([['en', 'English'], ['zh', '中文']], p.lang, 'setlang')}</section>
      <section class="card"><h2>${esc(t('settings.profile'))}</h2>
        <label class="lbl">${esc(t('settings.figure'))}</label>${seg([['feminine', t('figure.feminine')], ['neutral', t('figure.neutral')], ['masculine', t('figure.masculine')]], p.figure, 'figure')}
        <label class="lbl">${esc(t('settings.skin'))}</label>${sw(SKINS, p.skin, 'skin')}
        <label class="lbl">${esc(t('settings.hairColor'))}</label>${sw(HAIRS, p.hairColor, 'haircolor')}
        <label class="lbl">${esc(t('settings.hairLength'))}</label>${seg([['long', t('hl.long')], ['medium', t('hl.medium')], ['short', t('hl.short')]], p.hairLength, 'hairlen')}
        <label class="check"><input type="checkbox" data-bind="makeup" ${p.makeup ? 'checked' : ''}> <span>${esc(t('settings.makeup'))}</span></label>
        <label class="lbl" for="curIn">${esc(t('settings.currency'))}</label><input id="curIn" type="text" maxlength="4" value="${esc(S.profile.currency || 'RM')}" data-bind="currency">
        <label class="check"><input type="checkbox" data-bind="modest" ${p.modest ? 'checked' : ''}> <span>${esc(t('settings.modest'))}</span></label>
        <label class="check"><input type="checkbox" data-bind="removeBg" ${p.removeBg ? 'checked' : ''}> <span>${esc(t('settings.removeBg'))}</span></label>
        <button class="btn block" data-act="selfie" style="margin-top:8px">${esc(t('settings.selfie'))}</button><input type="file" id="fileSelfie" accept="image/*" hidden>
        <p class="muted small">${esc(t('settings.fbInfo'))}</p><button class="btn block" data-act="fb-reset">${esc(t('settings.fbReset'))}</button></section>
      <section class="card"><h2>${esc(t('custom.mine'))}</h2>${S.customTypes.length ? `<div class="tags">${S.customTypes.map((k) => `<span class="tag">${esc(k.label)} <span class="muted small">(${esc(t('type.' + k.base))})</span><button class="btn small ghost" data-act="ct-del" data-id="${esc(k.id)}" aria-label="${esc(t('custom.del'))}">✕</button></span>`).join('')}</div>` : `<p class="muted small">${esc(t('custom.none'))}</p>`}</section>
      <section class="card"><h2>${esc(t('settings.rules'))}</h2>
        <label class="lbl" for="nIn">${esc(t('settings.n'))}</label><input id="nIn" type="number" inputmode="numeric" min="0" max="60" value="${S.settings.n}" data-bind="n">
        <label class="lbl">${esc(t('settings.apply'))}</label><div class="checks">${rules}</div>
        <label class="lbl" for="minIn">${esc(t('settings.min'))}</label><input id="minIn" type="number" inputmode="numeric" min="1" max="20" value="${S.settings.minItems}" data-bind="min"></section>
      <section class="card"><h2>${esc(t('settings.data'))}</h2><div class="stack">
        <button class="btn block" data-act="export-json">${esc(t('settings.exportJson'))}</button><p class="muted small" style="margin:0">${esc(t('export.jsonHelp'))}</p>
        <button class="btn block" data-act="export-csv">${esc(t('settings.exportCsv'))}</button><p class="muted small" style="margin:0">${esc(t('export.csvHelp'))}</p>
        <button class="btn block" data-act="pick-json">${esc(t('settings.importJson'))}</button><input type="file" id="fileJson" hidden>
        <button class="btn block danger" data-act="reset">${esc(t('settings.reset'))}</button></div>
        <p class="muted small">${esc(t('settings.privacy'))}</p>${OF.store.isMemory() ? '<p class="note small">Storage is unavailable in this browser mode: data will be lost when you close the page.</p>' : ''}</section>
      <section class="card">${install}<p class="muted small">${esc(t('settings.about'))}</p></section>`;
  }

  /* ------------------------------------------------------------ item sheet */
  function openSheet(id) {
    const it = id ? byId(id) : null;
    ui.sheet = {
      id: it ? it.id : null, photo: it ? photos[it.id] || null : null, photoChanged: false, colorAuto: false,
      draft: it ? { cat: it.cat, type: it.type, custom: it.custom || '', price: it.price || 0, name: it.name, nameZh: it.nameZh || '', color: it.color, occasions: (it.occasions || []).slice(), weather: (it.weather || []).slice(), laundry: !!it.laundry }
        : { cat: null, type: null, custom: '', price: 0, name: '', nameZh: '', color: '#1E1E20', occasions: [], weather: [], laundry: false },
      tagsTouched: !!it, fineOpen: false,
    };
    renderSheet();
  }
  function readDraft() {
    const sh = ui.sheet; if (!sh || !$('f-name')) return;
    const d = sh.draft;
    d.name = $('f-name').value; d.nameZh = $('f-zh').value; d.color = $('f-color').value; d.price = parseFloat($('f-price').value) || 0;
    d.occasions = [...document.querySelectorAll('#f-occ .chip.on')].map((e) => e.dataset.v);
    d.weather = [...document.querySelectorAll('#f-wx .chip.on')].map((e) => e.dataset.v);
    d.laundry = $('f-laundry').checked;
    sh.fineOpen = $('f-fine').open;
  }
  function renderSheet() {
    const root = $('sheet-root');
    if (!ui.sheet) { root.innerHTML = ''; return; }
    const sh = ui.sheet, d = sh.draft;
    const prev = sh.photo ? `<img class="photo-prev" src="${sh.photo}" alt="">` : `<div class="photo-prev sw" style="background:${esc(d.color)}"></div>`;
    root.innerHTML = `<div class="overlay" data-act="sheet-bg"><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(t(sh.id ? 'sheet.edit' : 'sheet.add'))}">
      <div class="row between"><h2>${esc(t(sh.id ? 'sheet.edit' : 'sheet.add'))}</h2><button class="btn small ghost" data-act="sheet-close" aria-label="${esc(t('common.close'))}">✕</button></div>
      <div class="row"><div>${prev}</div><div class="stack grow"><button class="btn small" data-act="pick-cam">${esc(t('sheet.camera'))}</button><button class="btn small" data-act="pick-gal">${esc(t('sheet.gallery'))}</button></div></div>
      <input type="file" id="fileCam" accept="image/*" capture="environment" hidden><input type="file" id="fileGal" accept="image/*" hidden>
      ${sh.colorAuto ? `<p class="muted small">${esc(t('sheet.colorAuto'))}</p>` : ''}
      <label class="lbl">${esc(t('sheet.kind'))}</label>
      ${E.CATEGORIES.map((c) => `<div class="kgroup"><span class="klabel">${esc(t('cat.' + c))}</span><div class="chips">${kindChips(c, (k) => d.cat === c && (k.custom ? d.custom === k.label : !d.custom && d.type === k.base), 'kind')}</div></div>`).join('')}
      <label class="lbl" for="f-name">${esc(t('sheet.nameHint'))}</label><input id="f-name" type="text" value="${esc(d.name)}" maxlength="60" autocomplete="off">
      <label class="lbl" for="f-zh">${esc(t('sheet.nameZh'))}</label><input id="f-zh" type="text" value="${esc(d.nameZh)}" maxlength="40" autocomplete="off">
      <label class="lbl" for="f-color">${esc(t('sheet.color'))}</label>
      <div class="row wrap"><input id="f-color" type="color" value="${esc(d.color)}">${QUICK.map((c) => `<button type="button" class="swb sm" style="background:${c}" data-act="quickcolor" data-v="${c}" aria-label="${c}"></button>`).join('')}</div>
      <label class="lbl" for="f-price">${esc(t('sheet.price', { c: S.profile.currency || 'RM' }))}</label><input id="f-price" type="number" inputmode="decimal" min="0" step="0.01" value="${d.price ? esc(d.price) : ''}">
      <details id="f-fine" ${sh.fineOpen ? 'open' : ''}><summary>${esc(t('sheet.fine'))}</summary>
      <p class="muted small">${esc(t('sheet.auto'))}</p>
      <label class="lbl">${esc(t('sheet.occasions'))}</label><div class="chips" id="f-occ">${E.OCCASIONS.map((o) => chip(occLabel(o), d.occasions.includes(o), 'togglechip', { v: o })).join('')}</div>
      <label class="lbl">${esc(t('sheet.weather'))}</label><div class="chips" id="f-wx">${E.WX.map((w) => chip(t('wx.' + w), d.weather.includes(w), 'togglechip', { v: w })).join('')}</div></details>
      <label class="check"><input type="checkbox" id="f-laundry" ${d.laundry ? 'checked' : ''}> <span>${esc(t('sheet.laundry'))}</span></label>
      <div class="row end"><button class="btn" data-act="sheet-close">${esc(t('common.cancel'))}</button>${sh.id ? `<button class="btn danger" data-act="sheet-delete">${esc(t('common.delete'))}</button>` : ''}<button class="btn primary" data-act="sheet-save">${esc(t('common.save'))}</button></div>
    </div></div>`;
  }
  /** "Black shirt" / "黑色衬衫" from the colour and the kind of item */
  function autoName(lang, d) {
    const col = OF.tIn(lang, 'color.' + E.colorKey(d.color)), ty = d.custom || OF.tIn(lang, 'type.' + d.type);
    return lang === 'zh' ? col + ty : col.charAt(0).toUpperCase() + col.slice(1) + ' ' + ty.toLowerCase();
  }
  function saveSheet() {
    readDraft();
    const sh = ui.sheet, d = sh.draft;
    if (!d.type) { toast(t('sheet.needKind')); return; }
    if (!sh.tagsTouched) { const a = E.autoTags(d.cat, d.type, d.color); d.occasions = a.occasions; d.weather = a.weather; }
    if (!d.name.trim() && !d.nameZh.trim()) { d.name = autoName('en', d); d.nameZh = autoName('zh', d); }
    let it;
    if (sh.id) it = byId(sh.id);
    else { it = { id: E.nextId(S, d.cat), addedAt: Date.now() }; S.items.push(it); }
    if (sh.id && it.cat !== d.cat) { /* category changed: keep id stable */ }
    if (d.custom) it.custom = d.custom; else delete it.custom;
    if (d.price > 0) it.price = d.price; else delete it.price;
    Object.assign(it, { cat: d.cat, type: d.type, name: d.name.trim() || d.nameZh.trim(), nameZh: d.nameZh.trim(), color: d.color, occasions: d.occasions, weather: d.weather, laundry: d.laundry });
    if (sh.photoChanged && sh.photo) { photos[it.id] = sh.photo; OF.store.putPhoto(it.id, sh.photo); }
    save(); ui.sheet = null; resetResults(); renderSheet(); render(); toast(t('toast.saved'));
  }

  /* ------------------------------------------------------------ photo + colour */
  /** Remove a plain background by flood-filling from the photo border. Returns a canvas with transparency, or null. */
  function cutout(c) {
    const w = c.width, h = c.height, ctx = c.getContext('2d');
    const img = ctx.getImageData(0, 0, w, h), d = img.data;
    const at = (x, y) => (y * w + x) * 4;
    const border = [];
    for (let x = 0; x < w; x++) { border.push([x, 0], [x, h - 1]); }
    for (let y = 1; y < h - 1; y++) { border.push([0, y], [w - 1, y]); }
    let r = 0, g = 0, b = 0;
    border.forEach(([x, y]) => { const i = at(x, y); r += d[i]; g += d[i + 1]; b += d[i + 2]; });
    r /= border.length; g /= border.length; b /= border.length;
    const near = (i, tol) => (d[i] - r) ** 2 + (d[i + 1] - g) ** 2 + (d[i + 2] - b) ** 2 < tol * tol;
    const ok = border.filter(([x, y]) => near(at(x, y), 40)).length / border.length;
    if (ok < 0.85) return null;
    const seen = new Uint8Array(w * h), q = new Int32Array(w * h);
    let head = 0, tail = 0, removed = 0;
    border.forEach(([x, y]) => { const k = y * w + x; if (!seen[k] && near(k * 4, 52)) { seen[k] = 1; q[tail++] = k; } });
    while (head < tail) {
      const k = q[head++], x = k % w, y = (k - x) / w;
      d[k * 4 + 3] = 0; removed++;
      if (x > 0) { const n = k - 1; if (!seen[n] && near(n * 4, 52)) { seen[n] = 1; q[tail++] = n; } }
      if (x < w - 1) { const n = k + 1; if (!seen[n] && near(n * 4, 52)) { seen[n] = 1; q[tail++] = n; } }
      if (y > 0) { const n = k - w; if (!seen[n] && near(n * 4, 52)) { seen[n] = 1; q[tail++] = n; } }
      if (y < h - 1) { const n = k + w; if (!seen[n] && near(n * 4, 52)) { seen[n] = 1; q[tail++] = n; } }
    }
    const keep = 1 - removed / (w * h);
    if (keep < 0.08 || keep > 0.85) return null;
    ctx.putImageData(img, 0, 0);
    return c;
  }
  function readPhoto(file, removeBg) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => {
        try {
          const r = Math.min(1, (removeBg ? 360 : 480) / Math.max(img.naturalWidth, img.naturalHeight));
          const c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(img.naturalWidth * r)); c.height = Math.max(1, Math.round(img.naturalHeight * r));
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          URL.revokeObjectURL(url);
          let cut = null;
          if (removeBg) { try { cut = cutout(c); } catch (e) { cut = null; } }
          resolve({ dataUrl: cut ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.78), color: dominant(c), cut: !!cut });
        } catch (e) { reject(e); }
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image')); };
      img.src = url;
    });
  }
  /** most common colour in the centre of the picture, ignoring near-white backgrounds */
  function dominant(canvas) {
    const n = 40, c = document.createElement('canvas'); c.width = n; c.height = n;
    const x = c.getContext('2d'); x.drawImage(canvas, 0, 0, n, n);
    const d = x.getImageData(0, 0, n, n).data, bins = new Map(), lo = Math.round(n * 0.2), hi = Math.round(n * 0.8);
    for (let yy = lo; yy < hi; yy++) for (let xx = lo; xx < hi; xx++) {
      const i = (yy * n + xx) * 4, r = d[i], g = d[i + 1], b = d[i + 2];
      if (d[i + 3] < 200 || (r > 238 && g > 238 && b > 238)) continue;
      const k = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4), e = bins.get(k) || { c: 0, r: 0, g: 0, b: 0 };
      e.c++; e.r += r; e.g += g; e.b += b; bins.set(k, e);
    }
    let best = null; bins.forEach((e) => { if (!best || e.c > best.c) best = e; });
    if (!best) return '#F7F5F0';
    return '#' + [best.r, best.g, best.b].map((v) => Math.round(v / best.c).toString(16).padStart(2, '0')).join('');
  }
  async function onPhoto(file) {
    if (!file) return;
    readDraft();
    try {
      const { dataUrl, color, cut } = await readPhoto(file, S.profile.removeBg);
      if (S.profile.removeBg && !cut) toast(t('toast.bgFail'));
      ui.sheet.photo = dataUrl; ui.sheet.photoChanged = true; ui.sheet.draft.color = color; ui.sheet.colorAuto = true;
      renderSheet();
    } catch (e) { toast('Could not read that photo'); }
  }

  /* ------------------------------------------------------------ batch add: many photos, assign kinds in bulk */
  const stem = (n) => String(n || '').replace(/\.[^.]+$/, '').trim().toLowerCase();
  function matchItem(file) {
    const k = stem(file.name); if (!k) return null;
    const it = S.items.find((i) => i.id.toLowerCase() === k || String(i.name).toLowerCase() === k || (i.nameZh && i.nameZh.toLowerCase() === k));
    return it ? it.id : null;
  }
  async function startBatch(files) {
    const list = [...files].filter((f) => /^image\//.test(f.type) || !f.type).slice(0, 200);
    if (!list.length) return;
    const b = ui.batch = { entries: [], loaded: 0, total: list.length, cat: 'Top', failed: 0 };
    renderBatch();
    for (const f of list) {
      if (ui.batch !== b) return;      // cancelled
      try {
        const cur = await readPhoto(f, S.profile.removeBg);
        b.entries.push({ name: f.name, cur, match: matchItem(f), cat: null, type: null, custom: '', sel: false });
      } catch (e) { b.failed++; }
      b.loaded++;
      if (b.loaded % 4 === 0 || b.loaded === b.total) renderBatch();
    }
    renderBatch();
  }
  const bAssigned = (e) => !!(e.match || e.type);
  function cellHtml(e, i) {
    const label = e.match ? '→ ' + e.match : e.type ? (e.custom || t('type.' + e.type)) : '?';
    return `<button type="button" class="bcell${e.sel ? ' sel' : ''}${bAssigned(e) ? ' done' : ''}" data-act="bcell" data-i="${i}" id="bc-${i}" aria-pressed="${e.sel}"><img src="${e.cur.dataUrl}" alt=""><span class="bl">${esc(label)}</span></button>`;
  }
  function batchCounts() {
    const b = ui.batch, n = b.entries.filter(bAssigned).length, sel = b.entries.filter((e) => e.sel).length;
    return { n, sel, left: b.entries.length - n };
  }
  function refreshBatchBar() {
    const b = ui.batch; if (!b) return;
    const c = batchCounts(), save = $('bsave'), info = $('binfo');
    if (save) { save.textContent = t('batch.save', { n: c.n }); save.classList.toggle('idle', c.n === 0); }
    if (info) info.textContent = t('batch.info', { sel: c.sel, left: c.left });
  }
  function renderBatch() {
    const root = $('sheet-root'), b = ui.batch;
    if (!b) { if (!ui.sheet) root.innerHTML = ''; return; }
    const loading = b.loaded < b.total;
    root.innerHTML = `<div class="overlay"><div class="sheet batch" role="dialog" aria-modal="true">
      <div class="row between"><h2>${esc(t('batch.title'))}</h2><button class="btn small ghost" data-act="batch-stop">${esc(t('common.close'))}</button></div>
      ${loading ? `<p class="muted small">${esc(t('batch.loading', { i: b.loaded, n: b.total }))}</p>` : `<p class="muted small">${esc(t('batch.hint'))}</p>`}
      ${b.failed ? `<p class="note small">${esc(t('batch.failed', { n: b.failed }))}</p>` : ''}
      <div class="row wrap"><button class="btn small" data-act="bsel-all">${esc(t('batch.all'))}</button><button class="btn small" data-act="bsel-open">${esc(t('batch.open'))}</button><button class="btn small ghost" data-act="bsel-none">${esc(t('batch.none'))}</button></div>
      <p class="small muted" id="binfo"></p>
      <div class="bgrid">${b.entries.map(cellHtml).join('')}</div>
      <div class="bbar"><div class="chips">${E.CATEGORIES.map((c) => chip(t('cat.' + c), b.cat === c, 'bcat', { c })).join('')}</div>
      <div class="chips">${kindList(b.cat).map((k) => chip(k.label, false, 'bkind', { c: b.cat, v: k.key })).join('')}${chip(t('kind.add'), false, 'newkind', { c: b.cat })}</div>
      <button class="btn primary block" id="bsave" data-act="bsave">${esc(t('batch.save', { n: 0 }))}</button></div></div></div>`;
    refreshBatchBar();
  }
  function bUpdateCell(i) {
    const e = ui.batch.entries[i], el = $('bc-' + i); if (!el) return;
    el.outerHTML = cellHtml(e, i);
  }
  function bSelect(fn) { ui.batch.entries.forEach((e, i) => { const v = fn(e); if (v !== e.sel) { e.sel = v; bUpdateCell(i); } }); refreshBatchBar(); }
  function bAssign(cat, type) {
    const b = ui.batch; let any = false;
    b.entries.forEach((e, i) => { if (e.sel) { const k = resolveKind(cat, type); e.cat = cat; e.type = k.type; e.custom = k.custom; e.sel = false; any = true; bUpdateCell(i); } });
    if (!any) { toast(t('batch.pick')); return; }
    refreshBatchBar();
  }
  function bSave() {
    const b = ui.batch;
    if (!b.entries.some(bAssigned)) { toast(t('batch.needKind')); return; }
    try { bSaveNow(); } catch (err) { toast(t('batch.err', { m: (err && err.message) || err })); }
  }
  function bSaveNow() {
    const b = ui.batch; let added = 0, attached = 0;
    b.entries.forEach((e) => {
      if (e.match) {
        const it = byId(e.match);
        if (it) { photos[it.id] = e.cur.dataUrl; Promise.resolve(OF.store.putPhoto(it.id, e.cur.dataUrl)).catch(() => toast(t('batch.err', { m: 'storage' }))); attached++; }
      } else if (e.type) {
        const d = { cat: e.cat, type: e.type, custom: e.custom, color: e.cur.color }, a = E.autoTags(e.cat, e.type, d.color);
        const it = { id: E.nextId(S, e.cat), addedAt: Date.now(), cat: e.cat, type: e.type, ...(e.custom ? { custom: e.custom } : {}), name: autoName('en', d), nameZh: autoName('zh', d), color: d.color, occasions: a.occasions, weather: a.weather, laundry: false };
        S.items.push(it); photos[it.id] = e.cur.dataUrl; Promise.resolve(OF.store.putPhoto(it.id, e.cur.dataUrl)).catch(() => toast(t('batch.err', { m: 'storage' }))); added++;
      }
    });
    save(); resetResults();
    b.entries = b.entries.filter((e) => !bAssigned(e));
    if (b.entries.length) { renderBatch(); } else { ui.batch = null; renderBatch(); }
    render();
    toast(t('batch.done', { n: added, m: attached }));
  }
  function closeBatch() { ui.batch = null; renderBatch(); render(); }

  /* ------------------------------------------------------------ selfie colour picker (nothing is stored) */
  function openSelfie(file) {
    if (!file) return;
    ui.selfie = { url: URL.createObjectURL(file), mode: 'skin' };
    renderSelfie();
    const img = new Image();
    img.onload = () => {
      const cv = $('selfieCv'); if (!cv) return;
      const r = Math.min(1, 320 / Math.max(img.naturalWidth, img.naturalHeight));
      cv.width = Math.round(img.naturalWidth * r); cv.height = Math.round(img.naturalHeight * r);
      cv.getContext('2d', { willReadFrequently: true }).drawImage(img, 0, 0, cv.width, cv.height);
    };
    img.src = ui.selfie.url;
  }
  function closeSelfie() { if (ui.selfie) URL.revokeObjectURL(ui.selfie.url); ui.selfie = null; $('sheet-root').innerHTML = ''; render(); }
  function renderSelfie() {
    const sf = ui.selfie; if (!sf) return;
    const sw = (c) => `<span class="dot" style="width:22px;height:22px;background:${c}"></span>`;
    $('sheet-root').innerHTML = `<div class="overlay"><div class="sheet" role="dialog" aria-modal="true"><div class="row between"><h2>${esc(t('selfie.title'))}</h2></div>
      <p class="muted small">${esc(t('selfie.hint'))}</p>
      <div class="chips">${chip(t('selfie.skin'), sf.mode === 'skin', 'selfie-mode', { v: 'skin' })}${chip(t('selfie.hair'), sf.mode === 'hair', 'selfie-mode', { v: 'hair' })}</div>
      <canvas id="selfieCv" style="max-width:100%;border-radius:12px;touch-action:manipulation"></canvas>
      <div class="row" style="margin-top:8px"><span id="skinSw">${sw(S.profile.skin)}</span><span id="hairSw">${sw(S.profile.hairColor)}</span></div>
      <div class="row end"><button class="btn primary" data-act="selfie-done">${esc(t('selfie.done'))}</button></div></div></div>`;
  }
  function nearestOf(palette, r, g, b) {
    let best = palette[0], bd = Infinity;
    palette.forEach((hex) => {
      const [r2, g2, b2] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
      const d = 2 * (r - r2) ** 2 + 4 * (g - g2) ** 2 + 3 * (b - b2) ** 2;
      if (d < bd) { bd = d; best = hex; }
    });
    return best;
  }
  function selfieTap(e) {
    const cv = e.target, rect = cv.getBoundingClientRect();
    const x = Math.round((e.clientX - rect.left) * cv.width / rect.width), y = Math.round((e.clientY - rect.top) * cv.height / rect.height);
    const k = 4, x0 = Math.max(0, x - k), y0 = Math.max(0, y - k), w = Math.min(cv.width - x0, 2 * k + 1), h = Math.min(cv.height - y0, 2 * k + 1);
    if (w < 1 || h < 1) return;
    const d = cv.getContext('2d').getImageData(x0, y0, w, h).data;
    let r = 0, g = 0, b = 0; const n = d.length / 4;
    for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
    r /= n; g /= n; b /= n;
    if (ui.selfie.mode === 'skin') { S.profile.skin = nearestOf(SKINS, r, g, b); $('skinSw').firstChild.style.background = S.profile.skin; }
    else { S.profile.hairColor = nearestOf(HAIRS, r, g, b); $('hairSw').firstChild.style.background = S.profile.hairColor; }
    save(); resetResults();
  }

  /* ------------------------------------------------------------ dialogs + zoom */
  function renderDialog() {
    const root = $('dialog-root');
    if (ui.zoom != null && ui.result && ui.result.looks[ui.zoom]) {
      const l = ui.result.looks[ui.zoom];
      root.innerHTML = `<div class="overlay" data-act="zoom-close"><div class="zoom${viewMode() === 'photos' ? ' flatz' : ''}">${viewMode() === 'photos' ? flatlay(l.parts, '') : I.render(S.profile, l.parts, l.groom)}<button class="btn" data-act="zoom-close">${esc(t('common.close'))}</button></div></div>`;
    } else if (ui.newkind) {
      const n = ui.newkind;
      root.innerHTML = `<div class="overlay"><div class="sheet small-sheet" role="dialog" aria-modal="true"><h2>${esc(t('custom.title'))}</h2>
        <label class="lbl" for="nk-name">${esc(t('custom.name'))}</label><input id="nk-name" type="text" maxlength="40" value="${esc(n.name)}" autocomplete="off">
        <label class="lbl">${esc(t('custom.cat'))}</label><div class="chips">${E.CATEGORIES.map((c) => chip(t('cat.' + c), n.cat === c, 'nk-cat', { c })).join('')}</div>
        <label class="lbl">${esc(t('custom.base'))}</label><div class="chips">${E.TYPES[n.cat].map((x) => chip(t('type.' + x), n.base === x, 'nk-base', { v: x })).join('')}</div>
        <div class="row end"><button class="btn" data-act="nk-cancel">${esc(t('common.cancel'))}</button><button class="btn primary" data-act="nk-save">${esc(t('custom.save'))}</button></div></div></div>`;
    } else if (ui.dialog) {
      root.innerHTML = `<div class="overlay"><div class="sheet small-sheet" role="alertdialog"><p>${esc(ui.dialog.msg)}</p><div class="row end"><button class="btn" data-act="dlg-no">${esc(t('common.no'))}</button><button class="btn danger" data-act="dlg-yes">${esc(t('common.yes'))}</button></div></div></div>`;
    } else root.innerHTML = '';
  }
  function ask(msg, onYes) { ui.dialog = { msg, onYes }; renderDialog(); }

  /* ------------------------------------------------------------ actions */
  function suggest() {
    ui.worn = null;
    ui.fbOpen = null;
    ui.result = E.generate(S, ui.occasion, currentCond(), { festival: ui.occasion === 'Festive' ? ui.festival || null : null, exclude: ui.exclude });
    render();
    setTimeout(() => { const el = document.querySelector('.look, .card.warn'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 30);
  }
  function wear(i) {
    const r = ui.result, l = r && r.looks[i]; if (!l) return;
    const items = {};
    E.CATEGORIES.forEach((c) => { if (l.parts[c]) items[c] = l.parts[c].id; });
    const n = S.log.length + 1;
    S.log.push({ n, date: todayStr(), occasion: r.occasion, cond: r.cond, items, hair: l.groom.hairKey });
    save(); ui.worn = { n }; ui.result = null; render(); window.scrollTo({ top: 0 });
  }
  function undo() {
    if (!S.log.length) return;
    S.log.pop(); save(); ui.worn = null; ui.result = null; render(); toast(t('toast.undone'));
  }
  async function locate() {
    ui.wxStatus = 'loading'; render();
    try {
      const pos = await OF.weather.getPosition();
      ui.weather = await OF.weather.fetchWeather(pos.lat, pos.lon);
      ui.wxStatus = 'ok'; ui.wxOverride = null; resetResults();
    } catch (e) {
      ui.wxStatus = e && e.code === 1 ? 'denied' : 'error';
    }
    render();
  }
  function loadDemo() {
    const go = () => {
      const d = OF.demo.makeDemoItems(S);
      S.items.push(...d.items); S.counters = d.counters; save(); resetResults(); render(); toast(t('toast.demo'));
    };
    S.items.length ? ask(t('confirm.demo'), go) : go();
  }
  function download(name, mime, text) {
    const url = URL.createObjectURL(new Blob([text], { type: mime }));
    const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
  function capPlugin(name) {
    const C = window.Capacitor; if (!C) return null;
    try { return (C.Plugins && C.Plugins[name]) || (C.registerPlugin ? C.registerPlugin(name) : null); } catch (e) { return null; }
  }
  /** Android app: write to the cache folder and open the share sheet (Drive, WhatsApp, Files...). Browser: share sheet or plain download. */
  async function shareFile(name, mime, text) {
    const C = window.Capacitor, FS = capPlugin('Filesystem'), SH = capPlugin('Share');
    if (C && C.isNativePlatform && C.isNativePlatform() && FS && SH) {
      try {
        const CH = 900000; let i = 0, first = true;
        while (first || i < text.length) {
          let j = Math.min(text.length, i + CH);
          const cc = text.charCodeAt(j - 1); if (j < text.length && cc >= 0xd800 && cc <= 0xdbff) j--;   // do not split a surrogate pair
          const part = text.slice(i, j);
          if (first) { await FS.writeFile({ path: name, data: part, directory: 'CACHE', encoding: 'utf8' }); first = false; }
          else await FS.appendFile({ path: name, data: part, directory: 'CACHE', encoding: 'utf8' });
          i = j;
        }
        const { uri } = await FS.getUri({ path: name, directory: 'CACHE' });
        await SH.share({ title: name, dialogTitle: name, url: uri });
        return;
      } catch (e) {
        if (/cancel/i.test(String((e && e.message) || e))) return;
        toast(t('toast.exportFail', { m: String((e && e.message) || e).slice(0, 80) }));
      }
    }
    try {
      if (navigator.canShare && typeof File === 'function') {
        const f = new File([text], name, { type: mime });
        if (navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], title: name }); return; }
      }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    download(name, mime, text); toast(t('toast.exported', { f: name }));
  }
  const stamp = () => new Date().toISOString().slice(0, 10).replace(/-/g, '');

  /** one entry point for both files: a backup (JSON) or the wardrobe list (CSV) */
  async function importAny(file) {
    if (!file) return;
    const text = await file.text();
    if (text.replace(/^\uFEFF/, '').trim().startsWith('{')) return importJson(text);
    importCsv(text);
  }
  function importCsv(text) {
    const r = E.importCSV(S, text);
    if (r.error) return toast(t('toast.importFail'));
    S.items.push(...r.items); S.counters = r.counters;
    r.items.forEach((it) => {            // own kinds travel inside the CSV, so the new phone needs no set-up
      if (it.custom && !S.customTypes.some((k) => k.cat === it.cat && k.label === it.custom)) S.customTypes.push({ id: 'c' + Math.random().toString(36).slice(2, 8), cat: it.cat, base: it.type, label: it.custom });
    });
    save(); resetResults(); render();
    toast(t('toast.imported', { n: r.items.length, s: r.skipped }));
  }
  function importJson(text) {
    let obj;
    try { obj = JSON.parse(text); } catch (e) { return toast(t('toast.badBackup')); }
    if (!obj || obj.app !== 'daily-outfit' || !obj.state || !Array.isArray(obj.state.items)) return toast(t('toast.badBackup'));
    ask(t('confirm.restore'), async () => {
      await OF.store.clear();
      S = normalize(obj.state); photos = obj.photos || {};
      for (const id in photos) await OF.store.putPhoto(id, photos[id]);
      OF.setLang(S.profile.lang); save(); resetResults(); render(); toast(t('toast.restored'));
    });
  }
  function setLang(l) {
    S.profile.lang = l; OF.setLang(l); save(); render();
  }

  /* ------------------------------------------------------------ events */
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]'); if (!el) return;
    const act = el.dataset.act;
    if (act === 'sheet-bg' && e.target !== el) return;
    if (act === 'zoom-close' && e.target !== el && !e.target.closest('button.btn')) return;
    const D = el.dataset;
    switch (act) {
      case 'logview': ui.logView = D.v; render(); break;
      case 'stats-p': ui.statsDays = +D.v; render(); break;
      case 'trip-occ': { const a = S.trip.occasions, i = a.indexOf(D.v); if (i >= 0) { if (a.length > 1) a.splice(i, 1); } else a.push(D.v); save(); render(); break; }
      case 'trip-wx': { const a = S.trip.wx, i = a.indexOf(D.v); if (i >= 0) { if (a.length > 1) a.splice(i, 1); } else a.push(D.v); save(); render(); break; }
      case 'trip-go': tripGo(false); break;
      case 'trip-redo': tripGo(true); break;
      case 'trip-check': { S.trip.checked[D.id] = el.checked; save(); const p = tripPlanItems(), pr = $('tripProg'); if (p && pr) pr.textContent = t('trip.packed', { a: p.packing.filter((x) => S.trip.checked[x.item.id]).length, b: p.packing.length }); return; }
      case 'trip-clear': S.trip.checked = {}; save(); render(); break;
      case 'trip-share': shareFile('packing-list-' + stamp() + '.txt', 'text/plain', tripText()); break;
      case 'newkind': ui.newkind = { cat: D.c, base: E.TYPES[D.c][0], name: '' }; renderDialog(); break;
      case 'nk-cat': ui.newkind.name = $('nk-name').value; ui.newkind.cat = D.c; ui.newkind.base = E.TYPES[D.c][0]; renderDialog(); break;
      case 'nk-base': ui.newkind.name = $('nk-name').value; ui.newkind.base = D.v; renderDialog(); break;
      case 'nk-cancel': ui.newkind = null; renderDialog(); break;
      case 'nk-save': {
        const n = ui.newkind, label = ($('nk-name').value || '').trim();
        if (!label) { toast(t('custom.needName')); break; }
        let k = S.customTypes.find((x) => x.cat === n.cat && x.label.toLowerCase() === label.toLowerCase());
        if (!k) { k = { id: 'c' + Math.random().toString(36).slice(2, 8), cat: n.cat, base: n.base, label }; S.customTypes.push(k); }
        ui.newkind = null; renderDialog(); save();
        if (ui.sheet) { readDraft(); const d = ui.sheet.draft; d.cat = k.cat; d.type = k.base; d.custom = k.label; if (!ui.sheet.tagsTouched) { const a = E.autoTags(d.cat, d.type, d.color); d.occasions = a.occasions; d.weather = a.weather; } renderSheet(); }
        else if (ui.batch) { ui.batch.cat = k.cat; if (ui.batch.entries.some((e) => e.sel)) bAssign(k.cat, 'c:' + k.id); renderBatch(); }
        else render();
        break;
      }
      case 'ct-del': S.customTypes = S.customTypes.filter((k) => k.id !== D.id); save(); render(); break;
      case 'onb-n': S.settings.n = +D.v; save(); render(); break;
      case 'onb-modest': S.profile.modest = D.v === '1'; save(); render(); break;
      case 'onb-done': S.onboarded = true; save(); render(); break;
      case 'onb-demo': S.onboarded = true; S.items.length ? (save(), render()) : loadDemo(); break;
      case 'event-go': {
        const v = ($('evIn') || {}).value || ''; ui.event = v;
        const g = E.occasionFromText(v);
        if (g.occasion) {
          ui.occasion = g.occasion; if (g.festival) ui.festival = g.festival;
          if (!ui.airconTouched) ui.aircon = OFFICE_OCC.includes(g.occasion);
          ui.evMsg = t('today.eventSet', { o: occLabel(g.occasion) }); resetResults(); render(); suggest();
        } else { ui.evMsg = v.trim() ? t('today.eventNone') : ''; render(); }
        break;
      }
      case 'view': S.profile.view = D.v; save(); render(); break;
      case 'fest': ui.festival = D.k; resetResults(); render(); break;
      case 'dislike': ui.fbOpen = +D.i; render(); break;
      case 'fb': {
        const l = ui.result && ui.result.looks[+D.i]; if (!l) break;
        E.applyFeedback(S, l, D.r, ui.result.occasion);
        ui.exclude = ui.exclude.concat(E.CLOTHING.map((c) => l.parts[c]).filter(Boolean).map((it) => it.id));
        save(); toast(t('fb.thanks')); suggest(); break;
      }
      case 'fb-reset': S.feedback = { item: {}, color: {} }; save(); resetResults(); toast(t('toast.fbReset')); break;
      case 'pick-many': $('fileMany').click(); break;
      case 'bcell': { const e = ui.batch.entries[+D.i]; e.sel = !e.sel; bUpdateCell(+D.i); refreshBatchBar(); break; }
      case 'bsel-all': bSelect(() => true); break;
      case 'bsel-open': bSelect((e) => !bAssigned(e)); break;
      case 'bsel-none': bSelect(() => false); break;
      case 'bcat': ui.batch.cat = D.c; renderBatch(); break;
      case 'bkind': bAssign(D.c, D.v); break;
      case 'bsave': bSave(); break;
      case 'batch-stop': closeBatch(); break;
      case 'selfie': $('fileSelfie').click(); break;
      case 'selfie-mode': ui.selfie.mode = D.v; document.querySelectorAll('[data-act="selfie-mode"]').forEach((b) => { const on = b.dataset.v === D.v; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); }); break;
      case 'selfie-done': closeSelfie(); break;
      case 'tab': ui.tab = D.tab; render(); window.scrollTo({ top: 0 }); break;
      case 'lang': setLang(OF.getLang() === 'zh' ? 'en' : 'zh'); break;
      case 'setlang': setLang(D.v); break;
      case 'occ': ui.occasion = D.o; if (!ui.airconTouched) ui.aircon = OFFICE_OCC.includes(D.o); resetResults(); render(); break;
      case 'wx': ui.wxOverride = D.k || null; resetResults(); render(); break;
      case 'locate': locate(); break;
      case 'suggest': suggest(); break;
      case 'wear': wear(+D.i); break;
      case 'undo': undo(); break;
      case 'relax': S.settings.n = +D.n; save(); toast(t('toast.relaxed', { n: D.n })); suggest(); break;
      case 'zoom': ui.zoom = +D.i; renderDialog(); break;
      case 'zoom-close': ui.zoom = null; renderDialog(); break;
      case 'go-wardrobe': ui.tab = 'wardrobe'; render(); openSheet(null); break;
      case 'demo': loadDemo(); break;
      case 'filter': ui.filter = D.c; render(); break;
      case 'add': openSheet(null); break;
      case 'edit': openSheet(D.id); break;
      case 'laundry': { const it = byId(D.id); if (it) { it.laundry = !it.laundry; save(); resetResults(); render(); } break; }
      case 'pick-csv': $('fileCsv').click(); break;
      case 'pick-json': $('fileJson').click(); break;
      case 'pick-cam': $('fileCam').click(); break;
      case 'pick-gal': $('fileGal').click(); break;
      case 'sheet-close': ui.sheet = null; renderSheet(); break;
      case 'sheet-bg': ui.sheet = null; renderSheet(); break;
      case 'sheet-save': saveSheet(); break;
      case 'sheet-delete': ask(t('confirm.delete'), () => {
        const id = ui.sheet.id; S.items = S.items.filter((i) => i.id !== id); delete photos[id]; OF.store.delPhoto(id);
        save(); ui.sheet = null; renderSheet(); resetResults(); render(); toast(t('toast.deleted'));
      }); break;
      case 'kind': {
        readDraft(); const d = ui.sheet.draft; const k = resolveKind(D.c, D.v); d.cat = D.c; d.type = k.type; d.custom = k.custom;
        if (!ui.sheet.tagsTouched) { const a = E.autoTags(d.cat, d.type, d.color); d.occasions = a.occasions; d.weather = a.weather; }
        renderSheet(); break;
      }
      case 'togglechip': if (ui.sheet) ui.sheet.tagsTouched = true; el.classList.toggle('on'); el.setAttribute('aria-pressed', el.classList.contains('on')); break;
      case 'quickcolor': $('f-color').value = D.v; ui.sheet.colorAuto = false; { const pv = document.querySelector('.photo-prev.sw'); if (pv) pv.style.background = D.v; } break;
      case 'figure': S.profile.figure = D.v; if (D.v === 'masculine') S.profile.hairLength = 'short'; save(); resetResults(); render(); break;
      case 'skin': S.profile.skin = D.v; save(); resetResults(); render(); break;
      case 'haircolor': S.profile.hairColor = D.v; save(); resetResults(); render(); break;
      case 'hairlen': S.profile.hairLength = D.v; save(); resetResults(); render(); break;
      case 'export-json': shareFile('daily-outfit-backup-' + stamp() + '.json', 'application/json', JSON.stringify({ app: 'daily-outfit', version: 1, state: S, photos })); break;
      case 'export-csv': shareFile('wardrobe-' + stamp() + '.csv', 'text/csv', E.wardrobeCSV(S)); break;
      case 'reset': ask(t('confirm.reset'), async () => { await OF.store.clear(); S = normalize(null); S.profile.lang = OF.getLang(); photos = {}; save(); resetResults(); ui.tab = 'today'; render(); }); break;
      case 'install': if (installEvt) { installEvt.prompt(); installEvt = null; render(); } break;
      case 'dlg-no': ui.dialog = null; renderDialog(); break;
      case 'dlg-yes': { const f = ui.dialog && ui.dialog.onYes; ui.dialog = null; renderDialog(); if (f) f(); break; }
      default: break;
    }
  });
  document.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.item[data-act]')) { e.preventDefault(); e.target.click(); }
    if (e.key === 'Escape') { if (ui.dialog) { ui.dialog = null; ui.zoom = null; renderDialog(); } else if (ui.zoom != null) { ui.zoom = null; renderDialog(); } else if (ui.sheet) { ui.sheet = null; renderSheet(); } }
  });
  document.addEventListener('change', (e) => {
    const el = e.target;
    if (el.id === 'fileCam' || el.id === 'fileGal') { onPhoto(el.files[0]); el.value = ''; return; }
    if (el.id === 'fileMany') { startBatch(el.files); el.value = ''; return; }
    if (el.id === 'fileSelfie') { openSelfie(el.files[0]); el.value = ''; return; }
    if (el.id === 'fileCsv') { importAny(el.files[0]); el.value = ''; return; }
    if (el.id === 'fileJson') { importAny(el.files[0]); el.value = ''; return; }
    const b = el.closest('[data-bind]'); if (!b) return;
    const k = b.dataset.bind;
    if (k === 'sheet-cat') { readDraft(); ui.sheet.draft.type = E.TYPES[ui.sheet.draft.cat][0]; renderSheet(); return; }
    if (k === 'aircon') { ui.aircon = b.checked; ui.airconTouched = true; resetResults(); render(); return; }
    if (k === 'currency') { S.profile.currency = (b.value || '').trim().slice(0, 4) || 'RM'; save(); return; }
    if (k === 'modest') { S.profile.modest = b.checked; save(); resetResults(); render(); return; }
    if (k === 'removeBg') { S.profile.removeBg = b.checked; save(); render(); return; }
    if (k === 'makeup') { S.profile.makeup = b.checked; save(); resetResults(); render(); return; }
    if (k === 'n') { S.settings.n = Math.max(0, Math.min(60, parseInt(b.value, 10) || 0)); save(); resetResults(); render(); return; }
    if (k === 'min') { S.settings.minItems = Math.max(1, Math.min(20, parseInt(b.value, 10) || 3)); save(); render(); return; }
    if (k.startsWith('rule:')) { S.settings.rule[k.slice(5)] = b.checked; save(); resetResults(); render(); }
  });
  document.addEventListener('input', (e) => { if (e.target.id === 'evIn') ui.event = e.target.value; });
  document.addEventListener('input', (e) => { if (e.target.id === 'tripDays') { const v = parseInt(e.target.value, 10); if (v >= 1) S.trip.days = Math.min(21, v); } });
  document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.id === 'evIn') { e.preventDefault(); document.querySelector('[data-act="event-go"]').click(); } });
  document.addEventListener('click', (e) => { if (e.target.id === 'selfieCv' && ui.selfie) selfieTap(e); });
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; if (ui.tab === 'settings') render(); });

  /* ------------------------------------------------------------ render + boot */
  function render() {
    document.documentElement.lang = OF.getLang() === 'zh' ? 'zh-CN' : 'en';
    document.title = t('app.title');
    const views = { today: viewToday, wardrobe: viewWardrobe, trip: viewTrip, history: viewHistory, gaps: viewGaps, settings: viewSettings };
    $('app').innerHTML = header() + '<main>' + views[ui.tab]() + '</main>' + tabbar();
  }

  async function boot() {
    let loaded = { state: null, photos: {} };
    try { loaded = await OF.store.load(); } catch (e) { /* start fresh */ }
    S = normalize(loaded.state); photos = loaded.photos || {};
    OF.setLang(S.profile.lang);
    ui.aircon = OFFICE_OCC.includes(ui.occasion);
    render();
    try { if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => {}); } catch (e) { /* offline cache is optional */ }
    window.__app = { get state() { return S; }, ui, flatlay, get photos() { return photos; } };   // handy for tests/debugging
  }
  boot();
})();

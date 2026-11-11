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
  const ui = {
    tab: 'today', occasion: 'Business', wxOverride: null, aircon: true, airconTouched: false,
    weather: null, wxStatus: 'idle', result: null, worn: null, filter: 'All', sheet: null, dialog: null, zoom: null,
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
    return out;
  }
  function currentCond() { return E.conditions(ui.weather, ui.wxOverride, ui.aircon); }
  function resetResults() { ui.result = null; ui.worn = null; }

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
    const tabs = [['today', 'tab.today'], ['wardrobe', 'tab.wardrobe'], ['history', 'tab.history'], ['gaps', 'tab.gaps'], ['settings', 'tab.settings']];
    return `<nav class="tabs" role="tablist">${tabs.map(([k, l]) =>
      `<button role="tab" class="tab${ui.tab === k ? ' on' : ''}" data-act="tab" data-tab="${k}" aria-selected="${ui.tab === k}">${esc(t(l))}</button>`).join('')}</nav>`;
  }

  function viewToday() {
    if (!S.items.length) {
      return `<section class="card center"><h2>${esc(t('today.empty.title'))}</h2><p class="muted">${esc(t('today.empty.body'))}</p>
        <div class="stack"><button class="btn primary block" data-act="go-wardrobe">${esc(t('wardrobe.add'))}</button>
        <button class="btn block" data-act="demo">${esc(t('wardrobe.demo'))}</button></div></section>`;
    }
    const cond = currentCond();
    let h = `<section class="card"><h2>${esc(t('today.occasion'))}</h2><div class="chips">${E.OCCASIONS.map((o) => chip(occLabel(o), ui.occasion === o, 'occ', { o })).join('')}</div></section>`;
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
    r.looks.forEach((l, i) => { h += lookCard(l, i); });
    return h + `<p class="muted small center">${esc(t('today.zoom'))}</p>`;
  }

  function lookCard(l, i) {
    const male = S.profile.figure === 'masculine' || !S.profile.makeup;
    const svg = I.render(S.profile, l.parts, l.groom, { label: t('today.look', { n: i + 1 }) });
    const rows = E.CATEGORIES.filter((c) => l.parts[c]).map((c) =>
      `<li><span class="dot" style="background:${esc(l.parts[c].color)}"></span><span class="k">${esc(t('cat.' + c))}</span><span class="v">${esc(nm(l.parts[c]))}</span></li>`).join('');
    const stretch = l.stretch.length ? `<p class="note small">${esc(t('today.stretch', { names: l.stretch.map((id) => { const it = byId(id); return it ? nm(it) : id; }).join(', ') }))}</p>` : '';
    return `<article class="card look"><button class="fig" data-act="zoom" data-i="${i}" aria-label="${esc(t('today.look', { n: i + 1 }))}">${svg}</button>
      <div class="info"><h3>${esc(t('today.look', { n: i + 1 }))}</h3><ul class="pieces">${rows}</ul>
      <p class="groom"><b>${esc(t('today.hair'))}</b> ${esc(t(l.groom.hairKey))}<br><b>${esc(male ? t('today.groom') : t('today.makeup'))}</b> ${esc(l.groom.makeupKeys.map((k) => t(k)).join(' '))}</p>
      ${stretch}<button class="btn primary block" data-act="wear" data-i="${i}">${esc(t('today.wear'))}</button></div></article>`;
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
      <div class="grow"><b>${esc(nm(it))}</b><div class="muted small">${esc(t('cat.' + it.cat))} · ${esc(t('type.' + it.type))} · ${esc(it.id)}</div>${badge(it)}</div>
      <button class="btn small ghost" data-act="laundry" data-id="${esc(it.id)}" aria-pressed="${!!it.laundry}">${esc(t('wardrobe.laundry'))}${it.laundry ? ' ✓' : ''}</button></div>`).join('');
    return `<section class="card"><div class="row wrap"><button class="btn primary" data-act="add">${esc(t('wardrobe.add'))}</button>
      <button class="btn" data-act="pick-csv">${esc(t('wardrobe.importCsv'))}</button><button class="btn" data-act="demo">${esc(t('wardrobe.demo'))}</button></div>
      <input type="file" id="fileCsv" accept=".csv,text/csv,text/plain" hidden>
      <p class="muted small">${esc(t('wardrobe.count', { n: S.items.length }))} · ${esc(t('wardrobe.limit'))}</p>
      <div class="chips">${chips}</div></section>
      ${rows ? `<section class="list">${rows}</section>` : `<p class="muted center">${esc(t('wardrobe.empty'))}</p>`}`;
  }

  function viewHistory() {
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

  function viewGaps() {
    const m = E.gapMatrix(S), min = S.settings.minItems;
    const head = `<tr><th></th>${E.OCCASIONS.map((o) => `<th><span>${esc(occShort(o))}</span></th>`).join('')}</tr>`;
    const body = E.CATEGORIES.map((c) => `<tr><th class="rowh">${esc(t('catp.' + c))}</th>${E.OCCASIONS.map((o) => (E.relevant(c, o) ? `<td class="${m[c][o] < min ? 'low' : 'okc'}">${m[c][o]}</td>` : `<td class="na">–</td>`)).join('')}</tr>`).join('');
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
        <label class="check"><input type="checkbox" data-bind="makeup" ${p.makeup ? 'checked' : ''}> <span>${esc(t('settings.makeup'))}</span></label></section>
      <section class="card"><h2>${esc(t('settings.rules'))}</h2>
        <label class="lbl" for="nIn">${esc(t('settings.n'))}</label><input id="nIn" type="number" inputmode="numeric" min="0" max="60" value="${S.settings.n}" data-bind="n">
        <label class="lbl">${esc(t('settings.apply'))}</label><div class="checks">${rules}</div>
        <label class="lbl" for="minIn">${esc(t('settings.min'))}</label><input id="minIn" type="number" inputmode="numeric" min="1" max="20" value="${S.settings.minItems}" data-bind="min"></section>
      <section class="card"><h2>${esc(t('settings.data'))}</h2><div class="stack">
        <button class="btn block" data-act="export-json">${esc(t('settings.exportJson'))}</button>
        <button class="btn block" data-act="export-csv">${esc(t('settings.exportCsv'))}</button>
        <button class="btn block" data-act="pick-json">${esc(t('settings.importJson'))}</button><input type="file" id="fileJson" accept=".json,application/json" hidden>
        <button class="btn block danger" data-act="reset">${esc(t('settings.reset'))}</button></div>
        <p class="muted small">${esc(t('settings.privacy'))}</p>${OF.store.isMemory() ? '<p class="note small">Storage is unavailable in this browser mode: data will be lost when you close the page.</p>' : ''}</section>
      <section class="card">${install}<p class="muted small">${esc(t('settings.about'))}</p></section>`;
  }

  /* ------------------------------------------------------------ item sheet */
  function openSheet(id) {
    const it = id ? byId(id) : null;
    ui.sheet = {
      id: it ? it.id : null, photo: it ? photos[it.id] || null : null, photoChanged: false, colorAuto: false,
      draft: it ? { cat: it.cat, type: it.type, name: it.name, nameZh: it.nameZh || '', color: it.color, occasions: (it.occasions || []).slice(), weather: (it.weather || []).slice(), laundry: !!it.laundry }
        : { cat: ui.filter !== 'All' ? ui.filter : 'Top', type: null, name: '', nameZh: '', color: '#1E1E20', occasions: [], weather: [], laundry: false },
    };
    if (!ui.sheet.draft.type) ui.sheet.draft.type = E.TYPES[ui.sheet.draft.cat][0];
    renderSheet();
  }
  function readDraft() {
    const sh = ui.sheet; if (!sh || !$('f-name')) return;
    const d = sh.draft;
    d.cat = $('f-cat').value; d.type = $('f-type').value; d.name = $('f-name').value; d.nameZh = $('f-zh').value; d.color = $('f-color').value;
    d.occasions = [...document.querySelectorAll('#f-occ .chip.on')].map((e) => e.dataset.v);
    d.weather = [...document.querySelectorAll('#f-wx .chip.on')].map((e) => e.dataset.v);
    d.laundry = $('f-laundry').checked;
  }
  function renderSheet() {
    const root = $('sheet-root');
    if (!ui.sheet) { root.innerHTML = ''; return; }
    const sh = ui.sheet, d = sh.draft;
    const types = E.TYPES[d.cat];
    const prev = sh.photo ? `<img class="photo-prev" src="${sh.photo}" alt="">` : `<div class="photo-prev sw" style="background:${esc(d.color)}"></div>`;
    root.innerHTML = `<div class="overlay" data-act="sheet-bg"><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(t(sh.id ? 'sheet.edit' : 'sheet.add'))}">
      <div class="row between"><h2>${esc(t(sh.id ? 'sheet.edit' : 'sheet.add'))}</h2><button class="btn small ghost" data-act="sheet-close" aria-label="${esc(t('common.close'))}">✕</button></div>
      <div class="row"><div>${prev}</div><div class="stack grow"><button class="btn small" data-act="pick-cam">${esc(t('sheet.camera'))}</button><button class="btn small" data-act="pick-gal">${esc(t('sheet.gallery'))}</button></div></div>
      <input type="file" id="fileCam" accept="image/*" capture="environment" hidden><input type="file" id="fileGal" accept="image/*" hidden>
      ${sh.colorAuto ? `<p class="muted small">${esc(t('sheet.colorAuto'))}</p>` : ''}
      <label class="lbl" for="f-cat">${esc(t('sheet.category'))}</label>
      <select id="f-cat" data-bind="sheet-cat">${E.CATEGORIES.map((c) => `<option value="${c}"${c === d.cat ? ' selected' : ''}>${esc(t('cat.' + c))}</option>`).join('')}</select>
      <label class="lbl" for="f-type">${esc(t('sheet.type'))}</label>
      <select id="f-type">${types.map((x) => `<option value="${x}"${x === d.type ? ' selected' : ''}>${esc(t('type.' + x))}</option>`).join('')}</select>
      <label class="lbl" for="f-name">${esc(t('sheet.name'))}</label><input id="f-name" type="text" value="${esc(d.name)}" maxlength="60" autocomplete="off">
      <label class="lbl" for="f-zh">${esc(t('sheet.nameZh'))}</label><input id="f-zh" type="text" value="${esc(d.nameZh)}" maxlength="40" autocomplete="off">
      <label class="lbl" for="f-color">${esc(t('sheet.color'))}</label>
      <div class="row wrap"><input id="f-color" type="color" value="${esc(d.color)}">${QUICK.map((c) => `<button type="button" class="swb sm" style="background:${c}" data-act="quickcolor" data-v="${c}" aria-label="${c}"></button>`).join('')}</div>
      <label class="lbl">${esc(t('sheet.occasions'))}</label><div class="chips" id="f-occ">${E.OCCASIONS.map((o) => chip(occLabel(o), d.occasions.includes(o), 'togglechip', { v: o })).join('')}</div>
      <label class="lbl">${esc(t('sheet.weather'))}</label><div class="chips" id="f-wx">${E.WX.map((w) => chip(t('wx.' + w), d.weather.includes(w), 'togglechip', { v: w })).join('')}</div>
      <label class="check"><input type="checkbox" id="f-laundry" ${d.laundry ? 'checked' : ''}> <span>${esc(t('sheet.laundry'))}</span></label>
      <div class="row end"><button class="btn" data-act="sheet-close">${esc(t('common.cancel'))}</button>${sh.id ? `<button class="btn danger" data-act="sheet-delete">${esc(t('common.delete'))}</button>` : ''}<button class="btn primary" data-act="sheet-save">${esc(t('common.save'))}</button></div>
    </div></div>`;
  }
  function saveSheet() {
    readDraft();
    const sh = ui.sheet, d = sh.draft;
    if (!d.name.trim() && !d.nameZh.trim()) { toast(t('sheet.needName')); $('f-name').focus(); return; }
    let it;
    if (sh.id) it = byId(sh.id);
    else { it = { id: E.nextId(S, d.cat), addedAt: Date.now() }; S.items.push(it); }
    if (sh.id && it.cat !== d.cat) { /* category changed: keep id stable */ }
    Object.assign(it, { cat: d.cat, type: d.type, name: d.name.trim() || d.nameZh.trim(), nameZh: d.nameZh.trim(), color: d.color, occasions: d.occasions, weather: d.weather, laundry: d.laundry });
    if (sh.photoChanged && sh.photo) { photos[it.id] = sh.photo; OF.store.putPhoto(it.id, sh.photo); }
    save(); ui.sheet = null; resetResults(); renderSheet(); render(); toast(t('toast.saved'));
  }

  /* ------------------------------------------------------------ photo + colour */
  function readPhoto(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => {
        try {
          const r = Math.min(1, 480 / Math.max(img.naturalWidth, img.naturalHeight));
          const c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(img.naturalWidth * r)); c.height = Math.max(1, Math.round(img.naturalHeight * r));
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          URL.revokeObjectURL(url);
          resolve({ dataUrl: c.toDataURL('image/jpeg', 0.78), color: dominant(c) });
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
      const { dataUrl, color } = await readPhoto(file);
      ui.sheet.photo = dataUrl; ui.sheet.photoChanged = true; ui.sheet.draft.color = color; ui.sheet.colorAuto = true;
      renderSheet();
    } catch (e) { toast('Could not read that photo'); }
  }

  /* ------------------------------------------------------------ dialogs + zoom */
  function renderDialog() {
    const root = $('dialog-root');
    if (ui.zoom != null && ui.result && ui.result.looks[ui.zoom]) {
      const l = ui.result.looks[ui.zoom];
      root.innerHTML = `<div class="overlay" data-act="zoom-close"><div class="zoom">${I.render(S.profile, l.parts, l.groom)}<button class="btn" data-act="zoom-close">${esc(t('common.close'))}</button></div></div>`;
    } else if (ui.dialog) {
      root.innerHTML = `<div class="overlay"><div class="sheet small-sheet" role="alertdialog"><p>${esc(ui.dialog.msg)}</p><div class="row end"><button class="btn" data-act="dlg-no">${esc(t('common.no'))}</button><button class="btn danger" data-act="dlg-yes">${esc(t('common.yes'))}</button></div></div></div>`;
    } else root.innerHTML = '';
  }
  function ask(msg, onYes) { ui.dialog = { msg, onYes }; renderDialog(); }

  /* ------------------------------------------------------------ actions */
  function suggest() {
    ui.worn = null;
    ui.result = E.generate(S, ui.occasion, currentCond());
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
  async function importCsv(file) {
    if (!file) return;
    const r = E.importCSV(S, await file.text());
    if (r.error) return toast(t('toast.importFail'));
    S.items.push(...r.items); S.counters = r.counters; save(); resetResults(); render();
    toast(t('toast.imported', { n: r.items.length, s: r.skipped }));
  }
  async function importJson(file) {
    if (!file) return;
    let obj;
    try { obj = JSON.parse(await file.text()); } catch (e) { return toast(t('toast.badBackup')); }
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
      case 'togglechip': el.classList.toggle('on'); el.setAttribute('aria-pressed', el.classList.contains('on')); break;
      case 'quickcolor': $('f-color').value = D.v; ui.sheet.colorAuto = false; { const pv = document.querySelector('.photo-prev.sw'); if (pv) pv.style.background = D.v; } break;
      case 'figure': S.profile.figure = D.v; if (D.v === 'masculine') S.profile.hairLength = 'short'; save(); resetResults(); render(); break;
      case 'skin': S.profile.skin = D.v; save(); resetResults(); render(); break;
      case 'haircolor': S.profile.hairColor = D.v; save(); resetResults(); render(); break;
      case 'hairlen': S.profile.hairLength = D.v; save(); resetResults(); render(); break;
      case 'export-json': download('daily-outfit-backup.json', 'application/json', JSON.stringify({ app: 'daily-outfit', version: 1, state: S, photos })); break;
      case 'export-csv': download('wardrobe.csv', 'text/csv', E.wardrobeCSV(S)); break;
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
    if (el.id === 'fileCsv') { importCsv(el.files[0]); el.value = ''; return; }
    if (el.id === 'fileJson') { importJson(el.files[0]); el.value = ''; return; }
    const b = el.closest('[data-bind]'); if (!b) return;
    const k = b.dataset.bind;
    if (k === 'sheet-cat') { readDraft(); ui.sheet.draft.type = E.TYPES[ui.sheet.draft.cat][0]; renderSheet(); return; }
    if (k === 'aircon') { ui.aircon = b.checked; ui.airconTouched = true; resetResults(); render(); return; }
    if (k === 'makeup') { S.profile.makeup = b.checked; save(); resetResults(); render(); return; }
    if (k === 'n') { S.settings.n = Math.max(0, Math.min(60, parseInt(b.value, 10) || 0)); save(); resetResults(); render(); return; }
    if (k === 'min') { S.settings.minItems = Math.max(1, Math.min(20, parseInt(b.value, 10) || 3)); save(); render(); return; }
    if (k.startsWith('rule:')) { S.settings.rule[k.slice(5)] = b.checked; save(); resetResults(); render(); }
  });
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; if (ui.tab === 'settings') render(); });

  /* ------------------------------------------------------------ render + boot */
  function render() {
    document.documentElement.lang = OF.getLang() === 'zh' ? 'zh-CN' : 'en';
    document.title = t('app.title');
    const views = { today: viewToday, wardrobe: viewWardrobe, history: viewHistory, gaps: viewGaps, settings: viewSettings };
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
    window.__app = { get state() { return S; }, ui };   // handy for tests/debugging
  }
  boot();
})();

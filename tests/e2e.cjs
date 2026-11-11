// End-to-end check in a phone-sized Chromium. Weather API and GPS are mocked (the sandbox has no internet).
const { chromium, devices } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.join(__dirname, '..', 'www');
const OUT = process.env.OUT || '/tmp/e2e';
const CSV = process.env.CSV;
const PHOTO = process.env.PHOTO;
fs.mkdirSync(OUT, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml' };

const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end('nf'); }
  res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});

let step = 0;
const ok = (m) => console.log('ok  -', m);

(async () => {
  await new Promise((r) => server.listen(0, r));
  const url = 'http://localhost:' + server.address().port + '/';
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['Pixel 7'], geolocation: { latitude: 3.139, longitude: 101.687 }, permissions: ['geolocation'], locale: 'en-MY', serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  let wxCalls = [];
  await page.route('https://api.open-meteo.com/**', (route) => {
    wxCalls.push(route.request().url());
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ current: { temperature_2m: 32.4, apparent_temperature: 38.1, relative_humidity_2m: 78, precipitation: 0 }, daily: { precipitation_probability_max: [35] } }) });
  });
  const shot = (n) => page.screenshot({ path: path.join(OUT, String(++step).padStart(2, '0') + '-' + n + '.png') });
  const st = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__app.state)));

  await page.goto(url);
  await page.waitForSelector('.card');
  assert.ok(await page.locator('text=3 quick questions').count(), 'onboarding');
  await shot('onboarding');
  await page.click('button[data-act="figure"][data-v="neutral"]');
  await page.click('button[data-act="onb-n"][data-v="5"]');
  await page.click('button[data-act="onb-modest"][data-v="1"]');
  let s0 = await st();
  assert.equal(s0.profile.figure, 'neutral'); assert.equal(s0.settings.n, 5); assert.equal(s0.profile.modest, true);
  await page.click('button[data-act="figure"][data-v="feminine"]');
  await page.click('button[data-act="onb-n"][data-v="10"]');
  await page.click('button[data-act="onb-modest"][data-v="0"]');
  await page.click('button[data-act="onb-done"]');
  assert.ok(await page.locator('text=Your wardrobe is empty').count(), 'empty state');
  ok('first run: 3-question onboarding, then the empty-wardrobe card');
  await shot('empty');

  // demo wardrobe
  await page.click('button[data-act="demo"]');
  await page.waitForSelector('button[data-act="suggest"]');
  assert.equal((await st()).items.length, 43);
  ok('demo wardrobe loaded (43 items)');

  // weather by location (mocked)
  await page.click('button[data-act="locate"]');
  await page.waitForSelector('text=32°C');
  assert.ok(wxCalls.length === 1 && /latitude=3\.14&longitude=101\.69/.test(wxCalls[0]), 'coordinates rounded: ' + wxCalls[0]);
  ok('weather loaded; coordinates rounded to 2 decimals before sending: ' + wxCalls[0].match(/latitude=[^&]+&longitude=[^&]+/)[0]);

  // suggest
  await page.click('button[data-act="suggest"]');
  await page.waitForSelector('.look');
  assert.equal(await page.locator('.look').count(), 3);
  assert.equal(await page.locator('.look svg').count(), 3);
  ok('3 looks with illustrations');
  await shot('looks-business');
  const firstLookItems = await page.locator('.look').first().locator('.pieces .v').allTextContents();

  // wear first look -> its clothes rest
  await page.click('button[data-act="wear"][data-i="0"]');
  await page.waitForSelector('.card.ok');
  let s = await st();
  assert.equal(s.log.length, 1);
  assert.equal(s.log[0].occasion, 'Business');
  ok('wearing look 1 logs outfit #1: ' + firstLookItems.join(' | '));
  await shot('worn');
  await page.click('button[data-act="tab"][data-tab="wardrobe"]');
  const resting = await page.locator('.badge.st-resting').count();
  assert.ok(resting >= 2, 'resting badges: ' + resting);
  ok('wardrobe shows ' + resting + ' items as Resting');
  await shot('wardrobe-resting');
  await page.click('button[data-act="tab"][data-tab="today"]');
  await page.click('button[data-act="suggest"]');
  await page.waitForSelector('.look');
  const wornIds = Object.entries(s.log[0].items).filter(([c]) => ['Top', 'Bottom', 'Dress', 'Outerwear'].includes(c)).map(([, id]) => id);
  const again = await page.evaluate(() => window.__app.ui.result.looks.map((l) => Object.values(l.parts).filter(Boolean).map((i) => i.id)));
  again.flat().forEach((id) => assert.ok(!wornIds.includes(id) || false, 'worn item came back: ' + id));
  ok('next suggestions exclude the worn clothing pieces');

  // Chinese
  await page.click('button[data-act="lang"]');
  await page.waitForSelector('text=就穿这套');
  ok('Chinese UI');
  await shot('zh-looks');
  await page.click('button[data-act="lang"]');

  // zoom
  await page.click('.look .fig >> nth=0');
  await page.waitForSelector('.zoom svg');
  await shot('zoom');
  await page.click('.zoom button.btn');

  // photo upload: colour auto-detected
  await page.click('button[data-act="tab"][data-tab="wardrobe"]');
  await page.click('button[data-act="add"]');
  await page.waitForSelector('.sheet');
  await page.setInputFiles('#fileGal', PHOTO);
  await page.waitForSelector('text=Colour picked from your photo');
  const col = await page.inputValue('#f-color');
  assert.ok(/^#c[0-2]/i.test(col), 'detected colour ' + col);
  await page.click('button[data-act="sheet-save"]');
  await page.waitForSelector('text=Tap what kind of item it is');
  assert.ok(await page.locator('.sheet').count(), 'sheet stays open until a kind is chosen');
  await page.click('button[data-act="kind"][data-v="midi"]');
  await shot('add-sheet');
  await page.click('button[data-act="sheet-save"]');
  await page.waitForSelector('text=Red midi dress');
  s = await st();
  const added = s.items.find((i) => i.name === 'Red midi dress');
  assert.ok(added && added.cat === 'Dress' && /^D\d{3}$/.test(added.id), 'auto-named');
  assert.equal(added.nameZh, '红色中长裙');
  assert.ok(added.occasions.includes('Date') && added.occasions.includes('Festive') && !added.occasions.includes('Formal'), 'auto occasions for a bright dress: ' + added.occasions);
  assert.equal(await page.locator('img.thumb').count(), 1);
  ok('added item with 3 taps (photo, kind, save): ' + added.name + ', colour ' + col + ', occasions chosen automatically: ' + added.occasions.join('/'));

  // CSV import (Excel template sheet saved as CSV)
  await page.setInputFiles('#fileCsv', CSV);
  await page.waitForSelector('text=Imported 12 items');
  s = await st();
  assert.equal(s.items.length, 43 + 1 + 12);
  assert.ok(s.items.some((i) => i.nameZh === '白色亚麻衬衫'));
  ok('imported the Excel template sheet: +12 items');

  // laundry + edit + delete
  await page.click(`.item[data-id="${added.id}"] button[data-act="laundry"]`);
  assert.equal((await st()).items.find((i) => i.id === added.id).laundry, true);
  await page.click(`.item[data-id="${added.id}"]`);
  await page.waitForSelector('.sheet');
  await page.click('button[data-act="sheet-delete"]');
  await page.click('button[data-act="dlg-yes"]');
  await page.waitForFunction((id) => !window.__app.state.items.some((i) => i.id === id), added.id);
  ok('laundry toggle, edit sheet and delete with confirmation');

  // settings: figure + rule
  await page.click('button[data-act="tab"][data-tab="settings"]');
  await page.click('button[data-act="figure"][data-v="masculine"]');
  await page.fill('#nIn', '4'); await page.press('#nIn', 'Tab');
  await page.waitForTimeout(100);
  s = await st();
  assert.equal(s.settings.n, 4); assert.equal(s.profile.figure, 'masculine'); assert.equal(s.profile.hairLength, 'short');
  await shot('settings');
  await page.click('button[data-act="figure"][data-v="feminine"]');
  await page.fill('#nIn', '10'); await page.press('#nIn', 'Tab');
  ok('settings: figure and N are saved');

  // gaps + history
  await page.click('button[data-act="tab"][data-tab="gaps"]');
  await page.waitForSelector('table.gap');
  await shot('gaps');
  await page.click('button[data-act="tab"][data-tab="history"]');
  await page.waitForSelector('text=#1');
  await shot('history');

  // persistence across reload
  await page.waitForTimeout(400);
  const before = (await st()).items.length;
  await page.reload();
  await page.waitForSelector('button[data-act="suggest"]');
  assert.equal((await st()).items.length, before);
  assert.equal((await st()).log.length, 1);
  ok('data survives a reload (IndexedDB)');

  // note-to-occasion + Raya palette
  await page.click('button[data-act="tab"][data-tab="today"]');
  await page.fill('#evIn', 'Raya open house at Aunty');
  await page.click('button[data-act="event-go"]');
  await page.waitForSelector('.look');
  let u = await page.evaluate(() => ({ o: window.__app.ui.occasion, f: window.__app.ui.festival }));
  assert.equal(u.o, 'Festive'); assert.equal(u.f, 'raya');
  ok('typed "Raya open house" -> Festive + Hari Raya palette, looks shown');
  await shot('festive-raya');

  // "Not for me" feedback
  const beforeIds = await page.evaluate(() => window.__app.ui.result.looks.map((l) => Object.values(l.parts).filter(Boolean).map((i) => i.id).join(',')));
  await page.click('button[data-act="dislike"][data-i="0"]');
  await page.waitForSelector('button[data-act="fb"][data-r="color"]');
  await shot('feedback-ask');
  await page.click('button[data-act="fb"][data-r="color"]');
  await page.waitForSelector('.look');
  s = await st();
  assert.ok(Object.keys(s.feedback.color).length > 0, 'colour dislike stored');
  const afterIds = await page.evaluate(() => window.__app.ui.result.looks.map((l) => Object.values(l.parts).filter(Boolean).map((i) => i.id).join(',')));
  assert.notEqual(afterIds[0], beforeIds[0]);
  ok('"Not for me" -> reason -> new looks, taste remembered: ' + JSON.stringify(s.feedback.color));

  // batch add with background removal
  const plain = path.join(OUT, 'plain-bg.png');
  const durl = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 300; c.height = 400; const x = c.getContext('2d'); x.fillStyle = '#DDE3D0'; x.fillRect(0, 0, 300, 400); x.fillStyle = '#1F2E4D'; x.fillRect(100, 100, 100, 200); return c.toDataURL('image/png'); });
  fs.writeFileSync(plain, Buffer.from(durl.split(',')[1], 'base64'));
  await page.click('button[data-act="tab"][data-tab="wardrobe"]');
  const nBefore = (await st()).items.length;
  const t001 = path.join(OUT, 'T001.jpg'); fs.copyFileSync(PHOTO, t001);
  const hadPhoto = await page.locator('.item[data-id="T001"] img.thumb').count();
  await page.setInputFiles('#fileMany', [plain, PHOTO, t001]);
  await page.waitForFunction(() => document.querySelectorAll('.bcell').length === 3);
  await shot('batch');
  assert.equal(await page.locator('#bc-2 .bl').innerText(), '→ T001');
  await page.click('#bc-0'); await page.click('button[data-act="bcat"][data-c="Bottom"]'); await page.click('button[data-act="bkind"][data-v="trousers"]');
  await page.click('#bc-1'); await page.click('button[data-act="bcat"][data-c="Shoes"]'); await page.click('button[data-act="bkind"][data-v="sneakers"]');
  await shot('batch-assigned');
  assert.ok(/Save 3 items/.test(await page.locator('#bsave').innerText()));
  await page.click('#bsave');
  await page.waitForSelector('text=Added 2 items, 1 photos attached');
  await page.waitForFunction((n) => window.__app.state.items.length === n + 2, nBefore);
  s = await st();
  const b1 = s.items[s.items.length - 2], b2 = s.items[s.items.length - 1];
  assert.equal(b1.cat, 'Bottom'); assert.equal(b2.cat, 'Shoes');
  const isPng = await page.evaluate((id) => { const im = document.querySelector('.item[data-id="' + id + '"] img.thumb'); return im && im.src.startsWith('data:image/png'); }, b1.id);
  assert.ok(isPng, 'plain background removed -> PNG with transparency');
  await page.click('button[data-act="filter"][data-c="Top"]');
  assert.ok(await page.locator('.item[data-id="T001"] img.thumb').count() === 1, 'T001.jpg attached to T001');
  assert.ok(b1.color.toLowerCase().startsWith('#1') || b1.color.toLowerCase().startsWith('#2'), 'navy detected from the cut-out: ' + b1.color);
  ok('batch add: 3 photos selected in bulk; 2 new items, T001.jpg attached to existing T001 (was ' + hadPhoto + ' photo before); background removed (colour ' + b1.color + ')');

  // finer kinds + the user's own kind
  await page.click('button[data-act="tab"][data-tab="wardrobe"]');
  await page.click('button[data-act="filter"][data-c="All"]');
  await page.click('button[data-act="add"]'); await page.waitForSelector('.sheet');
  await page.setInputFiles('#fileGal', PHOTO); await page.waitForSelector('text=Colour picked from your photo');
  assert.ok(await page.locator('button[data-act="kind"][data-v="overalls"]').count() === 1, 'overalls kind exists');
  assert.ok(await page.locator('button[data-act="kind"][data-v="jumpsuit"]').count() === 1 && await page.locator('button[data-act="kind"][data-v="qipao"]').count() === 1);
  await page.click('button[data-act="kind"][data-v="overalls"]');
  await page.click('button[data-act="sheet-save"]');
  await page.waitForSelector('text=overalls');
  s = await st();
  const ov = s.items[s.items.length - 1];
  assert.equal(ov.type, 'overalls'); assert.equal(ov.cat, 'Bottom'); assert.ok(/^B\d{3}$/.test(ov.id));
  await page.click('button[data-act="add"]'); await page.waitForSelector('.sheet');
  await page.setInputFiles('#fileGal', PHOTO); await page.waitForSelector('text=Colour picked from your photo');
  await page.click('button[data-act="newkind"][data-c="Dress"]');
  await page.fill('#nk-name', 'Sarong');
  await page.click('button[data-act="nk-base"][data-v="maxi"]');
  await page.click('button[data-act="nk-save"]');
  await page.waitForSelector('.sheet button.chip.on:has-text("Sarong")');
  await page.click('button[data-act="sheet-save"]');
  await page.waitForSelector('.item:has-text("Red sarong")');
  s = await st();
  const sar = s.items[s.items.length - 1];
  assert.equal(sar.custom, 'Sarong'); assert.equal(sar.type, 'maxi'); assert.equal(sar.cat, 'Dress'); assert.equal(s.customTypes.length, 1);
  ok('finer kinds (overalls, jumpsuit, qipao...) and a user-made kind "Sarong" (drawn like a maxi dress): ' + ov.name + ' / ' + sar.name);
  await shot('custom-kind');

  // export the list and the full backup, restore both on a "second phone" (fresh browser context)
  await page.click('button[data-act="tab"][data-tab="settings"]');
  const [dlCsv] = await Promise.all([page.waitForEvent('download'), page.click('button[data-act="export-csv"]')]);
  const csvPath = path.join(OUT, 'export.csv'); await dlCsv.saveAs(csvPath);
  const [dlJson] = await Promise.all([page.waitForEvent('download'), page.click('button[data-act="export-json"]')]);
  const jsonPath = path.join(OUT, 'export.json'); await dlJson.saveAs(jsonPath);
  const origItems = (await st()).items;
  const ctx2 = await browser.newContext({ ...devices['Pixel 7'], serviceWorkers: 'block' });
  const p2 = await ctx2.newPage();
  await p2.goto(url); await p2.waitForSelector('button[data-act="onb-done"]'); await p2.click('button[data-act="onb-done"]');
  await p2.click('button[data-act="tab"][data-tab="wardrobe"]');
  await p2.setInputFiles('#fileCsv', csvPath);
  await p2.waitForSelector('text=Imported ' + origItems.length + ' items');
  const got = await p2.evaluate(() => JSON.parse(JSON.stringify(window.__app.state)));
  assert.equal(got.items.length, origItems.length);
  origItems.forEach((o) => {
    const g = got.items.find((x) => x.id === o.id); assert.ok(g, 'missing ' + o.id);
    assert.equal(g.type, o.type); assert.equal(g.cat, o.cat); assert.equal(g.color.toLowerCase(), o.color.toLowerCase()); assert.equal(g.custom, o.custom);
    assert.deepEqual([...g.occasions].sort(), [...o.occasions].sort()); assert.deepEqual([...g.weather].sort(), [...o.weather].sort());
  });
  assert.ok(got.customTypes.some((k) => k.label === 'Sarong' && k.base === 'maxi'), 'own kind recreated from the CSV');
  ok('CSV exported and imported on a fresh phone: ' + got.items.length + ' items identical (kinds, colours, occasions, weather, own kind "Sarong") with nothing changed in the app');
  // full backup restores photos + log + settings
  await p2.click('button[data-act="tab"][data-tab="settings"]');
  await p2.setInputFiles('#fileJson', jsonPath);
  await p2.click('button[data-act="dlg-yes"]');
  await p2.waitForSelector('text=Backup restored');
  const got2 = await p2.evaluate(() => ({ n: window.__app.state.items.length, log: window.__app.state.log.length, photos: Object.keys(window.__app.photos).length, nrule: window.__app.state.settings.n }));
  const orig2 = await page.evaluate(() => ({ log: window.__app.state.log.length, photos: Object.keys(window.__app.photos).length }));
  assert.equal(got2.n, origItems.length); assert.equal(got2.log, orig2.log); assert.equal(got2.photos, orig2.photos); assert.ok(orig2.photos >= 3);
  ok('full backup restored on a fresh phone: ' + got2.n + ' items, ' + got2.photos + ' photos, ' + got2.log + ' logged outfit(s)');
  await ctx2.close();
  await page.click('button[data-act="tab"][data-tab="wardrobe"]');

  // flat-lay board from the user's own photos
  const flat = await page.evaluate(() => {
    const A = window.__app, S = A.state, by = (id) => S.items.find((i) => i.id === id);
    const last = S.items[S.items.length - 2], shoe = S.items[S.items.length - 1];
    const svg = A.flatlay({ Top: by('T001'), Bottom: last, Shoes: shoe, Bag: S.items.find((i) => i.cat === 'Bag') }, 'x');
    return { images: (svg.match(/<image /g) || []).length, tiles: (svg.match(/<rect /g) || []).length };
  });
  assert.ok(flat.images >= 3, 'photos used as tiles: ' + JSON.stringify(flat));
  await page.click('button[data-act="tab"][data-tab="today"]');
  await page.click('button[data-act="suggest"]'); await page.waitForSelector('.look');
  await page.click('button[data-act="view"][data-v="photos"]');
  assert.ok(await page.locator('.look.flat svg').count() === 3, 'flat-lay view');
  await shot('flatlay');
  await page.click('.look .fig >> nth=0'); await page.waitForSelector('.zoom.flatz svg'); await shot('flatlay-zoom'); await page.click('.zoom button.btn');
  await page.click('button[data-act="view"][data-v="illus"]');
  assert.ok(await page.locator('.look:not(.flat) svg').count() === 3, 'illustration view');
  await page.click('button[data-act="view"][data-v="photos"]');
  ok('looks can show a flat-lay of the user\'s own photos (' + flat.images + ' photo tiles in the test board), toggle to illustration and back');

  // selfie colour pick
  await page.click('button[data-act="tab"][data-tab="settings"]');
  await page.setInputFiles('#fileSelfie', PHOTO);
  await page.waitForSelector('#selfieCv');
  await page.waitForTimeout(200);
  const box = await page.locator('#selfieCv').boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  let sk = (await st()).profile.skin;
  await page.click('button[data-act="selfie-mode"][data-v="hair"]');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  const pf = (await st()).profile;
  assert.ok(['#F6D9C4', '#E8BFA0', '#D2A27E', '#B98A66', '#8D5A3C', '#5C3A26'].includes(pf.skin));
  assert.ok(pf.hairColor !== undefined);
  await shot('selfie');
  await page.click('button[data-act="selfie-done"]');
  ok('selfie: tapping skin / hair picks the nearest palette colours (' + pf.skin + ', ' + pf.hairColor + '), nothing stored');

  // running dry -> diagnosis + relax button
  await page.evaluate(() => { const S = window.__app.state; S.settings.n = 60; });
  await page.click('button[data-act="tab"][data-tab="today"]');
  await page.click('button[data-act="occ"][data-o="Casual"]');
  let dry = false, worn = 1;
  for (let k = 0; k < 40 && !dry; k++) {
    await page.click('button[data-act="suggest"]');
    if (await page.locator('.card.warn').count()) { dry = true; break; }
    await page.click('button[data-act="wear"][data-i="0"]'); worn++;
  }
  assert.ok(dry, 'wardrobe should run dry with N=60');
  await page.waitForSelector('button[data-act="relax"]');
  await shot('dry');
  const dtxt = await page.locator('.card.warn').innerText();
  assert.ok(/resting/.test(dtxt));
  await page.click('button[data-act="relax"]');
  await page.waitForSelector('.look');
  ok('after ' + worn + ' outfits the wardrobe ran dry; relax button restored suggestions');

  // no-repeat invariant over the whole recorded log (rule-limited categories, N at the time = 60 so check strictly)
  s = await st();
  const seen = new Set(); let dup = 0;
  s.log.slice(1, worn).forEach((e) => ['Top', 'Bottom', 'Dress', 'Outerwear'].forEach((c) => { if (e.items[c]) { if (seen.has(e.items[c])) dup++; seen.add(e.items[c]); } }));
  assert.equal(dup, 0, 'a clothing item repeated while N=60');
  ok('no clothing item repeated across ' + (worn - 1) + ' consecutive outfits');

  // reset
  await page.click('button[data-act="tab"][data-tab="settings"]');
  await page.click('button[data-act="reset"]');
  await page.click('button[data-act="dlg-yes"]');
  await page.waitForFunction(() => window.__app.state.items.length === 0);
  ok('reset wipes the data');

  // horizontal overflow check on every tab
  await page.click('button[data-act="demo"]').catch(() => {});
  for (const tab of ['today', 'wardrobe', 'history', 'gaps', 'settings']) {
    await page.click(`button[data-act="tab"][data-tab="${tab}"]`);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(over <= 1, tab + ' overflows by ' + over + 'px');
  }
  ok('no horizontal page scroll on any tab');

  assert.deepEqual(errors, [], 'JS errors: ' + errors.join('\n'));
  ok('no console or page errors');
  await browser.close(); server.close();
  console.log('\nE2E PASSED');
})().catch(async (e) => { console.error('\nE2E FAILED:', e.message); process.exitCode = 1; server.close(); process.exit(1); });

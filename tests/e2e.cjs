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
  assert.ok(await page.locator('text=Your wardrobe is empty').count(), 'empty state');
  ok('first run shows the empty-wardrobe card');
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
  assert.ok(/^#c0/i.test(col), 'detected colour ' + col);
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

  // running dry -> diagnosis + relax button
  await page.evaluate(() => { const S = window.__app.state; S.settings.n = 60; });
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

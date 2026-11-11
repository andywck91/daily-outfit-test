import assert from 'node:assert/strict';
import { loadOF } from './load.mjs';

const OF = loadOF();
const E = OF.engine;
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('ok  -', name); };

function freshState(withDemo = true) {
  const s = E.defaultState();
  if (withDemo) { const d = OF.demo.makeDemoItems(s); s.items = d.items; s.counters = d.counters; }
  return s;
}
function wear(state, look, occasion) {
  const items = {};
  for (const c of E.CATEGORIES) if (look.parts[c]) items[c] = look.parts[c].id;
  state.log.push({ n: state.log.length + 1, date: '2026-11-11', occasion, items });
}

test('resting maths matches the Excel template (N=10, 3 logged outfits)', () => {
  const s = E.defaultState();
  const mk = (id, cat) => ({ id, cat, name: id, color: '#999', occasions: [], weather: [] });
  s.items = [mk('T001', 'Top'), mk('T002', 'Top'), mk('T003', 'Top'), mk('D001', 'Dress'), mk('S001', 'Shoes')];
  s.log = [
    { n: 1, items: { Top: 'T001' } },
    { n: 2, items: { Top: 'T002' } },
    { n: 3, items: { Dress: 'D001', Shoes: 'S001' } },
  ];
  const st = (id) => E.itemStatus(s, s.items.find((i) => i.id === id));
  assert.deepEqual(st('T001'), { status: 'resting', wait: 8 });
  assert.deepEqual(st('T002'), { status: 'resting', wait: 9 });
  assert.deepEqual(st('D001'), { status: 'resting', wait: 10 });
  assert.equal(st('T003').status, 'available');
  assert.equal(st('S001').status, 'available', 'shoes are not limited by default');
  s.settings.rule.Shoes = true;
  assert.equal(st('S001').status, 'resting', 'rule can be switched on per category');
});

test('item frees up exactly after N further outfits', () => {
  const s = E.defaultState();
  s.settings.n = 3;
  s.items = [{ id: 'T001', cat: 'Top', name: 'x', color: '#999', occasions: [], weather: [] }];
  s.log = [{ n: 1, items: { Top: 'T001' } }];
  const st = () => E.itemStatus(s, s.items[0]).status;
  assert.equal(st(), 'resting');           // 0 outfits since
  s.log.push({ n: 2, items: {} }); assert.equal(st(), 'resting'); // 1
  s.log.push({ n: 3, items: {} }); assert.equal(st(), 'resting'); // 2
  s.log.push({ n: 4, items: {} }); assert.equal(st(), 'available'); // 3 = N
});

test('laundry items are never offered', () => {
  const s = freshState();
  s.items.forEach((i) => { if (i.cat === 'Dress') i.laundry = true; });
  for (let k = 0; k < 20; k++) {
    const r = E.generate(s, 'Date', ['hot_humid']);
    r.looks.forEach((l) => assert.equal(l.parts.Dress, null));
  }
});

test('generates 3 different looks from the demo wardrobe', () => {
  const s = freshState();
  const r = E.generate(s, 'Business', ['hot_humid', 'aircon'], { rng: E.mulberry32(1) });
  assert.equal(r.looks.length, 3);
  const keys = r.looks.map((l) => ['Top', 'Bottom', 'Dress'].map((c) => (l.parts[c] ? l.parts[c].id : '-')).join('/'));
  assert.equal(new Set(keys).size, 3, 'clothing differs: ' + keys.join(' | '));
  r.looks.forEach((l) => {
    assert.ok(l.parts.Dress || (l.parts.Top && l.parts.Bottom), 'complete outfit');
    assert.ok(l.parts.Outerwear, 'aircon day gets a layer');
    assert.ok(l.groom.hairId && l.groom.makeupKeys.length);
  });
});

test('hot day without aircon: no outerwear; sport gets sneakers', () => {
  const s = freshState();
  const r = E.generate(s, 'Sport', ['hot_sunny'], { rng: E.mulberry32(2) });
  r.looks.forEach((l) => {
    assert.equal(l.parts.Outerwear, null);
    assert.equal(l.parts.Shoes.type, 'sneakers');
    assert.equal(l.parts.Dress, null);
  });
});

test('Business looks never use shorts or sandals as first choice', () => {
  const s = freshState();
  for (let k = 0; k < 15; k++) {
    const r = E.generate(s, 'Business', ['hot_humid', 'aircon'], { rng: E.mulberry32(k + 10) });
    r.looks.forEach((l) => { if (l.parts.Bottom) assert.notEqual(l.parts.Bottom.type, 'shorts'); });
  }
});

test('NO-REPEAT INVARIANT: wearing look after look never reuses a rule-limited item within N outfits', () => {
  const s = freshState();
  const occs = ['Casual', 'Business', 'Date', 'Travel', 'Casual', 'Business', 'Party', 'Casual', 'Date', 'Business', 'Casual', 'Travel', 'Business', 'Date'];
  let worn = 0;
  for (const occ of occs) {
    const r = E.generate(s, occ, ['hot_humid', 'aircon'], { rng: E.mulberry32(100 + worn) });
    if (!r.looks.length) break;
    const look = r.looks[0];
    const N = s.settings.n;
    for (const c of E.CLOTHING) {
      if (!look.parts[c]) continue;
      const recent = s.log.slice(-N);
      assert.ok(!recent.some((e) => Object.values(e.items).includes(look.parts[c].id)), `repeat of ${look.parts[c].id} within ${N}`);
    }
    wear(s, look, occ);
    worn++;
  }
  assert.ok(worn >= 6, 'wardrobe supports at least 6 consecutive outfits, got ' + worn);
  console.log('      (consecutive outfits before running dry:', worn + ')');
});

test('when the wardrobe runs dry: diagnosis + a smaller N is suggested', () => {
  const s = E.defaultState();
  const mk = (id, cat, type) => ({ id, cat, type, name: id, color: '#CDB89A', occasions: [], weather: [] });
  s.items = [mk('T001', 'Top', 'shirt'), mk('T002', 'Top', 'tee'), mk('B001', 'Bottom', 'trousers'), mk('B002', 'Bottom', 'jeans')];
  const r1 = E.generate(s, 'Casual', ['hot_humid'], { rng: E.mulberry32(3) });
  wear(s, r1.looks[0], 'Casual');
  const r2 = E.generate(s, 'Casual', ['hot_humid'], { rng: E.mulberry32(3) });
  wear(s, r2.looks[0], 'Casual');
  const r3 = E.generate(s, 'Casual', ['hot_humid'], { rng: E.mulberry32(3) });
  assert.equal(r3.looks.length, 0);
  assert.equal(r3.missing.Top.resting, 2);
  assert.equal(r3.missing.Top.available, 0);
  assert.ok(r3.missing.Top.nextWait >= 1);
  assert.equal(r3.suggestN, 1, 'N=1 would free the oldest outfit pieces: ' + r3.suggestN);
  const r4 = E.generate(s, 'Casual', ['hot_humid'], { n: r3.suggestN, rng: E.mulberry32(3) });
  assert.ok(r4.looks.length >= 1);
});

test('occasion mismatch is flagged as a stretch rather than silently used', () => {
  const s = E.defaultState();
  const mk = (id, cat, type, occ) => ({ id, cat, type, name: id, color: '#CDB89A', occasions: occ, weather: [] });
  s.items = [mk('T001', 'Top', 'tee', ['Casual']), mk('B001', 'Bottom', 'jeans', ['Casual'])];
  const r = E.generate(s, 'Formal', ['hot_humid'], { rng: E.mulberry32(5) });
  assert.equal(r.looks.length, 1);
  assert.ok(r.warnings.some((w) => w.code === 'stretch'));
  assert.equal(r.looks[0].stretch.length, 2);
});

test('colour harmony: neutrals fine, 3 clashing hues penalised', () => {
  assert.ok(E.harmony(['#1E1E20', '#F7F5F0', '#CDB89A']) >= 2);
  assert.ok(E.harmony(['#1F2E4D', '#CDB89A']) >= 2);       // navy + beige count as neutrals
  assert.ok(E.harmony(['#C0392B', '#3B6FB6', '#3E7B5A']) < 0);
  assert.ok(E.harmony(['#C0392B', '#3E7B5A']) > E.harmony(['#C0392B', '#E9C46A', '#3B6FB6']));
});

test('weather -> conditions (Malaysia defaults)', () => {
  assert.deepEqual(E.conditions(null, null, false), ['hot_humid']);
  assert.deepEqual(E.conditions({ temp: 32, feels: 38, humidity: 80, rainProb: 20 }, null, true), ['hot_humid', 'aircon']);
  assert.deepEqual(E.conditions({ temp: 31, feels: 34, humidity: 50, rainProb: 10 }, null, false), ['hot_sunny']);
  assert.deepEqual(E.conditions({ temp: 29, feels: 33, humidity: 85, rainProb: 80 }, null, false), ['rainy', 'hot_humid']);
  assert.deepEqual(E.conditions({ temp: 18, feels: 17, humidity: 80, rainProb: 0 }, null, false), ['cool']);
  assert.deepEqual(E.conditions({ temp: 32, feels: 38, humidity: 80 }, 'rainy', false), ['rainy']);
});

test('hot + humid pushes updos first; short hair stays short; no-makeup profile gets skincare', () => {
  const p = { hairLength: 'long', figure: 'feminine', makeup: true };
  const g0 = E.groom('Casual', ['hot_humid'], p, 0);
  assert.ok(['braid', 'ponytail', 'bun', 'lowbun'].includes(g0.hairId), g0.hairId);
  assert.ok(g0.makeupKeys.includes('mk.humid'));
  assert.equal(E.groom('Date', ['aircon'], { ...p, hairLength: 'short' }, 1).hairId, 'short');
  assert.equal(E.groom('Business', ['aircon'], { ...p, makeup: false }, 0).makeupKeys[0], 'mk.skin');
});

test('CSV import reads the Wardrobe sheet of the Excel template (EN + 中文, aliases, inferred types)', () => {
  const csv = [
    'Item ID 编号,Category 类别,Name (EN),名称 (中文),Color 颜色,Style tags 风格,Occasions 场合 (comma-separated),Weather 天气适用,Photo file 照片文件名',
    'T001,Top,White linen shirt,白色亚麻衬衫,White,"Minimal, Smart","Business, Casual, Client Visit, Summer",Hot & Humid,T001.jpg',
    'B003,Bottom,Black pencil skirt,黑色铅笔裙,Black,"Smart, Classic","Business, Formal, Client Visit",Air-con / Cool,B003.jpg',
    'S002,Shoes,Nude block heels,裸色粗跟鞋,Nude,"Smart, Classic","Business, Date, Formal, Party",Hot & Humid,S002.jpg',
    'X1,Hat,Straw hat,草帽,Beige,,,,',
  ].join('\r\n');
  const s = E.defaultState();
  const r = E.importCSV(s, csv);
  assert.equal(r.items.length, 3);
  assert.equal(r.skipped, 1);
  const [t, b, sh] = r.items;
  assert.equal(t.id, 'T001'); assert.equal(t.type, 'shirt');
  assert.deepEqual(t.occasions.sort(), ['Business', 'Casual', 'ClientVisit', 'Summer']);
  assert.deepEqual(t.weather, ['hot_humid']);
  assert.equal(b.type, 'skirt'); assert.deepEqual(b.weather, ['aircon']);
  assert.equal(sh.type, 'heels');
  assert.equal(t.color.toLowerCase(), '#f7f5f0');
  // export -> import round trip
  s.items = r.items;
  const back = E.importCSV(E.defaultState(), E.wardrobeCSV(s));
  assert.equal(back.items.length, 3);
  assert.deepEqual(back.items.map((i) => i.id), ['T001', 'B003', 'S002']);
});

test('gap check + shopping suggestions', () => {
  const s = freshState();
  const m = E.gapMatrix(s);
  assert.ok(m.Top.Business >= 3);
  assert.equal(m.Dress.Sport, 0);
  const sug = E.suggestions(s, 5);
  assert.ok(sug.length > 0 && sug.length <= 5);
  sug.forEach((x) => { assert.ok(E.CATEGORIES.includes(x.cat)); assert.ok(E.TYPES[x.cat].includes(x.type)); assert.ok(x.occasions.length); });
  const empty = E.defaultState();
  assert.ok(E.suggestions(empty, 5).length > 0, 'empty wardrobe suggests basics');
});

test('shopping ideas skip nonsense combinations (no dress for Sport, no blazer for the beach)', () => {
  const s = E.defaultState();
  const sug = E.suggestions(s, 20);
  sug.forEach((x) => {
    assert.ok(x.occasions.every((o) => E.relevant(x.cat, o)), x.cat + ' for ' + x.occasions);
  });
  assert.equal(E.relevant('Dress', 'Sport'), false);
  assert.equal(E.relevant('Outerwear', 'Beach'), false);
  assert.equal(E.relevant('Shoes', 'Sport'), true);
});

test('automatic tags: the user only says what the item is', () => {
  const a = (c, t, col) => E.autoTags(c, t, col);
  assert.ok(a('Top', 'shirt', '#F7F5F0').occasions.includes('Business'));
  assert.ok(!a('Bottom', 'shorts', '#6F94C2').occasions.includes('Business'));
  assert.ok(a('Shoes', 'sneakers', '#F4F4F2').occasions.includes('Sport'));
  assert.ok(!a('Shoes', 'sneakers', '#F4F4F2').occasions.includes('Formal'));
  assert.ok(a('Dress', 'midi', '#1E1E20').occasions.includes('Formal'), 'little black dress');
  const red = a('Dress', 'midi', '#B9362C').occasions;
  assert.ok(!red.includes('Formal') && red.includes('Festive'), 'bright red dress is festive, not formal: ' + red);
  assert.deepEqual(a('Outerwear', 'blazer', '#D9C7AB').weather, ['aircon', 'cool']);
  assert.deepEqual(a('Top', 'shirt', '#fff').weather, []);
  assert.equal(E.colorKey('#C0392B'), 'red'); assert.equal(E.colorKey('#1F2E4D'), 'navy'); assert.equal(E.colorKey('#EFE3CF'), 'white');
  // every type of every category has tags
  for (const c of E.CATEGORIES) for (const t of E.TYPES[c]) assert.ok(a(c, t, '#888888').occasions.length > 0, c + '/' + t);
  // an auto-tagged wardrobe still produces outfits for every occasion
  const s = E.defaultState();
  const kinds = [['Top', 'shirt'], ['Top', 'tee'], ['Top', 'knit'], ['Bottom', 'trousers'], ['Bottom', 'jeans'], ['Bottom', 'skirt'], ['Bottom', 'shorts'], ['Shoes', 'flats'], ['Shoes', 'sneakers'], ['Shoes', 'sandals'], ['Shoes', 'heels'], ['Bag', 'tote']];
  kinds.forEach(([c, t], i) => { const col = ['#F7F5F0', '#1E1E20', '#CDB89A', '#1F2E4D'][i % 4]; const g = E.autoTags(c, t, col); s.items.push({ id: E.nextId(s, c), cat: c, type: t, name: t, color: col, occasions: g.occasions, weather: g.weather }); });
  for (const occ of ['Business', 'Casual', 'Sport', 'Beach', 'Date']) assert.ok(E.generate(s, occ, ['hot_humid'], { rng: E.mulberry32(4) }).looks.length >= 1, occ);
});

test('CSV rows without occasions get automatic ones', () => {
  const r = E.importCSV(E.defaultState(), 'Category,Name (EN),Color\nTop,White linen shirt,White\nShoes,Black heels,Black\n');
  assert.equal(r.items.length, 2);
  assert.ok(r.items[0].occasions.includes('Business'));
  assert.ok(r.items[1].occasions.includes('Formal'));
});

test('item ids are unique and prefixed by category', () => {
  const s = freshState();
  const ids = s.items.map((i) => i.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(s.items.filter((i) => i.cat === 'Top').every((i) => /^T\d{3}$/.test(i.id)));
});

console.log(`\n${passed} tests passed`);

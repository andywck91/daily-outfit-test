// Dev helper: renders illustrations to SVG files so they can be eyeballed (rsvg-convert -> PNG).
import fs from 'node:fs';
import path from 'node:path';
import { loadOF } from './load.mjs';

const out = process.argv[2] || '/tmp/looks';
fs.mkdirSync(out, { recursive: true });
const OF = loadOF(['engine.js', 'demo.js', 'illustration.js']);
const E = OF.engine;
const s = E.defaultState();
const d = OF.demo.makeDemoItems(s); s.items = d.items;

const r = E.generate(s, 'Business', ['hot_humid', 'aircon'], { rng: E.mulberry32(1) });
r.looks.forEach((l, i) => fs.writeFileSync(path.join(out, `look${i + 1}.svg`), OF.illustration.render(s.profile, l.parts, l.groom)));

// gallery: every garment type + every hair style + figure variants
const by = (cat, type) => s.items.find((i) => i.cat === cat && i.type === type);
const skin = '#E8BFA0';
const cases = [
  ['g1', { Top: by('Top', 'tank'), Bottom: by('Bottom', 'shorts'), Shoes: by('Shoes', 'sandals'), Bag: by('Bag', 'shoulder') }, 'bun'],
  ['g2', { Top: by('Top', 'tee'), Bottom: by('Bottom', 'jeans'), Outerwear: by('Outerwear', 'jacket'), Shoes: by('Shoes', 'sneakers'), Bag: by('Bag', 'backpack'), Jewelry: by('Jewelry', 'set') }, 'ponytail'],
  ['g3', { Top: by('Top', 'knit'), Bottom: by('Bottom', 'skirt'), Outerwear: by('Outerwear', 'cardigan'), Shoes: by('Shoes', 'flats'), Bag: by('Bag', 'tote') }, 'braid'],
  ['g4', { Dress: by('Dress', 'mini'), Shoes: by('Shoes', 'heels'), Jewelry: by('Jewelry', 'set') }, 'halfup'],
  ['g5', { Dress: by('Dress', 'midi'), Outerwear: by('Outerwear', 'blazer'), Shoes: null, Bag: by('Bag', 'shoulder') }, 'lowbun'],
];
cases.forEach(([n, parts, hair]) => {
  const full = { Top: null, Bottom: null, Dress: null, Outerwear: null, Shoes: null, Bag: null, Jewelry: null, ...parts };
  fs.writeFileSync(path.join(out, n + '.svg'), OF.illustration.render(s.profile, full, { hairId: hair, makeupKeys: ['mk.work'] }));
});
const male = { ...s.profile, figure: 'masculine', hairLength: 'short', makeup: false, skin: '#B98A66', hairColor: '#17110F' };
fs.writeFileSync(path.join(out, 'm1.svg'), OF.illustration.render(male, { Top: by('Top', 'shirt'), Bottom: by('Bottom', 'trousers'), Outerwear: by('Outerwear', 'blazer'), Shoes: by('Shoes', 'flats'), Bag: by('Bag', 'tote'), Dress: null, Jewelry: null }, { hairId: 'short', makeupKeys: ['mk.skin'] }));
const med = { ...s.profile, hairLength: 'medium', skin: '#8D5A3C', hairColor: '#5A3A22' };
fs.writeFileSync(path.join(out, 'm2.svg'), OF.illustration.render(med, { Top: by('Top', 'tee'), Bottom: by('Bottom', 'trousers'), Dress: null, Outerwear: null, Shoes: by('Shoes', 'sneakers'), Bag: null, Jewelry: null }, { hairId: 'down', makeupKeys: ['mk.casual'] }));
console.log('wrote to', out, fs.readdirSync(out).length, 'files');

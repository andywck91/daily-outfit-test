// Loads the browser scripts into node's global so engine logic can be tested without a DOM.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'www', 'js');
export function loadOF(files = ['engine.js', 'demo.js']) {
  delete globalThis.OF;
  for (const f of files) vm.runInThisContext(fs.readFileSync(path.join(root, f), 'utf8'), { filename: f });
  return globalThis.OF;
}

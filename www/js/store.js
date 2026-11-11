/* Local storage: IndexedDB (state + photos). Falls back to memory-only if IndexedDB is unavailable. */
(function (g) {
  'use strict';
  const OF = (g.OF = g.OF || {});
  const DB = 'daily-outfit', VER = 1;
  let dbp = null, memory = false;

  function open() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      try {
        const r = indexedDB.open(DB, VER);
        r.onupgradeneeded = () => { r.result.createObjectStore('kv'); r.result.createObjectStore('photos'); };
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
        r.onblocked = () => rej(new Error('blocked'));
      } catch (e) { rej(e); }
    }).catch(() => { memory = true; return null; });
    return dbp;
  }
  const mem = { kv: {}, photos: {} };
  function tx(db, store, mode, fn) {
    return new Promise((res, rej) => {
      const t = db.transaction(store, mode);
      const out = fn(t.objectStore(store));
      t.oncomplete = () => res(out && out.result !== undefined ? out.result : undefined);
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error);
    });
  }
  async function getAll(db, store) {
    return new Promise((res, rej) => {
      const out = {};
      const t = db.transaction(store, 'readonly').objectStore(store).openCursor();
      t.onsuccess = () => { const c = t.result; if (c) { out[c.key] = c.value; c.continue(); } else res(out); };
      t.onerror = () => rej(t.error);
    });
  }

  let timer = null;
  const store = {
    isMemory: () => memory,
    async load() {
      const db = await open();
      if (!db) return { state: mem.kv.state || null, photos: { ...mem.photos } };
      const state = await tx(db, 'kv', 'readonly', (s) => s.get('state'));
      const photos = await getAll(db, 'photos');
      return { state: state || null, photos };
    },
    saveState(state) {
      clearTimeout(timer);
      timer = setTimeout(() => store.saveNow(state), 250);
    },
    async saveNow(state) {
      const db = await open();
      const copy = JSON.parse(JSON.stringify(state));
      if (!db) { mem.kv.state = copy; return; }
      await tx(db, 'kv', 'readwrite', (s) => s.put(copy, 'state'));
    },
    async putPhoto(id, dataUrl) {
      const db = await open();
      if (!db) { mem.photos[id] = dataUrl; return; }
      await tx(db, 'photos', 'readwrite', (s) => s.put(dataUrl, id));
    },
    async delPhoto(id) {
      const db = await open();
      if (!db) { delete mem.photos[id]; return; }
      await tx(db, 'photos', 'readwrite', (s) => s.delete(id));
    },
    async clear() {
      const db = await open();
      if (!db) { mem.kv = {}; mem.photos = {}; return; }
      await tx(db, 'kv', 'readwrite', (s) => s.clear());
      await tx(db, 'photos', 'readwrite', (s) => s.clear());
    },
  };
  OF.store = store;
})(typeof window !== 'undefined' ? window : globalThis);

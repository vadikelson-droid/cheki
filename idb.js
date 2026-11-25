// Хранилище на телефоне. Общее для страницы и фонового помощника (sw.js).
const idb = (() => {
  let opening;
  const open = () => opening ||= new Promise((ok, no) => {
    const r = indexedDB.open('cheki', 1);
    r.onupgradeneeded = () => { r.result.createObjectStore('receipts', { keyPath: 'id' }); r.result.createObjectStore('kv'); };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => { opening = null; no(r.error); };
  });
  // Готово только когда запись действительно завершена.
  const tx = async (store, mode, fn) => {
    const db = await open();
    return new Promise((ok, no) => {
      const t = db.transaction(store, mode), r = fn(t.objectStore(store));
      t.oncomplete = () => ok(r && r.result);
      t.onabort = t.onerror = () => no(t.error);
    });
  };
  return {
    all: () => tx('receipts', 'readonly', (s) => s.getAll()),
    put: (r) => tx('receipts', 'readwrite', (s) => s.put(r)),
    del: (id) => tx('receipts', 'readwrite', (s) => s.delete(id)),
    get: (k) => tx('kv', 'readonly', (s) => s.get(k)),
    set: (k, v) => tx('kv', 'readwrite', (s) => s.put(v, k)),
  };
})();

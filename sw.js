// Фоновый помощник: работа без сети, «Поделиться» из других приложений, напоминание о продуктах.
importScripts('idb.js');
const CACHE = 'cheki-v4';
const FILES = ['./', 'index.html', 'app.js', 'app.css', 'idb.js', 'manifest.webmanifest', 'icons/192.png',
  'fonts/text-cyr.woff2', 'fonts/text-lat.woff2', 'fonts/cond-cyr.woff2', 'fonts/cond-lat.woff2'];

self.addEventListener('install', (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k.startsWith('cheki-') && k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin || !url.href.startsWith(self.registration.scope)) return;
  if (e.request.method === 'POST' && url.pathname.endsWith('/share')) { e.respondWith(share(e.request)); return; }
  if (e.request.method !== 'GET') return;
  // Сначала свежее из сети, без сети берём сохранённое.
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const r = await fetch(e.request, { cache: 'no-cache' });
      if (r.ok) await cache.put(e.request.mode === 'navigate' ? './' : e.request, r.clone());
      return r;
    } catch (err) {
      return (await cache.match(e.request.mode === 'navigate' ? './' : e.request)) || Response.error();
    }
  })());
});

async function share(request) {
  let ok = 0;
  try {
    const files = (await request.formData()).getAll('files').filter((f) => f && f.size && f.size < 15e6).slice(0, 6);
    if (files.length) { await idb.set('shared', files.map((f) => new Blob([f], { type: f.type }))); ok = 1; }
  } catch (err) { /* ниже откроем приложение без файла */ }
  return Response.redirect('./?shared=' + ok, 303);
}

const localDay = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
async function remind() {
  if (Notification.permission !== 'granted') return;
  const day = localDay();
  if ((await idb.get('reminded')) === day) return;
  const due = ((await idb.get('forecast')) || []).filter((x) => x.date <= day).map((x) => x.name);
  if (!due.length) return;
  await idb.set('reminded', day);
  await self.registration.showNotification('Заканчивается', {
    body: due.slice(0, 6).join(', ') + (due.length > 6 ? ' и ещё ' + (due.length - 6) : ''), icon: 'icons/192.png', tag: 'stock', lang: 'ru',
  });
}
self.addEventListener('periodicsync', (e) => { if (e.tag === 'stock') e.waitUntil(remind()); });
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil((async () => {
    const open = await self.clients.matchAll({ type: 'window' });
    if (open.length) { await open[0].focus(); open[0].postMessage('buy'); } else await self.clients.openWindow('./?tab=buy');
  })());
});

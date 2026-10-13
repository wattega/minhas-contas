/* Faz o app abrir mesmo sem internet. Se mudar algum arquivo do app, troque o número da versão abaixo. */
const CACHE = 'minhas-contas-v1';
const ARQUIVOS = [
  './', './index.html', './style.css', './logic.js', './app.js', './manifest.json',
  './icons/icon-192.png', './icons/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(chaves => Promise.all(chaves.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Abre na hora com o que está guardado e, se houver internet, atualiza em segundo plano.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.match(e.request).then(guardado => {
      const rede = fetch(e.request).then(r => {
        if (r && r.ok) { const copia = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copia)); }
        return r;
      }).catch(() => guardado || caches.match('./index.html'));
      return guardado || rede;
    })
  );
});

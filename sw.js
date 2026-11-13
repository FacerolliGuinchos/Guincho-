/* Modo sem internet do app Guincho: guarda o app e a ferramenta de PDF no celular. */
const CACHE = 'guincho-v1';
const JSPDF = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
const FONTES = 'https://fonts.googleapis.com/css2?family=Archivo:wght@400;600;800&family=Archivo+Narrow:wght@500;700&display=swap';

const comTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('lento')), ms))]);
const guarda = (req, res) => {
  if (res && (res.ok || res.type === 'opaque') && !res.redirected) {
    const copia = res.clone();
    caches.open(CACHE).then(c => c.put(req, copia));
  }
  return res;
};

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.allSettled([c.add(new Request('./', {cache: 'reload'})), c.add(JSPDF), c.add(FONTES)]);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);

  /* PDF e fontes: usa o que está guardado e atualiza em segundo plano */
  if (r.url === JSPDF || u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.match(r).then(h => {
      const rede = fetch(r).then(res => guarda(r, res)).catch(() => h);
      return h || rede;
    }));
    return;
  }

  if (u.origin !== self.location.origin) return;

  /* app: tenta a internet (até 4 s) para pegar versões novas; sem sinal, usa o guardado */
  const rede = fetch(r).then(res => guarda(r, res));
  e.respondWith(comTimeout(rede, 4000).catch(async () =>
    (await caches.match(r, {ignoreSearch: true})) ||
    (r.mode === 'navigate' ? await caches.match('./') : undefined) ||
    rede));
});

/*
 * Service worker ученического приложения Lemma (PWA, v3.9.369).
 *
 * 🚨 НАМЕРЕННО НИЧЕГО НЕ КЭШИРУЕТ. Приложение обновляется часто, а кэш
 * service worker'а — главный источник «у меня старая версия» у PWA. Поэтому:
 *  • переходы по страницам (navigate) — всегда в сеть; нет сети — страница
 *    «Нет подключения» прямо отсюда, без Cache API;
 *  • всё остальное (скрипты, картинки, API) он не трогает вовсе — работает
 *    обычный HTTP-кэш браузера, как у сайта без service worker.
 * Сам worker нужен только чтобы браузер считал приложение устанавливаемым.
 * Новая версия этого файла ставится сразу (skipWaiting + clients.claim): в нём
 * нет состояния, которое могло бы разойтись со страницей.
 */

// Поменять строку = заставить телефоны переустановить worker (байты файла другие).
const SW_VERSION = 'v1';

const OFFLINE_HTML = `<!doctype html>
<html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Lemma — нет подключения</title>
<style>
  :root { color-scheme: light dark; }
  body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #f8f9ff; color: #1a1a2e; text-align: center; padding: 24px; box-sizing: border-box; }
  .box { max-width: 320px; }
  h1 { font-size: 20px; margin: 16px 0 8px; }
  p { margin: 0 0 20px; color: #5d6275; line-height: 1.45; }
  img { width: 72px; height: 72px; border-radius: 18px; }
  button { font: inherit; font-weight: 600; border: 0; border-radius: 12px; padding: 12px 28px;
    background: #4361ee; color: #fff; cursor: pointer; }
  @media (prefers-color-scheme: dark) {
    body { background: #0f0e17; color: #eceef5; } p { color: #a9aec0; }
  }
</style></head>
<body><div class="box">
  <img src="/pwa/icon-192.png" alt="" onerror="this.remove()">
  <h1>Нет подключения к интернету</h1>
  <p>Lemma откроется сама, как только связь появится.</p>
  <button type="button" onclick="location.reload()">Повторить</button>
</div>
<script>addEventListener('online', function () { location.reload(); });</script>
</body></html>`;

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Кэшей у нас нет; на случай, если когда-нибудь появятся, — чистим чужие версии.
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('lemma-')).map((k) => caches.delete(k)));
    // Запрос страницы стартует параллельно с запуском worker'а — без задержки.
    if (self.registration.navigationPreload) {
      await self.registration.navigationPreload.enable();
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return; // не трогаем: обычная сеть и HTTP-кэш
  event.respondWith((async () => {
    try {
      const preloaded = await event.preloadResponse;
      if (preloaded) return preloaded;
      return await fetch(event.request);
    } catch {
      return new Response(OFFLINE_HTML, {
        status: 503,
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Lemma-SW': SW_VERSION },
      });
    }
  })());
});

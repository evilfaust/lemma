/**
 * Подключение PWA ученического приложения (v3.9.369): service worker и
 * восстановление после деплоя. Вызывается из `student/main.jsx` до React.
 */

/** Только боевой домен учеников: на малине `dist/` лежит целиком, и там
 *  service worker со scope `/` перехватывал бы учительское приложение. */
export const STUDENT_HOST = 'student.oipav.ru';

const CHUNK_RELOAD_KEY = 'lemma.pwa.chunkReloadAt';
const CHUNK_RELOAD_PAUSE_MS = 60 * 1000;

export function registerStudentServiceWorker() {
  if (!import.meta.env.PROD) return;
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  if (window.location.hostname !== STUDENT_HOST) return;
  window.addEventListener('load', () => {
    // updateViaCache: 'none' — sw.js всегда с сервера: nginx отдаёт *.js с
    // кэшем на год, и без этого правка service worker не дошла бы до телефонов.
    navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .catch(() => { /* без service worker приложение работает как сайт */ });
  });
}

/**
 * Чанк не загрузился (страница открыта до деплоя, а файл уже другой или нет
 * сети на миг) — один раз перезапускаемся, второй раз за минуту — нет, пусть
 * сработает ErrorBoundary. Vite сообщает об этом событием `vite:preloadError`.
 */
export function installChunkRecovery({ reload = () => window.location.reload(), now = () => Date.now() } = {}) {
  if (typeof window === 'undefined') return;
  window.addEventListener('vite:preloadError', (event) => {
    let last = 0;
    try { last = Number(window.sessionStorage.getItem(CHUNK_RELOAD_KEY)) || 0; } catch { /* приватный режим */ }
    if (now() - last < CHUNK_RELOAD_PAUSE_MS) return;
    try { window.sessionStorage.setItem(CHUNK_RELOAD_KEY, String(now())); } catch { /* приватный режим */ }
    event.preventDefault();
    reload();
  });
}

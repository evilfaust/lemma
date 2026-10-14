/**
 * Ученическое приложение на телефоне (PWA, v3.9.369): установка и — главное —
 * обновление. Сторожит, что установленное приложение не застревает на старой
 * версии: service worker ничего не кэширует, страница сама узнаёт о новой
 * сборке и перезапускается, только когда это никому не мешает.
 */
import fs from 'fs';
import path from 'path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, screen } from '@testing-library/react';
import {
  isNewRelease, updateAction, alreadyReloadedFor, rememberReloadFor, isCabinetPath,
  STALE_AFTER_MS, CHECK_EVERY_MS, RELOADED_FOR_KEY,
} from '../student/pwa/appUpdate';
import { installPlatform, isInAppBrowser } from '../student/pwa/install';
import { useAppUpdate, useBlockAppReload, AppUpdateBanner } from '../student/pwa/useAppUpdate';
import { installChunkRecovery } from '../student/pwa/register';

const root = path.resolve(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.resolve(root, rel), 'utf8');

// ── Правила обновления ───────────────────────────────────────────────────────
describe('appUpdate: когда перезапускаться', () => {
  it('новая версия — только другая непустая releaseId', () => {
    expect(isNewRelease({ releaseId: '3.9.370-1' }, '3.9.369-1')).toBe(true);
    expect(isNewRelease({ releaseId: '3.9.369-1' }, '3.9.369-1')).toBe(false);
    expect(isNewRelease({}, '3.9.369-1')).toBe(false);
    expect(isNewRelease(null, '3.9.369-1')).toBe(false);
  });

  const base = { newRelease: true, online: true, busy: false, resumed: false, hiddenMs: 0, refreshOnResume: false };

  it('вернулись в приложение и есть новая версия — перезапуск', () => {
    expect(updateAction({ ...base, resumed: true })).toBe('reload');
  });

  it('приложение на экране — только плашка, под пальцем не дёргаем', () => {
    expect(updateAction(base)).toBe('banner');
  });

  it('идёт тест — ничего, даже плашки', () => {
    expect(updateAction({ ...base, resumed: true, busy: true })).toBe('none');
    expect(updateAction({ ...base, busy: true })).toBe('none');
  });

  it('нет связи — не перезапускаемся (иначе экран «нет подключения»)', () => {
    expect(updateAction({ ...base, resumed: true, online: false })).toBe('none');
    expect(updateAction({ ...base, newRelease: false, resumed: true, online: false, refreshOnResume: true, hiddenMs: STALE_AFTER_MS * 2 })).toBe('none');
  });

  it('главная, свёрнутая надолго, перечитывается и без новой версии', () => {
    const stale = { ...base, newRelease: false, resumed: true, refreshOnResume: true };
    expect(updateAction({ ...stale, hiddenMs: STALE_AFTER_MS })).toBe('reload');
    expect(updateAction({ ...stale, hiddenMs: STALE_AFTER_MS - 1 })).toBe('none');
    // не главная (статья, пособие) — место чтения не теряем
    expect(updateAction({ ...stale, refreshOnResume: false, hiddenMs: STALE_AFTER_MS * 10 })).toBe('none');
  });

  it('защита от петли: под эту версию уже перезапускались', () => {
    const store = new Map();
    const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
    const remote = { releaseId: 'v2' };
    expect(alreadyReloadedFor(remote, storage)).toBe(false);
    rememberReloadFor(remote, storage);
    expect(store.get(RELOADED_FOR_KEY)).toBe('v2');
    expect(alreadyReloadedFor(remote, storage)).toBe(true);
    expect(alreadyReloadedFor({ releaseId: 'v3' }, storage)).toBe(false);
    expect(alreadyReloadedFor(remote, null)).toBe(false);
  });

  it('главная кабинета — по адресу', () => {
    for (const p of ['/', '/student', '/student/']) expect(isCabinetPath(p)).toBe(true);
    for (const p of ['/student/abc123', '/b/XKQ', '/s/id', '/student/t/id', '/t/id']) expect(isCabinetPath(p)).toBe(false);
  });
});

// ── Установка ────────────────────────────────────────────────────────────────
describe('install: что предложить', () => {
  const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1';
  const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/126.0 Mobile Safari/537.36';
  const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 Version/17.5 Safari/605.1.15';

  it('iPhone — инструкция; iPad «под Mac» тоже узнаётся', () => {
    expect(installPlatform({ ua: IPHONE })).toBe('ios');
    expect(installPlatform({ ua: MAC, platform: 'MacIntel', maxTouchPoints: 5 })).toBe('ios');
  });

  it('Android — системный диалог, если браузер его дал, иначе инструкция', () => {
    expect(installPlatform({ ua: ANDROID, hasPrompt: true })).toBe('prompt');
    expect(installPlatform({ ua: ANDROID })).toBe('android');
  });

  it('компьютер и уже установленное — ничего', () => {
    expect(installPlatform({ ua: MAC, platform: 'MacIntel', hasPrompt: true })).toBe(null);
    expect(installPlatform({ ua: IPHONE, standalone: true })).toBe(null);
    expect(installPlatform({ ua: ANDROID, hasPrompt: true, standalone: true })).toBe(null);
  });

  it('встроенный браузер Telegram узнаётся', () => {
    expect(isInAppBrowser(`${ANDROID} Telegram-Android/11.0`)).toBe(true);
    expect(isInAppBrowser(ANDROID)).toBe(false);
  });
});

// ── Хук обновления ───────────────────────────────────────────────────────────
describe('useAppUpdate', () => {
  let visibility = 'visible';
  let remote = { releaseId: 'new' };
  let clock = 0;

  beforeEach(() => {
    vi.useFakeTimers();
    visibility = 'visible';
    remote = { releaseId: 'new' };
    clock = 1_000_000;
    sessionStorage.clear();
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
    global.fetch = vi.fn(async () => (remote ? { ok: true, json: async () => remote } : Promise.reject(new Error('offline'))));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function Harness({ reload, busy = false, refreshOnResume = false }) {
    const update = useAppUpdate({ enabled: true, reload, refreshOnResume, now: () => clock, releaseId: 'old' });
    return (
      <>
        {busy && <Blocker />}
        <AppUpdateBanner update={update} />
      </>
    );
  }
  function Blocker() { useBlockAppReload(true); return null; }

  const setVisibility = async (v, advanceMs = 0) => {
    clock += advanceMs;
    visibility = v;
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
  };

  it('возврат в приложение с новой версией — перезапуск', async () => {
    const reload = vi.fn();
    render(<Harness reload={reload} />);
    await setVisibility('hidden');
    await setVisibility('visible', 1000);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(RELOADED_FOR_KEY)).toBe('new');
  });

  it('на экране — плашка по таймеру, без перезапуска', async () => {
    const reload = vi.fn();
    render(<Harness reload={reload} />);
    await act(async () => { vi.advanceTimersByTime(CHECK_EVERY_MS); });
    expect(reload).not.toHaveBeenCalled();
    expect(screen.getByText('Вышло обновление Lemma')).toBeTruthy();
  });

  it('во время теста — ни перезапуска, ни плашки', async () => {
    const reload = vi.fn();
    render(<Harness reload={reload} busy />);
    await setVisibility('hidden');
    await setVisibility('visible', 1000);
    await act(async () => { vi.advanceTimersByTime(CHECK_EVERY_MS); });
    expect(reload).not.toHaveBeenCalled();
    expect(screen.queryByText('Вышло обновление Lemma')).toBeNull();
  });

  it('уже перезапускались под эту версию — второй раз нет, остаётся плашка', async () => {
    sessionStorage.setItem(RELOADED_FOR_KEY, 'new');
    const reload = vi.fn();
    render(<Harness reload={reload} />);
    await setVisibility('hidden');
    await setVisibility('visible', 1000);
    expect(reload).not.toHaveBeenCalled();
    expect(screen.getByText('Вышло обновление Lemma')).toBeTruthy();
  });

  it('главная после долгого отсутствия — перезапуск и без новой версии', async () => {
    remote = { releaseId: 'old' };
    const reload = vi.fn();
    render(<Harness reload={reload} refreshOnResume />);
    await setVisibility('hidden');
    await setVisibility('visible', 60 * 1000);
    expect(reload).not.toHaveBeenCalled();
    await setVisibility('hidden');
    await setVisibility('visible', STALE_AFTER_MS);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('нет связи — не перезапускаемся', async () => {
    remote = null;
    const reload = vi.fn();
    render(<Harness reload={reload} refreshOnResume />);
    await setVisibility('hidden');
    await setVisibility('visible', STALE_AFTER_MS * 2);
    expect(reload).not.toHaveBeenCalled();
  });
});

describe('installChunkRecovery: чанк не загрузился после деплоя', () => {
  it('перезапуск один раз, повтор в течение минуты — нет', () => {
    sessionStorage.clear();
    let t = 5_000_000;
    const reload = vi.fn();
    installChunkRecovery({ reload, now: () => t });
    const fire = () => {
      const e = new Event('vite:preloadError', { cancelable: true });
      window.dispatchEvent(e);
      return e.defaultPrevented;
    };
    expect(fire()).toBe(true);
    expect(fire()).toBe(false); // пусть сработает ErrorBoundary, а не петля
    t += 61_000;
    expect(fire()).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });
});

// ── Service worker: ничего не кэширует ───────────────────────────────────────
describe('public/sw.js', () => {
  const src = read('public/sw.js');

  function loadWorker() {
    const handlers = {};
    const self = {
      addEventListener: (type, fn) => { handlers[type] = fn; },
      skipWaiting: vi.fn(),
      registration: { navigationPreload: { enable: vi.fn(async () => {}) } },
      clients: { claim: vi.fn(async () => {}) },
    };
    const caches = { keys: vi.fn(async () => ['lemma-old', 'other']), delete: vi.fn(async () => true) };
    const fetchMock = vi.fn();
    // eslint-disable-next-line no-new-func
    new Function('self', 'caches', 'fetch', 'Response', src)(self, caches, fetchMock, Response);
    return { handlers, self, caches, fetchMock };
  }

  const fetchEvent = (mode, preloadResponse = Promise.resolve(undefined)) => {
    const e = { request: { mode, url: 'https://student.oipav.ru/x' }, preloadResponse, respondWith: vi.fn() };
    return e;
  };

  it('в коде нет Cache API для ответов — нечему устаревать', () => {
    expect(src).not.toMatch(/\.put\(|\.addAll\(|\.add\(|caches\.match|caches\.open/);
  });

  it('скрипты, картинки, API — не перехватываются', () => {
    const { handlers } = loadWorker();
    for (const mode of ['cors', 'no-cors', 'same-origin']) {
      const e = fetchEvent(mode);
      handlers.fetch(e);
      expect(e.respondWith).not.toHaveBeenCalled();
    }
  });

  it('страница — из сети; нет сети — «Нет подключения»', async () => {
    const { handlers, fetchMock } = loadWorker();
    const page = new Response('<html>свежая</html>');
    fetchMock.mockResolvedValueOnce(page);
    let e = fetchEvent('navigate');
    handlers.fetch(e);
    expect(await e.respondWith.mock.calls[0][0]).toBe(page);

    fetchMock.mockRejectedValueOnce(new TypeError('offline'));
    e = fetchEvent('navigate');
    handlers.fetch(e);
    const offline = await e.respondWith.mock.calls[0][0];
    expect(offline.status).toBe(503);
    expect(await offline.text()).toContain('Нет подключения');
  });

  it('предзагруженный ответ навигации используется', async () => {
    const { handlers, fetchMock } = loadWorker();
    const pre = new Response('pre');
    const e = fetchEvent('navigate', Promise.resolve(pre));
    handlers.fetch(e);
    expect(await e.respondWith.mock.calls[0][0]).toBe(pre);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('новая версия worker’а встаёт сразу и чистит наши старые кэши', async () => {
    const { handlers, self, caches } = loadWorker();
    handlers.install({});
    expect(self.skipWaiting).toHaveBeenCalled();
    let done;
    handlers.activate({ waitUntil: (p) => { done = p; } });
    await done;
    expect(caches.delete).toHaveBeenCalledWith('lemma-old');
    expect(caches.delete).not.toHaveBeenCalledWith('other');
    expect(self.clients.claim).toHaveBeenCalled();
  });
});

// ── Манифест, иконки, страница ───────────────────────────────────────────────
describe('манифест и иконки', () => {
  const manifest = JSON.parse(read('public/manifest.json'));
  const pngSize = (rel) => {
    const buf = fs.readFileSync(path.resolve(root, 'public', rel.replace(/^\//, '')));
    return `${buf.readUInt32BE(16)}x${buf.readUInt32BE(20)}`;
  };

  it('устанавливается как приложение', () => {
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url.startsWith(manifest.scope)).toBe(true);
    expect(manifest.short_name.length).toBeLessThanOrEqual(12);
  });

  it('иконки 192 и 512 на месте и нужного размера, есть маскируемая', () => {
    for (const icon of manifest.icons) expect(pngSize(icon.src)).toBe(icon.sizes);
    const sizes = manifest.icons.map((i) => i.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');
    expect(manifest.icons.some((i) => i.purpose === 'maskable')).toBe(true);
  });

  it('student.html: манифест, иконка iPhone 180, viewport-fit в обеих строках', () => {
    const html = read('student.html');
    expect(html).toContain('<link rel="manifest" href="/manifest.json"');
    const apple = html.match(/rel="apple-touch-icon" href="([^"]+)"/)[1];
    expect(pngSize(apple)).toBe('180x180');
    const viewports = html.match(/width=device-width[^'"]*/g);
    expect(viewports.length).toBe(2); // мета + подмена для iOS
    for (const v of viewports) expect(v).toContain('viewport-fit=cover');
  });
});

// raspberry/ в .gitignore — в чистом worktree скрипта нет, тогда не проверяем.
const DEPLOY = path.resolve(root, '../raspberry/deploy-student-to-vps.sh');
describe.skipIf(!fs.existsSync(DEPLOY))('деплой: порядок заливки', () => {
  const script = fs.existsSync(DEPLOY) ? fs.readFileSync(DEPLOY, 'utf8') : '';
  const rsyncs = script.split(/\n(?=rsync )/).filter((b) => b.startsWith('rsync '));

  it('student.html и version.json — последними, после чанков', () => {
    const htmlAt = rsyncs.findIndex((b) => b.includes('"$DIST/student.html"'));
    const assetsAt = rsyncs.findIndex((b) => b.includes('"$DIST/assets/"'));
    expect(assetsAt).toBeGreaterThanOrEqual(0);
    expect(htmlAt).toBe(rsyncs.length - 1);
    expect(rsyncs[htmlAt]).toContain('"$DIST/version.json"');
  });

  it('старые чанки не стираются сразу; PWA-файлы заливаются', () => {
    const assets = rsyncs.find((b) => b.includes('"$DIST/assets/"'));
    expect(assets).not.toContain('--delete');
    expect(script).toMatch(/assets -type f -mtime \+\d+ -delete/);
    for (const f of ['manifest.json', 'sw.js', 'pwa/']) expect(script).toContain(`"$DIST/${f}"`);
  });
});

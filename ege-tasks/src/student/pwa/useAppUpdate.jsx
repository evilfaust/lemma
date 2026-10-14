import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { RELEASE_ID } from '../../shared/version/buildInfo';
import {
  CHECK_EVERY_MS, isNewRelease, updateAction, alreadyReloadedFor, rememberReloadFor,
} from './appUpdate';
import './pwa.css';

/*
 * Обновление ученического приложения на телефоне (v3.9.369). Правила — в
 * `appUpdate.js`; здесь только события страницы и плашка.
 */

// ── Запрет перезапуска: тест, ввод пароля ─────────────────────────────────────
let blockers = 0;
const blockListeners = new Set();
const emitBlock = () => blockListeners.forEach((fn) => fn());
const subscribeBlock = (fn) => { blockListeners.add(fn); return () => blockListeners.delete(fn); };
const isBlocked = () => blockers > 0;
/** Сейчас перезапускать нельзя (тест, пароль) — его спрашивает и «потяни — обнови». */
export const isAppReloadBlocked = isBlocked;

/** Пока компонент на экране (и `active`), приложение само не перезапускается. */
export function useBlockAppReload(active = true) {
  useEffect(() => {
    if (!active) return undefined;
    blockers += 1;
    emitBlock();
    return () => { blockers -= 1; emitBlock(); };
  }, [active]);
}

async function fetchRelease() {
  try {
    const res = await fetch('/version.json', { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null; // нет связи
  }
}

const sessionStore = () => {
  try { return window.sessionStorage; } catch { return null; }
};

/**
 * @param {object} [o]
 * @param {boolean} [o.enabled] — по умолчанию только в продакшн-сборке
 * @param {boolean} [o.refreshOnResume] — перечитывать экран после долгого отсутствия (главная)
 * @returns {{ available: boolean, busy: boolean, reloadNow: () => void, dismiss: () => void }}
 */
export function useAppUpdate({
  enabled = import.meta.env.PROD,
  refreshOnResume = false,
  reload = () => window.location.reload(),
  now = () => Date.now(),
  releaseId = RELEASE_ID,
} = {}) {
  const busy = useSyncExternalStore(subscribeBlock, isBlocked, isBlocked);
  const [available, setAvailable] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const opts = useRef({});
  opts.current = { refreshOnResume, reload, now, releaseId };

  useEffect(() => {
    if (!enabled) return undefined;
    let hiddenAt = document.visibilityState === 'hidden' ? opts.current.now() : null;
    let checking = false;

    const check = async ({ resumed = false, hiddenMs = 0 } = {}) => {
      if (checking) return;
      checking = true;
      try {
        const remote = await fetchRelease();
        const { refreshOnResume: refresh, reload: doReload, releaseId: current } = opts.current;
        const fresh = isNewRelease(remote, current);
        if (fresh) setAvailable(true);
        const action = updateAction({
          newRelease: fresh && !alreadyReloadedFor(remote, sessionStore()),
          online: !!remote,
          busy: isBlocked(),
          resumed,
          hiddenMs,
          refreshOnResume: refresh,
        });
        if (action === 'reload') {
          if (fresh) rememberReloadFor(remote, sessionStore());
          doReload();
        }
      } finally {
        checking = false;
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = opts.current.now();
        return;
      }
      const hiddenMs = hiddenAt == null ? 0 : opts.current.now() - hiddenAt;
      hiddenAt = null;
      setDismissed(false);
      check({ resumed: true, hiddenMs });
    };
    // Страница поднялась из кэша «назад/вперёд» — тоже возвращение.
    const onPageShow = (e) => { if (e.persisted) check({ resumed: true }); };
    const onOnline = () => check();

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('online', onOnline);
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') check();
    }, CHECK_EVERY_MS);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('online', onOnline);
      clearInterval(timer);
    };
  }, [enabled]);

  return {
    available: available && !dismissed,
    busy,
    reloadNow: () => opts.current.reload(),
    dismiss: () => setDismissed(true),
  };
}

/** Плашка «Вышло обновление». Во время теста не показывается. */
export function AppUpdateBanner({ update }) {
  if (!update.available || update.busy) return null;
  return (
    <div className="pwa-update" role="status">
      <span className="pwa-update-text">Вышло обновление Lemma</span>
      <button type="button" className="pwa-update-btn" onClick={update.reloadNow}>Обновить</button>
      <button type="button" className="pwa-update-close" onClick={update.dismiss} aria-label="Позже">×</button>
    </div>
  );
}

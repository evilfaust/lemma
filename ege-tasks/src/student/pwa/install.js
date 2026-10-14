/**
 * Установка ученического приложения на телефон (PWA, v3.9.369).
 *
 * Android (Chrome, Edge…) присылает событие `beforeinstallprompt` — его надо
 * поймать как можно раньше (модуль импортируется в `student/main.jsx` до
 * React) и придержать: системный диалог показывается по кнопке. На iPhone
 * диалога нет вовсе — только инструкция «Поделиться → На экран „Домой“».
 */

let deferredPrompt = null;
let installed = false;
const listeners = new Set();
const notify = () => listeners.forEach((fn) => fn());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // без этого Chrome покажет свою мини-плашку сам
    deferredPrompt = e;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    installed = true;
    notify();
  });
}

export function subscribeInstall(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const hasInstallPrompt = () => !!deferredPrompt;
export const wasJustInstalled = () => installed;

/** Показать системный диалог установки. → 'accepted' | 'dismissed' | null */
export async function promptInstall() {
  const e = deferredPrompt;
  if (!e) return null;
  deferredPrompt = null; // событие одноразовое
  notify();
  e.prompt();
  const choice = await e.userChoice.catch(() => null);
  return choice?.outcome || null;
}

/** Приложение уже открыто как установленное (без адресной строки). */
export function isStandalone(win = typeof window !== 'undefined' ? window : undefined) {
  if (!win) return false;
  try {
    if (win.matchMedia?.('(display-mode: standalone)').matches) return true;
  } catch { /* старый браузер */ }
  return win.navigator?.standalone === true;
}

/**
 * Какой способ установки предложить.
 * @returns {'prompt'|'ios'|'android'|null} — `prompt`: системный диалог Android;
 *   `ios`/`android`: инструкция; null — не предлагать (компьютер, уже установлено).
 */
export function installPlatform({ ua = '', platform = '', maxTouchPoints = 0, standalone = false, hasPrompt = false } = {}) {
  if (standalone) return null;
  const ios = /iPad|iPhone|iPod/.test(ua) || (platform === 'MacIntel' && maxTouchPoints > 1);
  if (ios) return 'ios';
  if (/Android/i.test(ua)) return hasPrompt ? 'prompt' : 'android';
  return null;
}

/** Ссылка открыта во встроенном браузере Telegram/VK/Instagram — оттуда не установить. */
export function isInAppBrowser(ua = '') {
  return /Telegram|VKClient|Instagram|FBAN|FBAV/i.test(ua);
}

export function currentInstallPlatform() {
  if (typeof window === 'undefined') return null;
  const nav = window.navigator || {};
  return installPlatform({
    ua: nav.userAgent || '',
    platform: nav.platform || '',
    maxTouchPoints: nav.maxTouchPoints || 0,
    standalone: isStandalone(window) || installed,
    hasPrompt: !!deferredPrompt,
  });
}

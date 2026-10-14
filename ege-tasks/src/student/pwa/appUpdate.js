/**
 * Обновление установленного ученического приложения (PWA, v3.9.369) — чистая
 * логика, без React и сети.
 *
 * Как устроено. Service worker ничего не кэширует (см. `public/sw.js`), HTML
 * всегда приходит с сервера, поэтому ЛЮБОЙ перезапуск страницы даёт свежую
 * версию. Остаётся одна беда установленного приложения: его не перезапускают
 * неделями — телефон держит открытую страницу в памяти. Поэтому страница сама
 * спрашивает `/version.json` (его пишет `scripts/write-version-json.mjs`) и
 * перезапускается в момент, когда это никому не мешает:
 *  • вернулись в приложение (оно было свёрнуто) — перезапуск сразу, человек
 *    только что открыл его и ещё ничего не начал;
 *  • приложение на экране — только плашка «Обновить», под пальцем не дёргаем;
 *  • идёт тест или ввод пароля (`useBlockAppReload`) — молчим совсем.
 * Плюс главная, свёрнутая дольше `STALE_AFTER_MS`, перезапускается и без новой
 * версии: на телефоне нет кнопки «обновить», а ДЗ и уроки за это время могли
 * поменяться.
 */

/** Как часто спрашивать версию, пока приложение на экране. */
export const CHECK_EVERY_MS = 5 * 60 * 1000;

/** Главная, свёрнутая дольше этого, при возврате перечитывается. */
export const STALE_AFTER_MS = 30 * 60 * 1000;

/** Ключ sessionStorage: под какую версию уже перезапускались (защита от петли). */
export const RELOADED_FOR_KEY = 'lemma.pwa.reloadedFor';

/** На сервере лежит другая сборка, чем та, что работает сейчас. */
export function isNewRelease(remote, currentReleaseId) {
  const id = remote?.releaseId;
  return typeof id === 'string' && id !== '' && id !== currentReleaseId;
}

/**
 * Что делать после проверки.
 * @param {object} p
 * @param {boolean} p.newRelease — на сервере свежая версия (и под неё ещё не перезапускались)
 * @param {boolean} p.online — `/version.json` ответил (иначе перезапуск покажет «нет связи»)
 * @param {boolean} p.busy — идёт тест / ввод, перезапускать нельзя
 * @param {boolean} p.resumed — приложение только что вернулось на экран
 * @param {number} p.hiddenMs — сколько оно было свёрнуто
 * @param {boolean} p.refreshOnResume — экран, который при долгом отсутствии перечитывается (главная)
 * @returns {'reload'|'banner'|'none'}
 */
export function updateAction({ newRelease, online, busy, resumed, hiddenMs = 0, refreshOnResume = false }) {
  if (!online || busy) return 'none';
  if (resumed && (newRelease || (refreshOnResume && hiddenMs >= STALE_AFTER_MS))) return 'reload';
  return newRelease ? 'banner' : 'none';
}

/**
 * Уже перезапускались под эту версию, а сборка всё равно старая (например,
 * деплой ещё идёт) — второй раз не перезапускаем, иначе петля. Плашка остаётся.
 */
export function alreadyReloadedFor(remote, storage) {
  try {
    return !!remote?.releaseId && storage?.getItem(RELOADED_FOR_KEY) === remote.releaseId;
  } catch {
    return false;
  }
}

export function rememberReloadFor(remote, storage) {
  try {
    if (remote?.releaseId) storage?.setItem(RELOADED_FOR_KEY, remote.releaseId);
  } catch { /* приватный режим */ }
}

/** Главная кабинета: `/`, `/student`, `/student/` (без кода теста и особых ссылок). */
export function isCabinetPath(pathname = '') {
  return /^\/(student\/?)?$/.test(pathname);
}

/*
 * «Потяни вниз — обновить» (v3.9.373): чистые правила жеста. Обработчики
 * касаний — в `PullToRefresh.jsx`.
 *
 * В установленном приложении (standalone) у телефона своего жеста нет — ни у
 * iPhone, ни у Android. В обычном браузере он есть, и там мы молчим, чтобы не
 * было двух обновлений сразу.
 */

/** Дальше индикатор не уезжает, сколько ни тяни (px). */
export const PULL_MAX = 110;
/** Индикатор уехал на столько — отпускай, обновим (≈ 85 px пальцем). */
export const PULL_READY = 64;
/** Сдвиг пальца, после которого касание считается жестом, а не тапом. */
export const PULL_SLOP = 8;

/**
 * Палец → сдвиг индикатора: сначала почти один к одному, потом всё туже
 * (как у системного жеста), не дальше `PULL_MAX`.
 */
export function pullOffset(dy) {
  if (!(dy > 0)) return 0;
  return Math.min(PULL_MAX, PULL_MAX * 1.5 * (1 - Math.exp(-dy / (PULL_MAX * 1.6))));
}

/** Отпустили на этом сдвиге — обновлять ли. */
export const pullReady = (offset) => offset >= PULL_READY;

/** Доля «готовности» 0…1 — для поворота стрелки. */
export const pullProgress = (offset) => Math.max(0, Math.min(1, offset / PULL_READY));

/**
 * Где жест не начинаем: свои жесты у холстов чертежей (крутить, тянуть
 * точку), поля ввода, окна и выпадашки поверх страницы. Страница с такой
 * зоной может пометить её `data-no-pull`.
 */
export const NO_PULL_SELECTOR = [
  '[data-no-pull]', 'canvas', '.ssb__stage', '.stereo-canvas', '.planim-canvas',
  'input', 'textarea', 'select', '[contenteditable="true"]',
  '.ant-modal-wrap', '.ant-drawer', '.ant-select-dropdown', '.ant-dropdown', '.ant-picker-dropdown',
].join(', ');

/**
 * Можно ли начать жест с этого касания: страница в самом верху, касание не в
 * запретной зоне и не внутри прокрученного блока (иначе свайп вниз — это
 * прокрутка блока к его началу, а не обновление).
 */
export function canStartPull(target, { scrollTop = 0 } = {}) {
  if (scrollTop > 0) return false;
  if (!target || typeof target.closest !== 'function') return true;
  if (target.closest(NO_PULL_SELECTOR)) return false;
  for (let el = target; el && el.nodeType === 1; el = el.parentElement) {
    if (el.scrollTop > 0) return false;
  }
  return true;
}

/**
 * Цвет группы — единый «язык» идентичности класса во всех экранах раздела
 * (Календарь, Сегодня, Журнал, КТП, Заметки, Дела, Библиотека).
 *
 * Две ступени:
 *  1. Явный выбор учителя — `teaching_groups.color` (миграция 1785000000).
 *     Он попадает сюда через registerGroupColors() из API-слоя, поэтому
 *     экранам менять ничего не нужно: groupHex(id) уже знает про выбор.
 *  2. Цвет не выбран → детерминированный хеш ключа (как было до v3.9.203):
 *     один и тот же id всегда даёт один и тот же оттенок.
 *
 * Реестр переживает перезагрузку (localStorage): экран может нарисовать чипы
 * группы раньше, чем догрузится её запись, — цвет не должен прыгать.
 */

// HEX-значения оттенков (дублируют CSS-переменные --c-* из theme/tokens.css) —
// для мест, где нужен инлайн-цвет (react-big-calendar, бордюры событий и т.п.).
export const TONE_HEX = {
  blue:    { base: '#2B4BFF', soft: '#E7ECFF', ink: '#1A34D1' },
  indigo:  { base: '#4F46E5', soft: '#E0E7FF', ink: '#4338CA' },
  violet:  { base: '#7C3AED', soft: '#EDE9FE', ink: '#6D28D9' },
  fuchsia: { base: '#C026D3', soft: '#FAE8FF', ink: '#A21CAF' },
  pink:    { base: '#DB2777', soft: '#FCE7F3', ink: '#BE185D' },
  rose:    { base: '#E11D48', soft: '#FFE4E6', ink: '#BE123C' },
  orange:  { base: '#EA580C', soft: '#FFEDD5', ink: '#C2410C' },
  amber:   { base: '#D97706', soft: '#FEF3C7', ink: '#B45309' },
  lime:    { base: '#65A30D', soft: '#ECFCCB', ink: '#4D7C0F' },
  green:   { base: '#16A34A', soft: '#DCFCE7', ink: '#15803D' },
  teal:    { base: '#0D9488', soft: '#D1FAE5', ink: '#0B7A70' },
  cyan:    { base: '#0891B2', soft: '#CFFAFE', ink: '#0E7490' },
  slate:   { base: '#475569', soft: '#E2E8F0', ink: '#334155' },
  neutral: { base: '#646A76', soft: '#F3F4F6', ink: '#2A2F3A' },
};

// Палитра выбора = она же пул автоцвета. Порядок — по кругу цветов, чтобы
// соседние свотчи в палитре читались как переход, а не как случайный набор.
export const GROUP_COLORS = [
  'blue', 'indigo', 'violet', 'fuchsia', 'pink', 'rose', 'orange',
  'amber', 'lime', 'green', 'teal', 'cyan', 'slate',
];

// Старое имя пула — его импортируют экраны и барель ui/.
export const GROUP_TONES = GROUP_COLORS;

export const GROUP_COLOR_LABELS = {
  blue: 'Синий',
  indigo: 'Индиго',
  violet: 'Фиолетовый',
  fuchsia: 'Пурпурный',
  pink: 'Розовый',
  rose: 'Малиновый',
  orange: 'Оранжевый',
  amber: 'Янтарный',
  lime: 'Лаймовый',
  green: 'Зелёный',
  teal: 'Бирюзовый',
  cyan: 'Голубой',
  slate: 'Графитовый',
};

/** Допустимое значение `teaching_groups.color`. */
export function isGroupColor(value) {
  return typeof value === 'string' && GROUP_COLORS.includes(value);
}

/** Стабильный хеш строки (FNV-подобный) → оттенок палитры. */
export function autoGroupTone(key) {
  const s = String(key ?? '');
  if (!s) return 'blue';
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return GROUP_COLORS[(h >>> 0) % GROUP_COLORS.length];
}

/* ── Реестр явных цветов ──────────────────────────────────────────────────── */

const STORAGE_KEY = 'lemma_group_colors_v1';

function readStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const obj = raw ? JSON.parse(raw) : null;
    if (!obj || typeof obj !== 'object') return [];
    return Object.entries(obj).filter(([id, tone]) => id && isGroupColor(tone));
  } catch {
    return [];
  }
}

const explicit = new Map(readStored());

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(explicit)));
  } catch { /* приватный режим / переполнение — цвета просто не переживут перезагрузку */ }
}

/**
 * Запомнить выбранные цвета групп. Вызывается из API-слоя на каждой загрузке
 * групп (и их expand'ов в уроках), поэтому экранам достаточно groupHex(id).
 * Снятый цвет («авто») удаляется из реестра — группа возвращается к хешу.
 */
export function registerGroupColors(groups = []) {
  let changed = false;
  for (const g of groups) {
    const id = g?.id;
    if (!id) continue;
    const color = isGroupColor(g.color) ? g.color : '';
    const prev = explicit.get(id);
    if (color && prev !== color) { explicit.set(id, color); changed = true; }
    else if (!color && prev) { explicit.delete(id); changed = true; }
  }
  if (changed) persist();
  return changed;
}

/** Только для тестов/логаута: забыть запомненные цвета. */
export function clearGroupColors() {
  explicit.clear();
  persist();
}

/**
 * Оттенок сущности. Принимает id/имя (как раньше) либо саму запись группы —
 * тогда её `color` учитывается даже до регистрации в реестре.
 */
export function groupTone(keyOrGroup) {
  if (keyOrGroup && typeof keyOrGroup === 'object') {
    const g = keyOrGroup;
    if (isGroupColor(g.color)) return g.color;
    return groupTone(g.id || g.name || '');
  }
  const key = String(keyOrGroup ?? '');
  return explicit.get(key) || autoGroupTone(key);
}

/** HEX-набор {base, soft, ink} по id/имени/записи группы. */
export function groupHex(keyOrGroup) {
  return TONE_HEX[groupTone(keyOrGroup)] || TONE_HEX.neutral;
}

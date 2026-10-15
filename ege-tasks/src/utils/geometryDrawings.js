// Что видит ученик к задачам открытой геометрической работы (v3.9.377):
// уровень показа чертежа — для всей работы (умолчание) и для отдельной задачи.
//
//   geometry_works.drawings = { default: уровень, tasks: { [taskId]: уровень } }
//
// Уровень задачи — выбранный, но не выше возможного для её чертежа: у
// GeoGebra/PNG и SVG без исходника — только картинка, без чертежа — только
// условие. Ученику работу отдаёт хук pocketbase/pb_hooks/geometry_work.pb.js —
// скрытый чертёж до страницы не доходит.
//
// 🚨 КОПИЯ правил pocketbase/pb_hooks/geometry_work_lib.js (normalizeDrawings,
// drawingKind, maxLevel, taskLevel) — тест geometryDrawings.test.js сверяет их.

export const LEVELS = ['none', 'image', 'live', 'steps'];
export const DEFAULT_LEVEL = 'live';

export const LEVEL_LABELS = {
  none: 'Только условие',
  image: 'Чертёж-картинка',
  live: 'Интерактивный чертёж',
  steps: 'Чертёж + шаги построения',
};

export const LEVEL_HINTS = {
  none: 'Чертёж ученик делает сам в тетради',
  image: 'Готовый чертёж картинкой',
  live: 'Объёмный крутится, плоский можно сдвигать и увеличивать',
  steps: 'Построение листается по шагам с самого начала — только чертёж, без решения',
};

export const KIND_LABELS = {
  stereo: 'стереочертёж',
  planim: 'планиметрия',
  svg: 'SVG без исходника',
  image: 'картинка (GeoGebra/PNG)',
};

const isLevel = (v) => LEVELS.includes(v);

/** Настройка работы в каноне: { default, tasks }. */
export function normalizeDrawings(raw) {
  let src = raw;
  if (typeof src === 'string') {
    try { src = JSON.parse(src); } catch { src = null; }
  }
  const out = { default: DEFAULT_LEVEL, tasks: {} };
  if (!src || typeof src !== 'object') return out;
  if (isLevel(src.default)) out.default = src.default;
  if (src.tasks && typeof src.tasks === 'object') {
    for (const id of Object.keys(src.tasks)) {
      if (isLevel(src.tasks[id])) out.tasks[id] = src.tasks[id];
    }
  }
  return out;
}

/** Какой чертёж у задачи: stereo | planim | svg | image | null. */
export function drawingKind(task) {
  if (!task) return null;
  const svg = String(task.drawing_svg || '');
  if (task.drawing_view === 'svg' && svg) {
    if (svg.includes('<!--stereo:')) return 'stereo';
    if (svg.includes('<!--planim:')) return 'planim';
    return 'svg';
  }
  // Картинка с ролью «решение» — чертёж решения, ученику не показываем никогда.
  if (task.image_role === 'solution') return null;
  if (task.geogebra_image_base64 || task.drawing_image) return 'image';
  return null;
}

/** Самый подробный уровень, доступный чертежу этого вида. */
export function maxLevel(kind) {
  if (kind === 'stereo' || kind === 'planim') return 'steps';
  if (kind === 'svg' || kind === 'image') return 'image';
  return 'none';
}

/** Уровень, который выбрал учитель (оверрайд задачи или умолчание). */
export function chosenLevel(drawings, taskId) {
  const d = normalizeDrawings(drawings);
  return d.tasks[taskId] || d.default;
}

/** Уровень показа задачи с учётом её чертежа. */
export function taskLevel(drawings, taskId, kind) {
  const want = LEVELS.indexOf(chosenLevel(drawings, taskId));
  const can = LEVELS.indexOf(maxLevel(kind));
  return LEVELS[Math.min(want, can)];
}

/** Новое умолчание работы; оверрайды, совпавшие с ним, снимаются. */
export function setDefaultLevel(drawings, level) {
  const d = normalizeDrawings(drawings);
  if (!isLevel(level)) return d;
  const tasks = {};
  for (const [id, lv] of Object.entries(d.tasks)) if (lv !== level) tasks[id] = lv;
  return { default: level, tasks };
}

/**
 * Уровень для позиции работы — всем её задачам во всех вариантах.
 * level = null — «как у работы» (оверрайды снимаются).
 */
export function setTasksLevel(drawings, taskIds, level) {
  const d = normalizeDrawings(drawings);
  const tasks = { ...d.tasks };
  for (const id of taskIds || []) {
    if (!id) continue;
    if (level == null || !isLevel(level) || level === d.default) delete tasks[id];
    else tasks[id] = level;
  }
  return { default: d.default, tasks };
}

/**
 * Что выбрано у позиции: уровень, общий для её задач, null — у всех «как у
 * работы», 'mixed' — у задач позиции разное.
 */
export function rowChoice(drawings, taskIds) {
  const d = normalizeDrawings(drawings);
  const vals = new Set((taskIds || []).filter(Boolean).map((id) => d.tasks[id] || null));
  if (vals.size === 0) return null;
  if (vals.size > 1) return 'mixed';
  return [...vals][0];
}

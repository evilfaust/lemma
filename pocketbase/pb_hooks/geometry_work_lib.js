// Чистая логика выдачи геометрической работы ученику (v3.9.377) — без $app,
// чтобы её можно было проверить юнит-тестом (geometryDrawings.test.js).
// Подключается из geometry_work.pb.js через require внутри обработчика.
//
// Что видит ученик к задаче — уровень показа чертежа:
//   none  — только условие (чертёж ученик делает сам в тетради);
//   image — чертёж картинкой (исходник-журнал из SVG вырезается);
//   live  — интерактивный: стереочертёж крутится, планиметрию можно сдвигать;
//   steps — чертёж + шаги построения (листать с начала).
// Уровень задачи = выбранный (оверрайд задачи или умолчание работы), но не
// выше возможного для её чертежа: у GeoGebra/PNG и SVG без исходника — только
// картинка, без чертежа — только условие.
//
// 🚨 КОПИЯ: те же правила — в ege-tasks/src/utils/geometryDrawings.js
// (учительский экран), тест сверяет их на всех сочетаниях.

const LEVELS = ['none', 'image', 'live', 'steps'];
const DEFAULT_LEVEL = 'live'; // как было до настройки: стерео крутится, остальное картинкой

const SOURCE_RE = /<!--(stereo|planim):[A-Za-z0-9+/=]+-->/g;

function isLevel(v) {
  return LEVELS.indexOf(v) >= 0;
}

/** Настройка работы { default, tasks: { [taskId]: уровень } } в каноне. */
function normalizeDrawings(raw) {
  let src = raw;
  if (typeof src === 'string') {
    try { src = JSON.parse(src); } catch (e) { src = null; }
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
function drawingKind(task) {
  if (!task) return null;
  const svg = String(task.drawing_svg || '');
  if (task.drawing_view === 'svg' && svg) {
    if (svg.indexOf('<!--stereo:') >= 0) return 'stereo';
    if (svg.indexOf('<!--planim:') >= 0) return 'planim';
    return 'svg';
  }
  // Картинка с ролью «решение» — чертёж решения, ученику не показываем никогда.
  if (task.image_role === 'solution') return null;
  if (task.geogebra_image_base64 || task.drawing_image) return 'image';
  return null;
}

/** Самый подробный уровень, доступный чертежу этого вида. */
function maxLevel(kind) {
  if (kind === 'stereo' || kind === 'planim') return 'steps';
  if (kind === 'svg' || kind === 'image') return 'image';
  return 'none';
}

/** Уровень, который выбрал учитель (оверрайд задачи или умолчание). */
function chosenLevel(drawings, taskId) {
  const d = normalizeDrawings(drawings);
  return d.tasks[taskId] || d.default;
}

/** Уровень показа задачи с учётом её чертежа. */
function taskLevel(drawings, taskId, kind) {
  const want = LEVELS.indexOf(chosenLevel(drawings, taskId));
  const can = LEVELS.indexOf(maxLevel(kind));
  return LEVELS[Math.min(want, can)];
}

/** SVG без исходника-журнала: картинка остаётся, построить по ней шаги нельзя. */
function stripSource(svg) {
  return String(svg || '').replace(SOURCE_RE, '');
}

/**
 * Задача для ученика: ответ, решение, указания не отдаются вовсе; чертёж —
 * только если его разрешает уровень.
 */
function projectTask(task, drawings) {
  const kind = drawingKind(task);
  const level = taskLevel(drawings, task.id, kind);
  const out = {
    id: task.id,
    code: task.code || '',
    statement_md: task.statement_md || '',
    level: level,
    kind: level === 'none' ? null : kind,
    has_drawing: !!kind,
  };
  if (level === 'none') return out;
  if (kind === 'image') {
    if (task.geogebra_image_base64) out.geogebra_image_base64 = task.geogebra_image_base64;
    if (task.drawing_image) out.drawing_image = task.drawing_image;
  } else {
    out.drawing_view = 'svg';
    out.drawing_svg = level === 'image' ? stripSource(task.drawing_svg) : task.drawing_svg;
  }
  return out;
}

/** Варианты работы: [[taskId|null, …], …] — пустая ячейка номер не сдвигает. */
function variantsOf(structure) {
  let src = structure;
  if (typeof src === 'string') {
    try { src = JSON.parse(src); } catch (e) { src = null; }
  }
  const list = src && Array.isArray(src.variants) && src.variants.length ? src.variants : [{ items: [] }];
  return list.map((v) => (Array.isArray(v && v.items) ? v.items : [])
    .map((it) => (it && typeof it === 'object' && it.task ? String(it.task) : null)));
}

module.exports = {
  LEVELS, DEFAULT_LEVEL, normalizeDrawings, drawingKind, maxLevel, chosenLevel, taskLevel,
  stripSource, projectTask, variantsOf,
};

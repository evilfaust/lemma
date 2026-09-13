// Поле «в клетку» для рукописного решения — тетрадная клетка прямо в условии
// задачи и, главное, В ЯЧЕЙКЕ markdown-таблицы («условие | место для решения»).
//
// Модуль-близнец numberLine.js и coordPlot.js: обслуживает ОБА конвейера
// рендеринга проекта (MathRenderer для задач, useMarkdownProcessor для теории),
// поэтому SVG собирает одна функция gridPaperSvg(model) — картинка одинаковая.
//
// Почему SVG, а не CSS-фон и не абсолютные div-линии (как в печатных вёрстках
// PrintFill / print-sheet/SolutionFill):
//   • repeating-linear-gradient — это ФОН: Chrome не печатает фоны без
//     print-color-adjust:exact, а условие задачи рендерится в полутора десятках
//     печатных вёрсток, и далеко не в каждой это свойство задано;
//   • абсолютные div-линии требуют position:relative на родителе — на <td> это
//     ломает table-layout:fixed при печати, а нарисованные «с запасом» линии
//     раздувают печатную область (лист съезжал до ~65%, см. PrintFill.jsx).
//   SVG клипает содержимое своим вьюпортом, печатается вектором и проходит
//   DOMPurify: ни <defs>, ни <pattern>, ни url(#…) — только <line> и <rect>.
//
// Размеры — в МИЛЛИМЕТРАХ: клетка должна быть настоящей тетрадной (5 мм), а не
// «примерно такой» в пикселях. Отсюда два режима вёрстки:
//   • фиксированный (число клеток по ширине задано) — viewBox, 1 ед. = 1 мм;
//   • тянущийся (ширина не задана) — width="100%", координаты с суффиксом mm,
//     вертикали рисуются с запасом и обрезаются правым краем SVG. Так поле
//     занимает ячейку таблицы целиком, а клетка остаётся квадратной 5 мм.
//
// API:
//   parseGridPaper(spec)          → model  (он же — состояние конструктора)
//   gridPaperSvg(model)           → '<svg>…</svg>'
//   gridPaperSvgFromSpec(spec)    → '<svg>…</svg>'
//   gridToSpec(model)             → текст DSL (обратная parseGridPaper)
//
// DSL (одна строка; «;» и перевод строки — равноправные разделители):
//   10x6            — 10 клеток в ширину, 6 в высоту
//   x6  |  6        — 6 клеток в высоту, ширина по месту (на всю ширину ячейки)
//   10x6 cell 7     — шаг клетки 7 мм (первоклашкам и «крупной» клетке)
//   x8 lines        — в линейку (только горизонтальные линии, шаг 8 мм)
//   x4 blank        — пустое поле в рамке (совсем чистое место)
//   x6 noframe      — без контурной рамки

/** Значения по умолчанию — они же стартовое состояние конструктора. */
export const GRID_DEFAULTS = { cols: null, rows: 6, stepMm: 5, kind: 'grid', frame: true };

/** Шаг разлиновки по умолчанию: клетка 5 мм, линейка 8 мм (как в PrintFill). */
const DEFAULT_STEP = { grid: 5, blank: 5, lines: 8 };

const LIMITS = { cols: [1, 60], rows: [1, 60], step: [3, 20] };

// Запас вертикалей в тянущемся поле: 60 клеток по 5 мм = 300 мм, шире любого
// печатного поля A4. Лишние обрезает вьюпорт SVG (браузерный overflow:hidden),
// печатную область они не раздувают — в отличие от абсолютных div-линий.
const FIT_MAX_LINES = 60;
// Минимальная ширина тянущегося поля: без неё колонка таблицы с auto-раскладкой
// схлопывается под width:100% (min-content такого SVG = 0).
const FIT_MIN_CELLS = 8;

const COLORS = { line: '#c7cdd6', frame: '#9aa3ae' };
// Толщина в мм. Рамка рисуется двойной шириной: половина уходит за вьюпорт
// (линия стоит ровно по краю), видимая часть равна FRAME_W / 2.
const LINE_W = 0.15;
const FRAME_W = 0.5;

const clamp = (n, [lo, hi]) => Math.min(hi, Math.max(lo, n));
const r2 = (n) => Math.round(n * 100) / 100;

const KIND_WORDS = {
  grid: 'grid', клетка: 'grid', вклетку: 'grid', клетки: 'grid',
  lines: 'lines', линейка: 'lines', влинейку: 'lines', линии: 'lines',
  blank: 'blank', пусто: 'blank', чисто: 'blank', пустое: 'blank',
};

/**
 * Разбор DSL. Всё необязательно: пустая строка → поле 6 клеток в высоту
 * на всю ширину. Неизвестные слова игнорируются молча — поле для записи
 * решения не должно исчезать из-за опечатки в условии задачи.
 */
export function parseGridPaper(spec) {
  const model = { ...GRID_DEFAULTS };
  let stepSet = false;

  const text = String(spec ?? '')
    .replace(/[хХ×✕]/g, 'x')          // русская «х» и знак умножения → латинская x
    .replace(/[−–—]/g, '-')
    .replace(/[;\n]/g, ' ')
    .toLowerCase();

  const tokens = text.split(/\s+/).filter(Boolean);

  for (let i = 0; i < tokens.length; i += 1) {
    const t = tokens[i];

    // «10x6» / «x6» / «10x» — размер в клетках
    const size = /^(\d+)?x(\d+)?$/.exec(t);
    if (size && (size[1] || size[2])) {
      if (size[1]) model.cols = clamp(Number(size[1]), LIMITS.cols);
      if (size[2]) model.rows = clamp(Number(size[2]), LIMITS.rows);
      continue;
    }

    // «cell 7» / «клетка 7» / «шаг 7» — размер клетки в миллиметрах
    if (/^(cell|клетка|шаг|step)$/.test(t) && tokens[i + 1] != null) {
      const mm = Number(String(tokens[i + 1]).replace(',', '.'));
      if (Number.isFinite(mm)) { model.stepMm = clamp(mm, LIMITS.step); stepSet = true; i += 1; }
      continue;
    }

    if (/^(noframe|безрамки)$/.test(t)) { model.frame = false; continue; }
    if (/^(frame|рамка)$/.test(t)) { model.frame = true; continue; }
    // «без рамки» / «в клетку» — два слова
    if (/^(без|в)$/.test(t) && tokens[i + 1] != null) {
      const pair = t + tokens[i + 1];
      if (pair === 'безрамки') { model.frame = false; i += 1; continue; }
      if (KIND_WORDS[pair]) { model.kind = KIND_WORDS[pair]; i += 1; continue; }
    }
    if (KIND_WORDS[t]) { model.kind = KIND_WORDS[t]; continue; }

    // Одиночное число — высота в клетках («grid: 8»).
    if (/^\d+$/.test(t)) { model.rows = clamp(Number(t), LIMITS.rows); continue; }
  }

  if (!stepSet) model.stepMm = DEFAULT_STEP[model.kind];
  return model;
}

/**
 * Сборка SVG. Общая для обоих конвейеров: в задачах вставляется через
 * <GridPaperSVG>, в теории — строкой в postprocess.
 */
export function gridPaperSvg(model = {}) {
  const m = { ...GRID_DEFAULTS, ...model };
  const step = clamp(Number(m.stepMm) || DEFAULT_STEP[m.kind] || 5, LIMITS.step);
  const rows = clamp(Math.round(Number(m.rows) || GRID_DEFAULTS.rows), LIMITS.rows);
  const cols = m.cols ? clamp(Math.round(Number(m.cols)), LIMITS.cols) : null;
  const fit = !cols;
  const heightMm = r2(rows * step);
  const widthMm = fit ? null : r2(cols * step);

  // В тянущемся режиме viewBox не годится (он бы масштабировал клетку вместе с
  // шириной контейнера) — координаты пишем прямо в миллиметрах, поперечную
  // сторону тянем процентами.
  const mm = (v) => (fit ? `${r2(v)}mm` : r2(v));
  const fullW = fit ? '100%' : r2(widthMm);
  const strokeW = fit ? `${LINE_W}mm` : LINE_W;
  const frameW = fit ? `${FRAME_W}mm` : FRAME_W;

  const parts = [];
  const hline = (y) => `<line x1="0" y1="${mm(y)}" x2="${fullW}" y2="${mm(y)}" stroke="${COLORS.line}" stroke-width="${strokeW}"/>`;
  const vline = (x) => `<line x1="${mm(x)}" y1="0" x2="${mm(x)}" y2="${mm(heightMm)}" stroke="${COLORS.line}" stroke-width="${strokeW}"/>`;

  if (m.kind !== 'blank') {
    // Крайние линии рисуем, только если рамки нет: иначе они под ней.
    const first = m.frame ? 1 : 0;
    const last = m.frame ? rows - 1 : rows;
    for (let i = first; i <= last; i += 1) parts.push(hline(i * step));
  }

  if (m.kind === 'grid') {
    const nV = fit ? FIT_MAX_LINES : (m.frame ? cols - 1 : cols);
    for (let i = m.frame ? 1 : 0; i <= nV; i += 1) parts.push(vline(i * step));
  }

  if (m.frame) {
    // width/height = 100% вместе с двойной толщиной штриха: половина линии
    // уходит за вьюпорт, видимая рамка получается ровно FRAME_W / 2 со всех
    // четырёх сторон (в SVG нельзя вычесть толщину из процентов).
    parts.push(
      `<rect x="0" y="0" width="${fullW}" height="${fit ? '100%' : r2(heightMm)}" fill="none" stroke="${COLORS.frame}" stroke-width="${frameW}"/>`,
    );
  }

  const sizeAttrs = fit
    ? `width="100%" height="${heightMm}mm"`
    : `width="${widthMm}mm" height="${heightMm}mm" viewBox="0 0 ${widthMm} ${heightMm}"`;
  // Размеры дублируются в inline-style, а не только в атрибутах: печатные
  // вёрстки и таблица-галерея объявляют `svg { width:100%; height:auto }`, и
  // презентационный атрибут height такому правилу проигрывает — поле схлопнулось
  // бы по высоте. Inline-style сильнее внешнего CSS.
  const style = fit
    ? `width:100%;min-width:${r2(FIT_MIN_CELLS * step)}mm;height:${heightMm}mm;display:block`
    : `width:${widthMm}mm;max-width:100%;height:${heightMm}mm;display:block`;
  const label = m.kind === 'lines' ? 'поле в линейку' : (m.kind === 'blank' ? 'поле для записи' : 'поле в клетку');

  return `<svg xmlns="http://www.w3.org/2000/svg" class="grid-paper-svg" ${sizeAttrs} style="${style}" role="img" aria-label="${label}">${parts.join('')}</svg>`;
}

export function gridPaperSvgFromSpec(spec) {
  return gridPaperSvg(parseGridPaper(spec));
}

/** Сериализация модели в DSL (конструктор → текст). Обратная parseGridPaper. */
export function gridToSpec(model = {}) {
  const m = { ...GRID_DEFAULTS, ...model };
  const out = [m.cols ? `${m.cols}x${m.rows}` : `x${m.rows}`];
  if (m.kind && m.kind !== 'grid') out.push(m.kind);
  if (Number(m.stepMm) !== DEFAULT_STEP[m.kind]) out.push(`cell ${r2(Number(m.stepMm))}`);
  if (!m.frame) out.push('noframe');
  return out.join(' ');
}

/** Готовый к вставке сниппет: inline-код (для ячеек таблиц) или fenced-блок. */
export function buildGridSnippet(spec, format) {
  if (format === 'inline') return `\`grid: ${spec}\``;
  return `\n\`\`\`grid\n${spec}\n\`\`\`\n`;
}

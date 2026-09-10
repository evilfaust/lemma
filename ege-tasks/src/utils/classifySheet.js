/**
 * Лист-классификатор («Сортировщик»): чистая логика без React и без сети.
 *
 * Механика листа: ученику дан банк уравнений вперемешку и набор карманов —
 * типов, у каждого свой рациональный способ решения. Задача не в том, чтобы
 * решить всё подряд, а в том, чтобы СНАЧАЛА опознать тип. Поэтому у каждого
 * уравнения есть разметка учителя (`bucketId`), из которой считается ключ,
 * контрольные суммы и раскладка страниц; на листе ученика разметки нет.
 *
 * Ключевая тонкость печати — сколько мест печатать в кармане. Если печатать
 * ровно по числу назначенных уравнений, лист сам выдаёт ответ на половину
 * задания («сюда идут три»). Поэтому по умолчанию мест поровну во всех
 * карманах (`slotMode: 'uniform'`), а самопроверку даёт контрольная сумма
 * номеров — она подтверждает разбиение, не выдавая, сколько куда идёт.
 */

// ─── Пресет карманов: квадратные уравнения ───────────────────────────────────
// Порядок — от простейших приёмов к общему. `hint` печатается под названием
// кармана как признак типа, `example` виден только учителю в редакторе.
export const QUAD_BUCKET_PRESET = [
  {
    key: 'noC',
    label: 'Неполное: свободный коэффициент равен нулю',
    hint: 'ax² + bx = 0',
    method: 'Вынести x за скобку',
    example: 'x^2 - 5x = 0',
  },
  {
    key: 'noB',
    label: 'Неполное: средний коэффициент равен нулю',
    hint: 'ax² + c = 0',
    method: 'Перенести и извлечь корень',
    example: '3x^2 - 27 = 0',
  },
  {
    key: 'noBC',
    label: 'Неполное: только квадрат',
    hint: 'ax² = 0',
    method: 'Единственный корень 0',
    example: '7x^2 = 0',
  },
  {
    key: 'vieta',
    label: 'Приведённое с простыми коэффициентами',
    hint: 'x² + px + q = 0',
    method: 'Обратная теорема Виета',
    example: 'x^2 - 5x + 6 = 0',
  },
  {
    key: 'perfectSquare',
    label: 'Свёрнутый квадрат',
    hint: 'a² ± 2ab + b² = 0',
    method: 'Формула квадрата суммы или разности',
    example: '4x^2 + 4x + 1 = 0',
  },
  {
    key: 'binomSquare',
    label: 'Квадрат двучлена равен числу',
    hint: '(x + a)² = b',
    method: 'Извлечь корень из обеих частей',
    example: '(6 + x)^2 = 4',
  },
  {
    key: 'productZero',
    label: 'Разложено на множители',
    hint: '(x − a)(x − b) = 0',
    method: 'Произведение равно нулю',
    example: '(x - 2)(x + 5) = 0',
  },
  {
    key: 'noRoots',
    label: 'Сразу видно, что корней нет',
    hint: 'квадрат не может быть отрицательным',
    method: 'Анализ знака',
    example: '(2x - 1)^2 = -1',
  },
  {
    key: 'reduce',
    label: 'Сводится к квадратному',
    hint: 'после раскрытия скобок',
    method: 'Привести к виду ax² + bx + c = 0',
    example: '(x - 1)(x + 4) = 6',
  },
  {
    key: 'full',
    label: 'Полное уравнение общего вида',
    hint: 'ax² + bx + c = 0',
    method: 'Дискриминант и формула корней',
    example: '2x^2 - 7x + 3 = 0',
  },
];

// Карман «Другое» существует всегда, но печатается по флажку: без него
// ученику некуда деть уравнение-ловушку, которое не подходит ни под один тип.
export const OTHER_BUCKET_ID = 'other';

export const OTHER_BUCKET = {
  id: OTHER_BUCKET_ID,
  label: 'Не подходит ни к одному типу',
  hint: '',
  points: 0,
};

export const DEFAULT_CLASSIFY_SETTINGS = {
  showChecksum: true,     // «Σ номеров = 27» под карманом
  slotMode: 'uniform',    // 'uniform' — мест поровну, 'auto' — по числу уравнений
  slotsPerBucket: 0,      // 0 = автоматически (максимум по карманам)
  fill: 'grid',           // разлиновка места решения: клетка / линейка / пусто
  solveCells: 4,          // высота места решения в клетках по 5 мм
  bucketColumns: 2,       // карманов в ряд на странице решений
  showOther: true,
  showPoints: false,
  showHints: true,
  showClassField: true,   // поле «Класс» в шапке
  showTable: false,       // таблица «тип → номера» на первой странице
  bankColumns: 2,
  fontSize: 's',
};

// Поля листа. Узкие намеренно: место на решение дороже полей, а лист не
// подшивают — слева оставлено чуть больше остальных, чтобы клетка не упиралась
// в край. Значения отсюда уходят в inline-стиль страницы, чтобы вёрстка и
// расчёт раскладки не разъезжались.
export const PAGE_MM = {
  width: 210,
  height: 297,
  top: 8,
  right: 10,
  bottom: 6,
  left: 12,
};

export const CELL_MM = 5;

/** Сколько миллиметров по высоте реально доступно содержимому страницы. */
export const PAGE_LIMIT_MM = PAGE_MM.height - PAGE_MM.top - PAGE_MM.bottom;

/** Ширина колонки текста на странице — она же ширина клеточного поля. */
export function contentWidthMm() {
  return PAGE_MM.width - PAGE_MM.left - PAGE_MM.right;
}

// Зазор между карманами, стоящими в ряд
const COLUMN_GAP_MM = 4;

/**
 * Ширина клеточного поля внутри кармана: колонка страницы минус зазор между
 * карманами, рамка кармана и её отступы. Нужна точно — по ней считается число
 * вертикальных линий, а лишние ломают масштаб печати.
 */
export function solveWidthMm(columns = 1) {
  const cols = columns === 2 ? 2 : 1;
  const bucketWidth = (contentWidthMm() - (cols - 1) * COLUMN_GAP_MM) / cols;
  return bucketWidth - 7;
}

export function pagePaddingCss() {
  return `${PAGE_MM.top}mm ${PAGE_MM.right}mm ${PAGE_MM.bottom}mm ${PAGE_MM.left}mm`;
}

/**
 * Настройки листа с подставленными дефолтами.
 *
 * Первая версия листа мерила место решения линейками (`solveLines`); после
 * перехода на клетку та же высота пересчитывается в клетки, иначе сохранённый
 * лист молча поменял бы раскладку.
 */
export function normalizeClassifySettings(settings = {}) {
  const next = { ...DEFAULT_CLASSIFY_SETTINGS, ...settings };
  if (settings.solveCells === undefined && settings.solveLines !== undefined) {
    next.solveCells = Math.max(2, Math.round((settings.solveLines * 8) / CELL_MM));
    next.fill = settings.fill || 'lines';
  }
  return next;
}

let seq = 0;
function uid(prefix) {
  seq += 1;
  return `${prefix}${Date.now().toString(36)}${seq.toString(36)}`;
}

export function createBucket(fields = {}) {
  return {
    id: uid('b'),
    label: '',
    hint: '',
    points: 1,
    ...fields,
  };
}

export function createItem(fields = {}) {
  return {
    id: uid('i'),
    latex: '',        // своё уравнение: чистый LaTeX
    md: '',           // задача из каталога: markdown с формулами внутри
    answerLatex: '',
    bucketId: null,
    alsoFits: [],       // карманы, которые тоже засчитываются верными
    ...fields,
  };
}

/** Пресет разворачивается в карманы листа: учитель дальше правит их как свои. */
export function bucketsFromPreset(keys = null) {
  const chosen = keys
    ? QUAD_BUCKET_PRESET.filter(p => keys.includes(p.key))
    : QUAD_BUCKET_PRESET;
  return chosen.map(p => createBucket({
    label: p.label,
    hint: p.hint,
    method: p.method,
    presetKey: p.key,
    points: 1,
  }));
}

/**
 * Карманы для печати: свои карманы плюс «Другое», если он включён.
 * Отдельная функция, потому что порядок и состав нужны одинаковыми и листу
 * ученика, и ключу учителя, и подсчёту сумм.
 */
export function printableBuckets(buckets = [], settings = {}) {
  const list = [...buckets];
  if (settings.showOther) list.push({ ...OTHER_BUCKET });
  return list;
}

/**
 * Разметка листа: у каждого уравнения номер (позиция в банке), у каждого
 * кармана — какие номера в него идут, их сумма и цена.
 *
 * Номер = позиция в банке + 1, поэтому перемешивание банка меняет и суммы —
 * они пересчитываются здесь, а не хранятся в снимке.
 */
export function sheetStats(buckets = [], items = [], settings = {}) {
  const all = printableBuckets(buckets, settings);
  const byBucket = new Map(all.map(b => [b.id, []]));
  const unassigned = [];

  items.forEach((item, index) => {
    const number = index + 1;
    if (item.bucketId && byBucket.has(item.bucketId)) {
      byBucket.get(item.bucketId).push({ number, item });
    } else {
      unassigned.push({ number, item });
    }
  });

  const bucketStats = all.map((bucket) => {
    const entries = byBucket.get(bucket.id) || [];
    const numbers = entries.map(e => e.number);
    return {
      bucket,
      entries,
      numbers,
      count: numbers.length,
      checksum: numbers.reduce((s, n) => s + n, 0),
      points: (bucket.points || 0) * numbers.length,
    };
  });

  return {
    buckets: bucketStats,
    unassigned,
    maxCount: bucketStats.reduce((m, s) => Math.max(m, s.count), 0),
    totalPoints: bucketStats.reduce((s, b) => s + b.points, 0),
  };
}

/** Сколько мест печатать в кармане — см. шапку файла про «uniform». */
export function slotsForBucket(stat, stats, settings = {}) {
  if (settings.slotMode === 'auto') return Math.max(stat.count, 1);
  if (settings.slotsPerBucket > 0) return settings.slotsPerBucket;
  return Math.max(stats.maxCount, 1);
}

// Высоты в миллиметрах — приблизительные, но соотношения те же, что в CSS
// печати. Точность здесь не нужна: важно не дать карману разорваться между
// страницами, поэтому раскладка считается заранее, а не отдаётся браузеру.
const MM = {
  bucketHeader: 9,    // название кармана, признак и волосяной разделитель
  bucketPadding: 4.5, // рамка кармана: отступы сверху и снизу вместе
  bucketGap: 3.5,

  // Первая страница: шапка с полями ученика, блок задания, банк и таблица
  pageHead: 26,
  note: 13,
  bankRow: 8,
  bankFrame: 10,
  tableHead: 10,
  tableRow: 12,
};

/**
 * Высота клеточного поля кармана. Мест под отдельные уравнения на листе нет —
 * поле сплошное, но его высота пропорциональна числу уравнений, которые в этот
 * карман идут: столько места ученику и понадобится.
 */
export function solveHeightMm(slots, settings = {}) {
  const cells = Math.max(1, settings.solveCells ?? DEFAULT_CLASSIFY_SETTINGS.solveCells);
  return Math.max(1, slots) * cells * CELL_MM;
}

export function bucketHeightMm(slots, settings = {}) {
  return MM.bucketHeader
    + MM.bucketPadding
    + solveHeightMm(slots, settings)
    + MM.bucketGap;
}

/**
 * Раскладка карманов по страницам решения. Карман целиком помещается на одну
 * страницу: разорванный пополам карман на бумаге читается как два разных.
 * Карман выше страницы (много мест × высокое поле) занимает свою страницу —
 * иначе он не поместится никуда и потеряется.
 *
 * В два ряда карманы выравниваются по строкам, поэтому строка стоит столько,
 * сколько самый высокий карман в ней: считать надо по строкам, а не по сумме
 * карманов, иначе последняя строка сползёт на следующий лист уже в браузере.
 */
export function paginateBuckets(stats, settings = {}) {
  const cols = settings.bucketColumns === 2 ? 2 : 1;
  const sized = stats.buckets.map((stat) => {
    const slots = slotsForBucket(stat, stats, settings);
    return { ...stat, slots, height: bucketHeightMm(slots, settings) };
  });

  const rows = [];
  for (let i = 0; i < sized.length; i += cols) {
    const row = sized.slice(i, i + cols);
    rows.push({ row, height: Math.max(...row.map(b => b.height)) });
  }

  const pages = [];
  let page = [];
  let used = 0;

  rows.forEach(({ row, height }) => {
    if (page.length && used + height > PAGE_LIMIT_MM) {
      pages.push(page);
      page = [];
      used = 0;
    }
    page.push(...row);
    used += height;
  });

  if (page.length) pages.push(page);
  return pages;
}

/**
 * Высота первой страницы: она одна и не разбивается, поэтому переполнение
 * надо поймать до печати — иначе таблица классификации молча уедет на
 * следующий лист и разорвётся посередине.
 */
export function bankPageHeightMm(items = [], bucketCount = 0, settings = {}) {
  const columns = settings.bankColumns === 1 ? 1 : 2;
  const bank = Math.ceil(items.length / columns) * MM.bankRow + MM.bankFrame;
  const table = settings.showTable
    ? MM.tableHead + bucketCount * MM.tableRow
    : 0;
  return MM.pageHead + MM.note + bank + table;
}

/** Перемешать банк: номера уравнений меняются, вместе с ними и суммы. */
export function shuffleItems(items = []) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Что не так с листом — показывается учителю до печати.
 * Это подсказки, а не запреты: пустой карман бывает нужен намеренно (проверка,
 * не станет ли ученик заполнять его силой), поэтому печать не блокируется.
 */
export function classifyWarnings(buckets = [], items = [], settings = {}) {
  const warnings = [];
  const stats = sheetStats(buckets, items, settings);

  const blank = items.filter(i => !i.latex?.trim()).length;
  if (blank) warnings.push(`Пустых уравнений: ${blank}`);

  if (stats.unassigned.length) {
    warnings.push(`Без типа: ${stats.unassigned.length} — в ключ и суммы они не попадут`);
  }

  const empty = stats.buckets.filter(s => s.bucket.id !== OTHER_BUCKET_ID && s.count === 0);
  if (empty.length) {
    warnings.push(`Пустых типов: ${empty.length} (${empty.map(s => s.bucket.label || 'без названия').join(', ')})`);
  }

  if (!buckets.length) warnings.push('Не добавлено ни одного типа');
  if (!items.length) warnings.push('Банк уравнений пуст');

  const firstPage = bankPageHeightMm(items, stats.buckets.length, settings);
  if (firstPage > PAGE_LIMIT_MM) {
    warnings.push('Первая страница переполнена: уменьшите шрифт, число уравнений '
      + 'или снимите таблицу классификации');
  }

  return warnings;
}

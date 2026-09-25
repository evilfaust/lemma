/**
 * Чертёж сбоку от условия — режим «справа / слева» печатного листа.
 *
 * Сбоку встаёт ЕДИНСТВЕННЫЙ рисунок задачи: картинка задачи (`has_image`)
 * либо один блочный чертёж в условии — ```plot / ```numline / ```vectors или
 * картинка markdown в начале строки. Задачу с несколькими рисунками
 * («на каком рисунке…», соответствия А/Б/В с картинками, прямые в ячейках
 * таблицы) режим не трогает — она печатается как обычно: вынеся рисунки в
 * колонку, мы оторвали бы их от подписей.
 *
 * Рисунок из условия ВЫРЕЗАЕТСЯ из текста и печатается первым — плавающим
 * блоком: обтекать чертёж может только текст, который идёт после него, а
 * рисунок в условии обычно стоит в конце («…Найдите f(8). ```plot…```»).
 *
 * Модуль чистый (без React и DOM) — разбор покрыт юнит-тестами.
 */

/** Сбоку — только эти два значения; всё остальное = «под условием». */
export const isSidePlacement = (placement) => placement === 'left' || placement === 'right';

// Языки fenced-блоков, которые MathRenderer рисует чертежом. ```grid /
// ```клетка сюда не входят: поле в клетку — место для решения, а не рисунок.
const DRAWING_LANGS = new Set(['numline', 'plot', 'vectors']);

// Открытие fenced-блока: до 3 пробелов отступа, ``` или ~~~, первое слово —
// язык. Для обратных кавычек остаток строки не должен содержать «`» — иначе
// это inline-код в тройных кавычках, а не блок (правило CommonMark).
const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})(.*)$/;

// Картинка markdown в начале строки (отступ до 3 пробелов, дальше — код).
// Хвост строки допускается: «![](…)На рисунке изображён лабиринт…».
const IMAGE_AT_LINE_START = /^( {0,3})(!\[[^\]\n]*\]\([^)\n]*\))/;

const IMAGE_TOKEN = /!\[/g;
const HTML_IMAGE = /<img\b/gi;
// Inline-форма чертежа для ячеек таблиц: `numline: …` / `plot: …`.
const INLINE_DRAWING = /`\s*(?:numline|plot|vectors)\s*:/gi;

const count = (line, re) => (line.match(re) || []).length;

/**
 * Находит рисунок, который можно вынести сбоку от условия.
 *
 * @param {string} md — условие (markdown)
 * @param {{ externalImage?: boolean }} opts — есть ли у задачи своя картинка
 *   (`task.has_image` с адресом)
 * @returns {{ figure: null | { kind: 'external' } | { kind: 'drawing'|'image', md: string }, text: string }}
 *   `figure` — что встаёт сбоку (null — задача печатается как обычно),
 *   `text` — условие без вынесенного рисунка.
 */
export function splitSideFigure(md, { externalImage = false } = {}) {
  const source = typeof md === 'string' ? md : '';
  const lines = source.split('\n');
  const figures = [];
  let fence = null;

  lines.forEach((raw, i) => {
    const line = raw.replace(/\r$/, '');

    if (fence) {
      if (fence.close.test(line)) {
        if (fence.drawing) figures.push({ kind: 'drawing', start: fence.start, end: i, movable: true });
        fence = null;
      }
      return;
    }

    const open = FENCE_OPEN.exec(line);
    if (open && !(open[1][0] === '`' && open[2].includes('`'))) {
      const lang = (open[2].trim().split(/\s+/)[0] || '').toLowerCase();
      fence = {
        start: i,
        drawing: DRAWING_LANGS.has(lang),
        close: new RegExp(`^ {0,3}\\${open[1][0]}{${open[1].length},}\\s*$`),
      };
      return;
    }

    const images = count(line, IMAGE_TOKEN) + count(line, HTML_IMAGE);
    const inline = count(line, INLINE_DRAWING);
    if (!images && !inline) return;

    // Выносим только одиночную картинку в начале строки и не из таблицы
    // (строка таблицы может обходиться без ведущей «|»).
    const lead = images === 1 && !inline && !line.includes('|')
      ? IMAGE_AT_LINE_START.exec(line)
      : null;
    if (lead) {
      figures.push({
        kind: 'image', line: i, at: lead[1].length, token: lead[2], movable: true,
      });
      return;
    }
    for (let k = 0; k < images + inline; k += 1) figures.push({ movable: false });
  });

  // Незакрытый fenced-блок тянется до конца условия — react-markdown рисует
  // его так же, значит это такой же чертёж.
  if (fence?.drawing) {
    figures.push({ kind: 'drawing', start: fence.start, end: lines.length - 1, movable: true });
  }

  const none = { figure: null, text: source };
  if (figures.length + (externalImage ? 1 : 0) !== 1) return none;
  if (externalImage) return { figure: { kind: 'external' }, text: source };

  const [only] = figures;
  if (!only.movable) return none;

  if (only.kind === 'drawing') {
    return {
      figure: { kind: 'drawing', md: lines.slice(only.start, only.end + 1).join('\n') },
      text: [...lines.slice(0, only.start), ...lines.slice(only.end + 1)].join('\n'),
    };
  }

  const rest = lines[only.line].slice(only.at + only.token.length);
  const kept = [...lines];
  if (rest.trim() === '') kept.splice(only.line, 1);
  else kept[only.line] = rest.replace(/^[ \t]+/, '');
  return { figure: { kind: 'image', md: only.token }, text: kept.join('\n') };
}

// Картинка в markdown-поле задачи (условие, решение): ![подпись](ссылка).
//
// Сам файл живёт в «Библиотеке» (pb-files), в поле — только ссылка. Куда
// встаёт картинка, решает строка под курсором: строка таблицы («| … |») —
// в ячейку, в строку, без переводов строк (иначе таблица развалится); иначе —
// отдельным абзацем. Размер — токен {S|M|L|XL} за картинкой, как в теории
// (рендер — utils/remarkImageSize.js); без токена размер задаёт место вставки.

// Подпись: скобки, «|» (разделитель ячеек) и переводы строк ломают разметку.
export function mdImageAlt(s) {
  const alt = String(s ?? '').replace(/[[\]\\|]/g, ' ').replace(/\s+/g, ' ').trim();
  return (alt || 'рисунок').slice(0, 60).trim();
}

// Скобки в ссылке закрыли бы ![…](…) раньше времени, пробел её обрывает.
export function mdImageUrl(u) {
  return String(u ?? '').trim()
    .replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/\s/g, '%20');
}

// Строка, в которой стоит позиция pos.
function lineAt(text, pos) {
  const from = text.lastIndexOf('\n', pos - 1) + 1;
  const nl = text.indexOf('\n', pos);
  return { from, to: nl === -1 ? text.length : nl };
}

/** Курсор в строке markdown-таблицы? */
export function isTableRowAt(text, pos) {
  const cur = String(text ?? '');
  if (!Number.isFinite(pos) || pos < 0 || pos > cur.length) return false;
  const { from, to } = lineAt(cur, pos);
  return cur.slice(from, to).trim().startsWith('|');
}

/** Токен размера: 'S' | 'M' | 'L' | 'XL' → «{M}», иначе пусто. */
export function imageSizeToken(size) {
  const s = String(size ?? '').toUpperCase();
  return ['S', 'M', 'L', 'XL'].includes(s) ? `{${s}}` : '';
}

/**
 * Сниппет картинки для вставки в позицию pos текста text.
 * В строке таблицы — голое ![…](…); в тексте — отдельной строкой: перевод
 * строки добавляется только там, где курсор не на границе строки.
 */
export function imageSnippetAt(text, pos, { url, alt, size } = {}) {
  const md = `![${mdImageAlt(alt)}](${mdImageUrl(url)})${imageSizeToken(size)}`;
  const cur = String(text ?? '');
  const usable = Number.isFinite(pos) && pos >= 0 && pos <= cur.length;
  if (usable && isTableRowAt(cur, pos)) return md;
  if (!usable) return `\n${md}\n`; // вставка в конец (см. insertAtCaret)
  const before = pos > 0 && cur[pos - 1] !== '\n' ? '\n' : '';
  const after = pos < cur.length && cur[pos] !== '\n' ? '\n' : '';
  return `${before}${md}${after}`;
}

/**
 * Картинки из буфера обмена / перетаскивания. Пусто, если там есть текст:
 * Word и Excel кладут вместе с текстом ещё и его «снимок» — вставлять надо текст.
 */
export function imageFilesFrom(dataTransfer) {
  if (!dataTransfer) return [];
  const files = Array.from(dataTransfer.files || []).filter((f) => /^image\//.test(f.type || ''));
  if (!files.length) return [];
  const types = Array.from(dataTransfer.types || []);
  if (types.includes('text/plain') && String(dataTransfer.getData?.('text/plain') || '').trim()) return [];
  return files;
}

// ── Пакетная вставка: несколько картинок одним действием ────────────────────

export const BATCH_LAYOUTS = ['column', 'row'];
export const BATCH_LABELS = ['', 'num', 'ru'];
export const BATCH_PER_ROW = [2, 3, 4, 5, 6];
export const BATCH_DEFAULTS = { layout: 'column', perRow: 4, labels: '' };

const RU_LETTERS = 'АБВГДЕЖЗИКЛМНОПРСТУФ';

/** Настройки пакета из чего угодно (localStorage, старые версии) → валидные. */
export function normalizeBatch(raw) {
  const o = raw && typeof raw === 'object' ? raw : {};
  const perRow = Number(o.perRow);
  return {
    layout: BATCH_LAYOUTS.includes(o.layout) ? o.layout : BATCH_DEFAULTS.layout,
    perRow: BATCH_PER_ROW.includes(perRow) ? perRow : BATCH_DEFAULTS.perRow,
    labels: BATCH_LABELS.includes(o.labels) ? o.labels : BATCH_DEFAULTS.labels,
  };
}

/** Подпись i-й картинки: «1) » / «А) » / пусто. Букв не хватило — цифра. */
export function batchLabel(i, labels) {
  if (labels === 'num') return `${i + 1}) `;
  if (labels === 'ru') return `${RU_LETTERS[i] || i + 1}) `;
  return '';
}

// Сколько переводов строк дописать, чтобы блок отделился пустой строкой:
// таблица-галерея, приклеенная к абзацу, таблицей не станет.
function blankLinePad(cur, pos) {
  if (!(Number.isFinite(pos) && pos >= 0 && pos <= cur.length)) {
    // Курсора нет — блок допишется в конец (см. insertAtCaret).
    return { before: cur.trim() === '' ? '' : '\n\n', after: '\n' };
  }
  const head = cur.slice(0, pos);
  const tail = cur.slice(pos);
  const trailing = /\n*$/.exec(head)[0].length;
  const leading = /^\n*/.exec(tail)[0].length;
  return {
    before: head.trim() === '' ? '' : '\n'.repeat(Math.max(0, 2 - trailing)),
    after: tail.trim() === '' ? '' : '\n'.repeat(Math.max(0, 2 - leading)),
  };
}

/**
 * Сниппет для нескольких картинок сразу.
 *  - одна картинка — обычный imageSnippetAt (раскладка и подписи ни к чему);
 *  - курсор в строке таблицы — все в эту ячейку, через пробел;
 *  - layout 'column' — друг под другом, каждая своим абзацем;
 *  - layout 'row' — таблица {галерея}, по perRow в ряду. Размер в ряду не
 *    ставится: ширину картинке даёт ячейка (колонки галереи равные).
 * Порядок — как в images (порядок выбора).
 *
 * @param {Array<{url: string, title?: string}>} images
 * @param {{ size?: string, layout?: string, perRow?: number, labels?: string }} opts
 */
export function imagesSnippetAt(text, pos, images, opts = {}) {
  const list = (images || []).filter((im) => im?.url);
  if (!list.length) return '';
  const { size } = opts;
  if (list.length === 1) return imageSnippetAt(text, pos, { url: list[0].url, alt: list[0].title, size });

  const { layout, perRow, labels } = normalizeBatch(opts);
  const md = (im, withSize) =>
    `![${mdImageAlt(im.title)}](${mdImageUrl(im.url)})${withSize ? imageSizeToken(size) : ''}`;
  const cur = String(text ?? '');

  if (isTableRowAt(cur, pos)) {
    return list.map((im, i) => `${batchLabel(i, labels)}${md(im, true)}`).join(' ');
  }

  let block;
  if (layout === 'row') {
    const rows = [];
    for (let i = 0; i < list.length; i += perRow) {
      const cells = list.slice(i, i + perRow).map((im, k) => `${batchLabel(i + k, labels)}${md(im, false)}`);
      // Неполный последний ряд добиваем пустыми ячейками — колонки не съедут.
      while (rows.length && cells.length < perRow) cells.push(' ');
      rows.push(`| ${cells.join(' | ')} |`);
    }
    const cols = Math.min(perRow, list.length);
    const sep = `| ${Array(cols).fill('---').join(' | ')} |`;
    block = ['{галерея}', rows[0], sep, ...rows.slice(1)].join('\n');
  } else {
    // «1) » в начале абзаца markdown считает нумерованным списком и печатает
    // «1.» — скобку экранируем (в ячейке таблицы списков не бывает).
    const label = (i) => batchLabel(i, labels).replace(/^(\d+)\)/, '$1\\)');
    block = list.map((im, i) => `${label(i)}${md(im, true)}`).join('\n\n');
  }
  const { before, after } = blankLinePad(cur, pos);
  return `${before}${block}${after}`;
}

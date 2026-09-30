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

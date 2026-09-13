// Поиск готового чертежа (координатная плоскость) или поля для записи решения
// вокруг курсора.
//
// Нужен обоим редакторам (условие задачи и теория): учитель ставит курсор
// внутрь уже вставленного блока, жмёт «График» — и конструктор открывается на
// правку этого блока, а не вставляет новый. Чистая функция без DOM: редактор
// отдаёт текст и позицию каретки, получает диапазон для замены.
//
// Понимает обе формы разметки (как и конвейеры рендеринга):
//   ```plot … ```      / ```vectors … ```   — блок
//   `plot: x -3 3; f x` / `vectors: …`      — inline (ячейки markdown-таблиц)

const FENCE_OPEN = /^\s{0,3}```(plot|vectors)\s*$/;
const FENCE_CLOSE = /^\s{0,3}```\s*$/;
const INLINE_RE = /`(plot|vectors)\s*:([^`\n]*)`/g;
// Поле «в клетку» (utils/gridPaper.js) — те же две формы записи.
const GRID_FENCE_OPEN = /^\s{0,3}```(grid|cells|клетка)\s*$/i;
const GRID_INLINE_RE = /`(grid|cells|клетка)\s*:([^`\n]*)`/gi;

/** Есть ли в DSL команды векторов — от этого зависит вкладка конструктора. */
export function plotKindOf(spec) {
  return /(^|[\n;])\s*vec(tor)?\s/i.test(String(spec || '')) ? 'vectors' : 'function';
}

/**
 * Найти блок ```plot / inline `plot: …`, внутри которого стоит курсор.
 * @param {string} text полный текст поля
 * @param {number} pos позиция каретки
 * @returns {{start:number,end:number,spec:string,format:'block'|'inline',kind:'function'|'vectors'}|null}
 */
/**
 * Общий поиск «сниппета под курсором» для обеих форм записи. Возвращает
 * { start, end, spec, format, alias } либо null.
 */
function findSnippetAtCursor(text, pos, fenceOpen, inlineRe) {
  const src = String(text ?? '');
  const caret = Number(pos);
  if (!src || !Number.isFinite(caret) || caret < 0 || caret > src.length) return null;

  // 1) Блочная форма. Идём по строкам, чтобы точно знать смещения границ.
  const lines = src.split('\n');
  let offset = 0;
  let open = null; // { start, bodyStart, alias }
  for (const line of lines) {
    const lineEnd = offset + line.length;
    if (!open) {
      const m = fenceOpen.exec(line);
      if (m) open = { start: offset, bodyStart: lineEnd + 1, alias: m[1] };
    } else if (FENCE_CLOSE.test(line)) {
      if (caret >= open.start && caret <= lineEnd) {
        const spec = src.slice(open.bodyStart, Math.max(open.bodyStart, offset - 1));
        return { start: open.start, end: lineEnd, spec, format: 'block', alias: open.alias };
      }
      open = null;
    }
    offset = lineEnd + 1;
  }

  // 2) Inline-форма: `plot: …` / `grid: …` в ячейке таблицы или посреди строки.
  inlineRe.lastIndex = 0;
  let m = inlineRe.exec(src);
  while (m) {
    const start = m.index;
    const end = start + m[0].length;
    if (caret >= start && caret <= end) {
      return { start, end, spec: m[2].trim(), format: 'inline', alias: m[1] };
    }
    m = inlineRe.exec(src);
  }
  return null;
}

/**
 * Найти блок ```plot / inline `plot: …`, внутри которого стоит курсор.
 * @param {string} text полный текст поля
 * @param {number} pos позиция каретки
 * @returns {{start:number,end:number,spec:string,format:'block'|'inline',kind:'function'|'vectors'}|null}
 */
export function findPlotAtCursor(text, pos) {
  const found = findSnippetAtCursor(text, pos, FENCE_OPEN, INLINE_RE);
  if (!found) return null;
  // Пустой ```vectors ещё не содержит команд vec — вкладку берём из алиаса.
  const kind = plotKindOf(found.spec) === 'vectors' || found.alias === 'vectors' ? 'vectors' : 'function';
  return { start: found.start, end: found.end, spec: found.spec, format: found.format, kind };
}

/**
 * То же для поля «в клетку»: курсор внутри ```grid / `grid: …` → конструктор
 * открывается на правку этого поля, а не вставляет рядом второе.
 * @returns {{start:number,end:number,spec:string,format:'block'|'inline'}|null}
 */
export function findGridAtCursor(text, pos) {
  const found = findSnippetAtCursor(text, pos, GRID_FENCE_OPEN, GRID_INLINE_RE);
  if (!found) return null;
  return { start: found.start, end: found.end, spec: found.spec, format: found.format };
}

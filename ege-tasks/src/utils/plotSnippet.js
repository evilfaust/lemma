// Поиск готового чертежа координатной плоскости вокруг курсора.
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
export function findPlotAtCursor(text, pos) {
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
      const m = FENCE_OPEN.exec(line);
      if (m) open = { start: offset, bodyStart: lineEnd + 1, alias: m[1] };
    } else if (FENCE_CLOSE.test(line)) {
      if (caret >= open.start && caret <= lineEnd) {
        const spec = src.slice(open.bodyStart, Math.max(open.bodyStart, offset - 1));
        // Пустой ```vectors ещё не содержит команд vec — вкладку берём из алиаса.
        const kind = plotKindOf(spec) === 'vectors' || open.alias === 'vectors' ? 'vectors' : 'function';
        return { start: open.start, end: lineEnd, spec, format: 'block', kind };
      }
      open = null;
    }
    offset = lineEnd + 1;
  }

  // 2) Inline-форма: `plot: …` в ячейке таблицы или посреди строки.
  INLINE_RE.lastIndex = 0;
  let m = INLINE_RE.exec(src);
  while (m) {
    const start = m.index;
    const end = start + m[0].length;
    if (caret >= start && caret <= end) {
      const spec = m[2].trim();
      return { start, end, spec, format: 'inline', kind: plotKindOf(spec) };
    }
    m = INLINE_RE.exec(src);
  }
  return null;
}

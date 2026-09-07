// Вставка сниппета (чертёж, таблица) в текст поля по месту курсора.
//
// Тонкость, из-за которой это отдельный модуль: клик по кнопке тулбара уводит
// фокус из поля, поэтому «живого» выделения в момент вставки уже нет — работаем
// по последней запомненной позиции каретки (`LatexField.onCaret`). Позиция
// может протухнуть (текст успели переписать LLM-кнопкой), поэтому диапазон
// проверяется и, если не годится, сниппет дописывается в конец — прежнее
// поведение.

/**
 * @param {string} text текущий текст поля
 * @param {{start:number,end:number}|null} range запомненное выделение/каретка
 * @param {string} snippet что вставляем
 * @returns {{text: string, caret: number}} новый текст и позиция после вставки
 */
export function insertAtCaret(text, range, snippet) {
  const cur = String(text ?? '');
  const s = Number(range?.start);
  const e = Number(range?.end ?? range?.start);
  const usable = Number.isFinite(s) && Number.isFinite(e)
    && s >= 0 && e >= s && e <= cur.length;

  if (!usable) {
    // Курсора нет (или он от другого текста) — как раньше, в конец.
    const tail = cur ? `${cur}${snippet}` : snippet.replace(/^\n/, '');
    return { text: tail, caret: tail.length };
  }
  return { text: cur.slice(0, s) + snippet + cur.slice(e), caret: s + snippet.length };
}

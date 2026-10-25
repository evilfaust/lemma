// sdamgiaRefresh.js — правила окна «Перепарсить с Решу ЕГЭ»
// (components/RefreshFromSdamgiaModal.jsx). Чистые функции, без сети.
//
// Окно сравнивает свежий разбор страницы «Решу» с ТЕКУЩИМ состоянием формы
// редактора (а не с сохранённой задачей): учитель мог уже что-то поправить.
// Выбранное подставляется в форму; сохраняет учитель обычной кнопкой.
import { katexDiagnostics } from './katexLint';

export const REFRESH_FIELDS = [
  { key: 'statement_md', label: 'Условие' },
  { key: 'answer', label: 'Ответ', singleLine: true },
  { key: 'solution_md', label: 'Решение' },
  { key: 'criteria_md', label: 'Критерии' },
  { key: 'max_score', label: 'Макс. балл', singleLine: true, numeric: true },
];

/** Поля, которые можно прогнать через /latex-fix. */
export const LLM_FIELDS = new Set(['statement_md', 'solution_md', 'criteria_md']);

/** Задача из ответа /parse-sdamgia → поля задачи. */
export function freshFromProblem(problem) {
  return {
    statement_md: problem?.condition || '',
    answer: problem?.answer || '',
    solution_md: problem?.solution || '',
    criteria_md: problem?.criteria_md || '',
    max_score: problem?.max_score ?? null,
    condition_images: problem?.condition_images || [],
    solution_images: problem?.solution_images || [],
    criteria_images: problem?.criteria_images || [],
    latex_needs_review: !!problem?.latex_needs_review,
  };
}

const norm = (v) => (v == null ? '' : String(v)).replace(/\s+/g, ' ').trim();

/** Значение поменялось по существу (пробелы и переносы не считаются). */
export function isChanged(oldVal, newVal) {
  return norm(oldVal) !== norm(newVal);
}

/** Есть что подставить: свежее значение не пустое и отличается от текущего. */
export function canApply(oldVal, newVal) {
  return norm(newVal) !== '' && isChanged(oldVal, newVal);
}

/**
 * Галочки по умолчанию: всё, что изменилось и не пустое. Подставляется в
 * форму, а не в базу, — отменить можно, закрыв редактор без сохранения.
 */
export function defaultSelection(current, fresh) {
  const sel = {};
  for (const f of REFRESH_FIELDS) sel[f.key] = canApply(current?.[f.key], fresh?.[f.key]);
  return sel;
}

/** Сколько формул в тексте KaTeX не рисует. */
export function brokenFormulaCount(text) {
  return katexDiagnostics(String(text || '')).filter(d => d.severity === 'error').length;
}

/** Выбранные поля → объект для подстановки в форму. */
export function pickSelected(fresh, selection) {
  const out = {};
  for (const f of REFRESH_FIELDS) {
    if (!selection?.[f.key]) continue;
    const v = fresh?.[f.key];
    if (f.numeric) { if (v != null) out[f.key] = v; } else out[f.key] = v || '';
  }
  return out;
}

/**
 * Флаг «⚠ Проверить LaTeX» после подстановки: если подставлено хоть одно
 * текстовое поле — по тому, рисуются ли формулы в итоговом тексте задачи.
 * null — флаг не трогать.
 */
export function reviewFlagAfter(current, applied) {
  const textKeys = ['statement_md', 'solution_md', 'criteria_md', 'answer'];
  if (!textKeys.some(k => k in applied)) return null;
  const merged = { ...current, ...applied };
  return textKeys.some(k => brokenFormulaCount(merged[k]) > 0);
}

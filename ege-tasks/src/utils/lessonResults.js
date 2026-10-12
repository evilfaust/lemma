/**
 * Результаты в карточке урока у ученика (v3.9.358) — чистая логика.
 *
 * Пункт урока, за которым стоят попытки ученика:
 *   kind 'work'  — онлайн-выдача: попытки этой выдачи (`session_id`);
 *   kind 'paper' — работа на бумаге: попытки по любой выдаче работы
 *                  (`work_id`; бланки вносятся отдельной закрытой выдачей).
 *
 * Состояние пункта:
 *   'none'    — попыток нет (онлайн — «Решать», бумага — «результатов пока нет»);
 *   'started' — начал и не сдал (только онлайн, «Продолжить»);
 *   'hidden'  — сдано, но учитель закрыл результаты (utils/resultsVisibility);
 *   'done'    — сдано, балл виден: лучшая попытка по проценту (как в журнале).
 */

import { attemptResultsHidden } from './resultsVisibility';

const submitted = (a) => a && (a.status === 'submitted' || a.status === 'corrected');
const pctOf = (a) => (Number(a.total) > 0 ? (Number(a.score) || 0) / Number(a.total) : 0);
const workOfAttempt = (a) => a?.expand?.session?.work || '';

/** Есть ли у пункта результат, который стоит искать в попытках. */
export const hasResult = (item) => item?.kind === 'paper' || (item?.kind === 'work' && !!item.session_id);

/**
 * → { state, attempt?, score?, total?, pct? }
 * `attempts` — попытки ученика с `expand.session` (work, results_hidden).
 */
export function itemResult(item, attempts) {
  if (!hasResult(item)) return { state: 'none' };
  const mine = (attempts || []).filter((a) => (item.kind === 'paper'
    ? !!item.work_id && workOfAttempt(a) === item.work_id
    : a.session === item.session_id));
  const done = mine.filter(submitted);
  const open = done.filter((a) => !attemptResultsHidden(a));
  if (open.length) {
    const best = open.reduce((b, a) => (pctOf(a) > pctOf(b) ? a : b));
    const total = Number(best.total) || 0;
    const score = Number(best.score) || 0;
    return { state: 'done', attempt: best, score, total, pct: total ? Math.round((score / total) * 100) : 0 };
  }
  if (done.length) return { state: 'hidden', attempt: done[0] };
  if (item.kind === 'work' && mine.some((a) => a.status === 'started')) return { state: 'started' };
  return { state: 'none' };
}

/** Подпись состояния для ученика. */
export function resultLabel(item, res) {
  if (!res) return '';
  if (res.state === 'done') return res.total ? `${res.score} из ${res.total}` : 'Сдано';
  if (res.state === 'hidden') return item?.kind === 'paper' ? 'Результатов пока нет' : 'Сдано · результатов пока нет';
  if (res.state === 'started') return 'Начато, не сдано';
  return item?.kind === 'paper' ? 'Результатов пока нет' : '';
}

/** Тон балла: как в «Последних результатах» на главной. */
export const resultTone = (pct) => (pct >= 85 ? 'good' : pct >= 50 ? 'mid' : 'low');

/**
 * Обязательно ли сделать пункт (ученическая сторона). Сервер кладёт
 * `required` сам (lessons_feed_lib.requiredOf); без него — пункт с сервера
 * старой версии: ДЗ и онлайн-работы обязательны.
 */
export function itemRequired(item) {
  if (!item || item.kind === 'paper') return false;
  if (typeof item.required === 'boolean') return item.required;
  return item.role === 'homework' || item.kind === 'work';
}

/** Раздел карточки урока: 'required' | 'materials' | 'results'. */
export function itemSection(item) {
  if (item?.kind === 'paper') return 'results';
  return itemRequired(item) ? 'required' : 'materials';
}

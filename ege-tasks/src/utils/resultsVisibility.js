/**
 * Видимость результатов ученику (v3.9.321).
 *
 * По умолчанию результаты публикуются сразу после сдачи (как было всегда).
 * Учитель может закрыть их вручную у отдельной выдачи —
 * `work_sessions.results_hidden = true`: ученик видит, что работа сдана, но не
 * баллы, не процент и не разбор ответов. Открыл — всё появляется само.
 *
 * Правило одно на все ученические экраны (главная, «Прогресс», страница
 * результата, каникулярная программа) — новые экраны с баллами брать отсюда.
 */

/** Закрыты ли результаты выдачи. */
export function sessionResultsHidden(session) {
  return session?.results_hidden === true;
}

/** Закрыты ли результаты попытки (выдача приходит через expand.session). */
export function attemptResultsHidden(attempt) {
  return sessionResultsHidden(attempt?.expand?.session);
}

/** Попытки, баллы которых ученику можно показывать. */
export function visibleResultAttempts(attempts) {
  return (attempts || []).filter((a) => !attemptResultsHidden(a));
}

/** Состояние набора выдач для переключателя учителя: 'none' | 'some' | 'all'. */
export function hiddenState(sessions) {
  const list = (sessions || []).filter(Boolean);
  if (!list.length) return 'none';
  const n = list.filter(sessionResultsHidden).length;
  if (n === 0) return 'none';
  return n === list.length ? 'all' : 'some';
}

export const HIDDEN_RESULTS_NOTE = 'Учитель откроет результаты позже.';

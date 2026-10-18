/**
 * Задачи генератора — в «Мои» (v3.9.382).
 *
 * Генератор стереометрии сохраняет задания задачами банка с origin = 'gen'
 * (коды ANG-/SEC-/DST-… со штампом листа) — без темы, вне области «Мои».
 * Удачную генерацию учитель забирает к себе:
 *   - уже сохранённую — ПЕРЕВОДОМ НА МЕСТЕ (`adoptPatch`): та же запись, работы
 *     с ней не меняются, дублей нет;
 *   - ещё не сохранённую — сразу своей задачей (`mineRecord`).
 * В обоих случаях — код GEO-N, тема/подтема по выбору, в источнике остаётся,
 * откуда задача.
 */

export const GEN_SOURCE = 'Генератор задач по стереометрии';

/** Можно ли перевести задачу в «Мои» на месте. */
export function isGenTask(task) {
  return task?.origin === 'gen';
}

function withRef(source, ref) {
  const parts = String(source || GEN_SOURCE).split(',').map((s) => s.trim()).filter(Boolean);
  if (ref && !parts.includes(ref)) parts.push(ref);
  return parts.join(', ');
}

function topicFields({ topic, subtopic } = {}) {
  return { topic: topic || null, subtopic: topic && subtopic ? subtopic : null };
}

/**
 * Изменения записи задачи генератора при переводе в «Мои».
 * Старый код уходит в источник — по нему задачу ещё можно узнать в листе.
 */
export function adoptPatch(task, code, opts = {}) {
  return {
    origin: 'manual',
    code,
    source: withRef(task.source, task.code),
    ...topicFields(opts),
  };
}

/** Запись генератора (genTaskToRecord) → сразу своя задача. */
export function mineRecord(record, code, opts = {}) {
  return {
    ...record,
    origin: 'manual',
    code,
    source: withRef(record.source),
    ...topicFields(opts),
  };
}

/** Ключ ячейки листа генератора. */
export const cellKey = (v, r) => `${v}:${r}`;

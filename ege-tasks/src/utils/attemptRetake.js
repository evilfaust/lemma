/**
 * Повторные попытки теста/работы (v3.9.380) — чистая логика без сети.
 *
 * Два пути дать ученику ещё попытку:
 *   1. «Несколько попыток» у выдачи (`work_sessions.max_attempts` ≥ 2) —
 *      ученик сам жмёт «Пройти ещё раз», пока не кончится лимит;
 *   2. учитель выдаёт попытку вручную («Другой вариант» в «Результатах» или
 *      «Ещё попытка тем, кто ниже порога») — создаётся новая начатая
 *      попытка, ученик попадает в неё по той же ссылке.
 *
 * Здесь: что показать учителю (переключатель на несколько выдач, кому дать
 * ещё попытку) и ученику («можно пересдать» на главной и в уроке).
 * Тесты — `__tests__/attemptRetake.test.js`.
 */

export const isSubmittedAttempt = (a) => !!a && (a.status === 'submitted' || a.status === 'corrected');

const pctOf = (a) => (Number(a?.total) > 0 ? (Number(a.score) || 0) / Number(a.total) : 0);
const timeOf = (a) => new Date(a?.created || 0).getTime();

/** Лимит попыток выдачи: 1 — обычная одна попытка (0/пусто в базе). */
export function attemptLimit(session) {
  const n = Math.round(Number(session?.max_attempts) || 0);
  return n >= 2 ? n : 1;
}

/** Значение поля `max_attempts` для лимита (1 попытка хранится нулём, как было). */
export const maxAttemptsValue = (limit) => {
  const n = Math.round(Number(limit) || 0);
  return n >= 2 ? n : 0;
};

/**
 * Переключатель «Несколько попыток» на одну или несколько выдач.
 * → { limit, mixed } — `limit` наибольший из выдач, `mixed`: у выдач разные лимиты.
 */
export function attemptsSettingOf(sessions) {
  const limits = (sessions || []).filter(Boolean).map(attemptLimit);
  if (!limits.length) return { limit: 1, mixed: false };
  return { limit: Math.max(...limits), mixed: new Set(limits).size > 1 };
}

/** Кто писал: ученик с аккаунтом, иначе устройство, иначе имя. */
export function attemptStudentKey(a) {
  if (a?.student) return `s:${a.student}`;
  if (a?.device_id) return `d:${a.device_id}`;
  return `n:${(a?.student_name || '').trim().toLowerCase()}`;
}

/**
 * Кому дать ещё попытку: лучший сданный результат ниже порога (в процентах).
 * Ученик, у которого уже есть начатая попытка новее последней сданной (её
 * выдали, а он ещё не решил), в список не попадает — вторая не нужна.
 *
 * → [{ key, name, bestPct, attempt, count }], слабые сверху;
 *   `attempt` — последняя сданная попытка (от неё выдаётся новая: та же
 *   выдача, тот же ученик/устройство), `count` — сколько попыток уже было.
 */
export function retakeCandidates(attempts, thresholdPct) {
  const byKey = new Map();
  for (const a of attempts || []) {
    const k = attemptStudentKey(a);
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k).push(a);
  }
  const limit = Number(thresholdPct);
  const out = [];
  for (const [key, list] of byKey) {
    const done = list.filter(isSubmittedAttempt);
    if (!done.length) continue;
    const last = done.reduce((b, a) => (timeOf(a) > timeOf(b) ? a : b));
    if (list.some((a) => a.status === 'started' && timeOf(a) > timeOf(last))) continue;
    const bestPct = Math.round(Math.max(...done.map(pctOf)) * 100);
    if (!(bestPct < limit)) continue;
    out.push({ key, name: last.student_name || 'Без имени', bestPct, attempt: last, count: list.length });
  }
  return out.sort((a, b) => a.bestPct - b.bestPct || a.name.localeCompare(b.name, 'ru'));
}

/**
 * Ученику: можно ли пройти выдачу ещё раз.
 * `attempts` — попытки ученика (любых выдач), `session` — запись выдачи
 * (по умолчанию берётся из `expand.session` попыток).
 *
 * → null
 *   | { kind: 'issued' }            — учитель выдал попытку, она ждёт ученика;
 *   | { kind: 'more', left, limit } — «Несколько попыток»: осталось `left`.
 * Только после сдачи: до неё это просто работа, а не пересдача.
 */
export function retakeOf(sessionId, attempts, session = null) {
  if (!sessionId) return null;
  const mine = (attempts || []).filter((a) => a.session === sessionId);
  const done = mine.filter(isSubmittedAttempt);
  if (!done.length) return null;
  const sess = session || mine.find((a) => a.expand?.session)?.expand?.session || null;
  if (sess?.is_open === false) return null;
  const lastDone = Math.max(...done.map(timeOf));
  const started = mine.filter((a) => a.status === 'started');
  if (started.some((a) => timeOf(a) > lastDone)) return { kind: 'issued' };
  if (started.length) return null;
  const limit = attemptLimit(sess);
  if (limit < 2 || mine.length >= limit) return null;
  return { kind: 'more', left: limit - mine.length, limit };
}

/** Подпись для ученика: «Можно пересдать · ещё 2 попытки». */
export function retakeLabel(r) {
  if (!r) return '';
  if (r.kind === 'issued') return 'Учитель дал ещё попытку';
  const n = r.left;
  const word = n % 10 === 1 && n % 100 !== 11 ? 'попытка'
    : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'попытки' : 'попыток';
  return `Можно пересдать · ещё ${n} ${word}`;
}

/**
 * Изменились ли у выдачи настройки, которые видит ученик на экране
 * результата (учитель включил попытки, закрыл приём или результаты).
 */
export function sessionSettingsChanged(prev, next) {
  if (!prev || !next) return !!next && prev !== next;
  return ['max_attempts', 'passing_score', 'is_open', 'results_hidden']
    .some((k) => (prev[k] ?? null) !== (next[k] ?? null));
}

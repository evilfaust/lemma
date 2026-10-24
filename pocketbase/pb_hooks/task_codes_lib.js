/**
 * Коды задач банка (v3.9.397, план — TASK_CODES_PLAN.md).
 *
 *   П12-034 — {префикс темы}-{номер в теме}
 *
 * Префикс задаёт тема: экзаменационная — буквой экзамена и номером задания
 * (П — профиль, Б — база, ОГ — ОГЭ, ПА/БА/ОГА — архивная тема, В7.15 — ВПР
 * 7 класса №15, Т1 — тригонометрия), остальные — своим `topics.code_prefix`
 * (КУ, ПЛ, И11…). Нет префикса (Гордин, смешанная тема Мордковича) — код
 * задаче не присваивается, его ставит тот, кто создаёт задачу.
 *
 * CommonJS — так его подключает JSVM PocketBase (`require` внутри
 * обработчика), файл без суффикса .pb.js, поэтому PB сам его не исполняет.
 * Хук — task_codes.pb.js. 🚨 Правило префикса продублировано в
 * ege-tasks/src/utils/taskCode.js — фронт показывает учителю тот же код,
 * который присвоит сервер; тест taskCode.test.js сверяет обе копии.
 */

const EXAM_LETTERS = { ege_profile: 'П', ege_base: 'Б', oge: 'ОГ' };

/** Префикс кодов темы; '' — тема кодов не раздаёт. */
function topicPrefix(topic) {
  if (!topic) return '';
  const own = String(topic.code_prefix || '').trim().toUpperCase();
  if (own) return own;
  const n = Number(topic.ege_number) || 0;
  const letter = EXAM_LETTERS[topic.exam_type];
  if (letter && n > 0) return letter + (topic.archived ? 'А' : '') + n;
  // ВПР: номер темы = класс + номер задания (715 → 7 класс, №15).
  if (topic.exam_type === 'vpr' && n > 9) {
    const s = String(n);
    return 'В' + s[0] + '.' + Number(s.slice(1));
  }
  if (topic.exam_type === 'trig') {
    const m = String(topic.id || '').match(/(\d+)$/);
    if (m) return 'Т' + parseInt(m[1], 10);
  }
  return '';
}

function formatCode(prefix, seq) {
  return prefix + '-' + String(seq).padStart(3, '0');
}

/** «П12-034» → { prefix: 'П12', seq: 34 }; не наш формат → null. */
function parseCode(code) {
  const m = String(code || '').trim().match(/^(.+)-(\d+)$/);
  if (!m) return null;
  return { prefix: m[1], seq: parseInt(m[2], 10) };
}

/**
 * Границы кодов префикса для индекса: все строки, начинающиеся с «P-»,
 * лежат в [P-, P.) — «.» идёт в таблице сразу за «-», поэтому В7.15-…
 * в диапазон В7.1 не попадает.
 */
function codeRange(prefix) {
  return { lo: prefix + '-', hi: prefix + '.' };
}

const STOP_WORDS = {
  'и': 1, 'в': 1, 'во': 1, 'с': 1, 'со': 1, 'на': 1, 'из': 1, 'к': 1, 'по': 1,
  'её': 1, 'ее': 1, 'его': 1, 'их': 1, 'для': 1, 'о': 1, 'об': 1, 'от': 1,
  'до': 1, 'за': 1, 'а': 1, 'или': 1, 'при': 1, 'класс': 1, 'кл': 1,
};

/**
 * Префикс новой темы без номера — по первым буквам слов названия:
 * «Квадратные уравнения» → КУ, «Интенсив 11» → И11, «Производная» → ПР.
 * Занятые префиксы (`taken` — массив или Set, регистр не важен) обходятся
 * цифрой: КУ2, КУ3…
 */
function suggestPrefix(title, taken) {
  const busy = {};
  (taken ? Array.from(taken) : []).forEach((p) => { busy[String(p).toUpperCase()] = 1; });
  const words = String(title || '').toLowerCase().split(/[^0-9a-zа-яё]+/i).filter(Boolean);
  let letters = '';
  let digits = '';
  for (const w of words) {
    if (/^\d+$/.test(w)) { if (!digits) digits = w; continue; }
    if (STOP_WORDS[w]) continue;
    if (letters.length < 3) letters += w[0];
  }
  if (letters.length === 1) {
    const first = words.find((w) => !/^\d+$/.test(w) && !STOP_WORDS[w]) || '';
    if (first.length > 1 && !digits) letters = first.slice(0, 2);
  }
  let base = (letters || 'т').toUpperCase().replace(/Ё/g, 'Е') + digits;
  if (!busy[base]) return base;
  for (let i = 2; i < 100; i++) {
    const cand = base + i;
    if (!busy[cand]) return cand;
  }
  return base + Date.now() % 1000;
}

/** Список прежних кодов + ещё один (без повторов и пустых). */
function withOldCode(oldCodes, code) {
  const list = Array.isArray(oldCodes) ? oldCodes.filter(Boolean).map(String) : [];
  const c = String(code || '').trim();
  if (c && list.indexOf(c) < 0) list.push(c);
  return list;
}

module.exports = {
  EXAM_LETTERS, topicPrefix, formatCode, parseCode, codeRange, suggestPrefix, withOldCode,
};

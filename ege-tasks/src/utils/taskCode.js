/**
 * Коды задач банка (v3.9.397, план — TASK_CODES_PLAN.md): П12-034 —
 * {префикс темы}-{номер в теме}. Код присваивает СЕРВЕР
 * (pocketbase/pb_hooks/task_codes.pb.js) — фронт его не придумывает, а только
 * показывает учителю, какой код будет, ищет и сортирует.
 *
 * 🚨 `topicPrefix`/`formatCode`/`parseCode`/`suggestPrefix` — копия
 * pocketbase/pb_hooks/task_codes_lib.js; тест taskCode.test.js сверяет обе на
 * одних данных. Правило поменялось — менять в двух местах.
 */

const EXAM_LETTERS = { ege_profile: 'П', ege_base: 'Б', oge: 'ОГ' };

/** Префикс кодов темы; '' — тема кодов не раздаёт (Гордин, смешанная тема). */
export function topicPrefix(topic) {
  if (!topic) return '';
  const own = String(topic.code_prefix || '').trim().toUpperCase();
  if (own) return own;
  const n = Number(topic.ege_number) || 0;
  const letter = EXAM_LETTERS[topic.exam_type];
  if (letter && n > 0) return letter + (topic.archived ? 'А' : '') + n;
  // ВПР: номер темы = класс + номер задания (715 → 7 класс, №15).
  if (topic.exam_type === 'vpr' && n > 9) {
    const s = String(n);
    return `В${s[0]}.${Number(s.slice(1))}`;
  }
  if (topic.exam_type === 'trig') {
    const m = String(topic.id || '').match(/(\d+)$/);
    if (m) return `Т${parseInt(m[1], 10)}`;
  }
  return '';
}

export function formatCode(prefix, seq) {
  return `${prefix}-${String(seq).padStart(3, '0')}`;
}

/** «П12-034» → { prefix: 'П12', seq: 34 }; не наш формат → null. */
export function parseCode(code) {
  const m = String(code || '').trim().match(/^(.+)-(\d+)$/);
  if (!m) return null;
  return { prefix: m[1], seq: parseInt(m[2], 10) };
}

const STOP_WORDS = new Set([
  'и', 'в', 'во', 'с', 'со', 'на', 'из', 'к', 'по', 'её', 'ее', 'его', 'их', 'для',
  'о', 'об', 'от', 'до', 'за', 'а', 'или', 'при', 'класс', 'кл',
]);

/**
 * Префикс новой темы без номера — по первым буквам слов названия
 * («Квадратные уравнения» → КУ, «Интенсив 11» → И11, «Производная» → ПР);
 * занятые обходятся цифрой (КУ2). Так же подбирает сервер при создании темы.
 */
export function suggestPrefix(title, taken) {
  const busy = new Set([...(taken || [])].map((p) => String(p).toUpperCase()));
  const words = String(title || '').toLowerCase().split(/[^0-9a-zа-яё]+/i).filter(Boolean);
  let letters = '';
  let digits = '';
  for (const w of words) {
    if (/^\d+$/.test(w)) { if (!digits) digits = w; continue; }
    if (STOP_WORDS.has(w)) continue;
    if (letters.length < 3) letters += w[0];
  }
  if (letters.length === 1) {
    const first = words.find((w) => !/^\d+$/.test(w) && !STOP_WORDS.has(w)) || '';
    if (first.length > 1 && !digits) letters = first.slice(0, 2);
  }
  const base = (letters || 'т').toUpperCase().replace(/Ё/g, 'Е') + digits;
  if (!busy.has(base)) return base;
  for (let i = 2; i < 100; i++) {
    if (!busy.has(base + i)) return base + i;
  }
  return base + (Date.now() % 1000);
}

/** Правильный вид префикса темы для поля формы: заглавные, буквы/цифры/точка. */
export const PREFIX_PATTERN = /^[A-ZА-ЯЁ0-9.]{1,16}$/;

// Латиница, которую легко набрать вместо кириллицы в коде (раскладка,
// автозамена): A B C E H K M O P T X Y → А В С Е Н К М О Р Т Х У.
const LOOKALIKE = {
  A: 'А', B: 'В', C: 'С', E: 'Е', H: 'Н', K: 'К', M: 'М', O: 'О', P: 'Р', T: 'Т', X: 'Х', Y: 'У',
};

/**
 * Запрос поиска → код в каноническом виде, если запрос похож на код:
 *   «п12 34», «П12-34», «п12-034» → «П12-034»; «ПA12-5» (латинская A) →
 *   «ПА12-005»; «в7.15-2» → «В7.15-002»; «п12» → «П12-» (все задачи темы).
 * Не похож на код с буквами (просто «12-034», слово) → null: такой ищется
 * как раньше — в коде, условии и в прежних кодах.
 */
export function normalizeCodeQuery(raw) {
  let s = String(raw || '').trim().toUpperCase().replace(/Ё/g, 'Е');
  if (!s) return null;
  s = s.replace(/[A-Z]/g, (ch) => LOOKALIKE[ch] || ch);
  const m = s.match(/^([А-Я]{1,5}(?:\d+(?:\.\d+)?)?(?:[А-Я]{0,2}))(?:[\s\-_]+(\d+))?$/);
  if (!m || !/[А-Я]/.test(m[1])) return null;
  if (m[2]) return formatCode(m[1], parseInt(m[2], 10));
  return /\d$/.test(m[1]) ? `${m[1]}-` : null;
}

/** Сравнение кодов «по-человечески»: П12-999 раньше П12-1000, П2 раньше П12. */
export function compareTaskCodes(a, b) {
  return String(a || '').localeCompare(String(b || ''), 'ru', { numeric: true });
}

/** Прежние коды задачи (json-поле old_codes бывает null/строкой/массивом). */
export function oldCodesOf(task) {
  const v = task?.old_codes;
  if (Array.isArray(v)) return v.filter(Boolean);
  if (typeof v === 'string' && v.trim().startsWith('[')) {
    try { const a = JSON.parse(v); return Array.isArray(a) ? a.filter(Boolean) : []; } catch { return []; }
  }
  return [];
}

/**
 * Какой код получит следующая задача темы — подсказка в окне создания.
 * Сервер всё равно считает сам: между подсказкой и сохранением номер могут
 * занять, поэтому в интерфейсе это «≈ П12-427».
 */
export function previewNextCode(topic, existingCodes) {
  const prefix = topicPrefix(topic);
  if (!prefix) return '';
  let max = 0;
  for (const c of existingCodes || []) {
    const p = parseCode(c);
    if (p && p.prefix === prefix && p.seq > max) max = p.seq;
  }
  return formatCode(prefix, max + 1);
}

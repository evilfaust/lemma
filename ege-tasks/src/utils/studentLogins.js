/**
 * Человекочитаемые логины и простые пароли учеников (v3.9.294) — чистая
 * логика без сети.
 *
 * Логин: фамилия латиницей + «.» + первая буква имени («Иванов Пётр» →
 * ivanov.p). Имена в системе пишутся «Фамилия Имя». Совпал — берём две буквы
 * имени, потом всё имя, потом цифру: ivanov.pe → ivanov.petr → ivanov.p2.
 * Шаблон поля students.username в PB: ^[\w][\w\.\-]*$, минимум 3 символа.
 *
 * Пароль: короткое слово + 3 цифры (sova274). Без похожих символов — пароль
 * диктуют вслух и переписывают с карточки; при первом входе ученик меняет его
 * на свой (students.must_change_password).
 */

// Школьная транслитерация: читается и набирается на телефоне без раздумий.
const TRANSLIT = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i',
  й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't',
  у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '',
  э: 'e', ю: 'yu', я: 'ya',
};

/** Русский (и уже латинский) текст → строчная латиница [a-z0-9]. */
export function translit(text) {
  return String(text || '')
    .toLowerCase()
    .split('')
    .map((ch) => (ch in TRANSLIT ? TRANSLIT[ch] : ch))
    .join('')
    .replace(/[^a-z0-9]/g, '');
}

/** «Фамилия Имя …» → { last, first } латиницей (пустые строки, если нет). */
export function nameParts(fullName) {
  const words = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  return { last: translit(words[0] || ''), first: translit(words[1] || '') };
}

/** Кандидаты логина по порядку предпочтения (без проверки занятости). */
export function loginCandidates(fullName) {
  const { last, first } = nameParts(fullName);
  const base = last || first || 'uchenik';
  const out = [];
  const add = (x) => { if (x.length >= 3 && !out.includes(x)) out.push(x); };
  if (last && first) {
    add(`${last}.${first[0]}`);
    if (first.length > 1) add(`${last}.${first.slice(0, 2)}`);
    add(`${last}.${first}`);
  } else {
    add(base.length >= 3 ? base : `${base}.st`);
  }
  const head = out[0];
  for (let i = 2; i < 100; i++) add(`${head}${i}`);
  return out;
}

/** Первый свободный логин. taken — Set или массив занятых (без учёта регистра). */
export function suggestLogin(fullName, taken = []) {
  const busy = new Set([...(taken || [])].map((x) => String(x).toLowerCase()));
  return loginCandidates(fullName).find((c) => !busy.has(c)) || `${loginCandidates(fullName)[0]}${Date.now() % 1000}`;
}

/**
 * Логины на целый список: следующий учитывает уже выданные предыдущим
 * (два Иванова П. в одной группе не получат один логин).
 * items: [{ id, name }] → Map(id → логин).
 */
export function suggestLogins(items, taken = []) {
  const busy = new Set([...(taken || [])].map((x) => String(x).toLowerCase()));
  const out = new Map();
  for (const it of items || []) {
    const login = suggestLogin(it.name, busy);
    busy.add(login);
    out.set(it.id, login);
  }
  return out;
}

/** Логин сгенерирован машиной (st_xxxxxx, ext_xxxxxxxx) — его стоит заменить. */
export const isMachineLogin = (username) => /^(st|ext)_[a-z0-9]+$/.test(String(username || ''));

/** Логин подходит под шаблон поля students.username. */
export const isValidLogin = (username) => /^[A-Za-z0-9_][A-Za-z0-9_.-]{2,}$/.test(String(username || ''));

// Короткие слова без похожих букв (нет l, o — их путают с 1 и 0).
const WORDS = [
  'kit', 'sad', 'dub', 'mak', 'yak', 'ezh', 'kran', 'tuman', 'zima', 'vesna',
  'reka', 'sneg', 'veter', 'gusi', 'kiwi', 'myata', 'vishnya', 'fikus', 'tigr', 'zubr',
  'zhuk', 'yashma', 'park', 'mayak', 'kruiz', 'sapsan', 'kedr', 'pihta', 'grusha', 'dynya',
  'perec', 'ris', 'sayra', 'kumys', 'barsuk', 'arbuz', 'mir', 'zvezda', 'raketa', 'sputnik',
];
const DIGITS = '23456789';

/** Простой пароль «слово + 3 цифры». rand — функция [0, 1) (для тестов). */
export function simplePassword(rand = Math.random) {
  const word = WORDS[Math.floor(rand() * WORDS.length) % WORDS.length];
  let num = '';
  for (let i = 0; i < 3; i++) num += DIGITS[Math.floor(rand() * DIGITS.length) % DIGITS.length];
  return word + num;
}

export const STUDENT_SITE = 'student.oipav.ru';

const CYRILLIC_ALPHABET = 'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЫЭЮЯ';
const LATIN_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DIGITS = '0123456789';

const COMMON_DECOY_ANSWERS = [
  '0', '1', '-1', '2', '-2', '3', '-3', '4', '-4', '5', '-5',
  '6', '-6', '7', '-7', '8', '-8', '9', '-9', '10', '-10',
  '11', '12', '13', '14', '15', '16', '18', '20', '24', '25',
  '0,5', '-0,5', '1,5', '-1,5', '2,5', '0,1', '0,2', '0,25',
  '0,4', '0,75', '1,2', '3,5', '4,5', '6,5', '7,5', '12,5',
];

function normalizeWhitespace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

export function normalizeCryptogramPhrase(value) {
  return normalizeWhitespace(value)
    .toUpperCase()
    .replace(/Ё/g, 'Е')
    .replace(/[^A-ZА-Я0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Всего букв (без пробелов) — для информации */
export function getCryptogramLetterCount(value) {
  return normalizeCryptogramPhrase(value).replace(/\s/g, '').length;
}

/** Уникальных букв — именно столько задач нужно */
export function getCryptogramUniqueLetterCount(value) {
  const letters = normalizeCryptogramPhrase(value).replace(/\s/g, '').split('');
  return new Set(letters).size;
}

function normalizeAnswer(value) {
  return normalizeWhitespace(value);
}

function hashString(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) || 1;
}

function createSeededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(items, random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function getAlphabet(letters) {
  const joined = letters.join('');
  const hasCyrillic = /[А-Я]/.test(joined);
  const hasLatin = /[A-Z]/.test(joined);
  if (hasCyrillic && !hasLatin) return CYRILLIC_ALPHABET;
  if (hasLatin && !hasCyrillic) return `${LATIN_ALPHABET}${DIGITS}`;
  return `${CYRILLIC_ALPHABET}${LATIN_ALPHABET}`;
}

/**
 * Строит шифровку.
 *
 * Логика:
 *  - uniqueLetters = уникальные буквы фразы (в порядке первого вхождения)
 *  - tasks.length должно равняться uniqueLetters.length
 *  - tasks[i].answer ↔ uniqueLetters[i]  (биекция)
 *  - для каждой позиции в фразе вычисляется нужный ответ (letterToAnswer)
 *  - answerCells содержит { type, value, answer } где answer — значение для данной позиции
 */
export function buildCryptogramForVariant({
  variant,
  phrase,
  minDecoys = 4,
  maxDecoys = 8,
} = {}) {
  const normalizedPhrase = normalizeCryptogramPhrase(phrase);
  const allLetters = normalizedPhrase.replace(/\s/g, '').split('');
  const uniqueLetters = [...new Set(allLetters)];
  const tasks = variant?.tasks || [];
  const warnings = [];
  const positionsByLetter = {};

  if (!normalizedPhrase) {
    warnings.push('Введите слово или фразу для шифровки.');
  }

  if (tasks.length !== uniqueLetters.length) {
    warnings.push(
      `Для шифровки нужно, чтобы число задач (${tasks.length}) совпадало с числом уникальных букв (${uniqueLetters.length}).`
    );
  }

  // answerCells: для каждого символа фразы — тип + порядковый номер позиции (1,2,3...)
  let posCounter = 0;
  const answerCells = normalizedPhrase.split('').map((char) => {
    if (char === ' ') return { type: 'space', value: ' ', posNum: null };
    posCounter += 1;
    if (!positionsByLetter[char]) positionsByLetter[char] = [];
    positionsByLetter[char].push(posCounter);
    return { type: 'letter', value: char, posNum: posCounter };
  });

  // Маппинг задача → буква (по позиции в uniqueLetters)
  const answerKey = tasks.map((task, index) => ({
    index: index + 1,
    answer: normalizeAnswer(task?.answer),
    letter: uniqueLetters[index] || '',
    positions: positionsByLetter[uniqueLetters[index]] || [],
  }));

  if (answerKey.some((item) => !item.answer)) {
    warnings.push('У части задач нет ответа, поэтому шифровку построить нельзя.');
  }

  if (warnings.length > 0) {
    return {
      enabled: false,
      valid: false,
      warnings,
      normalizedPhrase,
      answerCells,
      answerKey,
      entries: [],
    };
  }

  const realEntries = answerKey.map((item) => ({
    answer: item.answer,
    letter: item.letter,
    positions: item.positions,
    isDecoy: false,
  }));

  const usedLetters = new Set(realEntries.map((e) => e.letter));
  const usedAnswers = new Set(realEntries.map((e) => e.answer));
  const alphabet = getAlphabet(allLetters);
  const desiredDecoys = Math.min(
    maxDecoys,
    Math.max(minDecoys, Math.ceil(realEntries.length * 0.35))
  );
  const seed = hashString(
    `${variant?.number || 0}:${normalizedPhrase}:${realEntries.map((e) => `${e.answer}:${e.letter}`).join('|')}`
  );
  const random = createSeededRandom(seed);

  const decoyLetters = shuffle(
    alphabet.split('').filter((char) => !usedLetters.has(char)),
    random
  ).slice(0, desiredDecoys);

  const decoyAnswersPool = shuffle(
    COMMON_DECOY_ANSWERS.filter((answer) => !usedAnswers.has(answer)),
    random
  );

  const decoyEntries = decoyLetters.map((letter, index) => ({
    letter,
    answer: decoyAnswersPool[index] || String(21 + index),
    positions: [],
    isDecoy: true,
  }));

  return {
    enabled: true,
    valid: true,
    warnings: [],
    normalizedPhrase,
    answerCells,
    answerKey,
    entries: shuffle([...realEntries, ...decoyEntries], random),
  };
}

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

/* ─── Настройки печатного листа ──────────────────────────────────────────────
   Лист шифровки печатается движком `components/print-sheet` (тем же, что
   входная контрольная), поэтому настройки — его же язык: формат страницы,
   колонки, поля, кегль, шапка. Хранятся вместе с шифровкой в
   `cryptograms.settings` (миграция 1784900000): «две копии на листе, узкие
   поля, 10 pt» — свойство конкретного листа, а не вкус учителя вообще.

   Шифровки, сохранённые до появления настроек, приходят без поля вовсе —
   нормализация и есть то место, где они получают печатный вид. */

export const DEFAULT_CRYPTOGRAM_SETTINGS = {
  mode: 'single',          // 'single' — A4; 'duo' — две одинаковые копии на листе
  headerMode: 'full',      // полная шапка с инструкцией / компактная строка
  columns: 2,              // колонок с задачами
  margins: 'normal',
  fontScale: 1,
  fontFamily: 'sans',
  answerStyle: 'box',      // поле ответа у задачи: none | line | box
  solutionSpace: 'none',   // место для решения: none | s | m | l | xl
  solutionFill: 'grid',
  figureSize: 'm',
  showFigures: true,
  showFooter: true,
  showStudentFields: true,
  showClassField: true,
  showTasksCount: true,
  showKey: true,           // лист ответов для учителя
  showDefinition: true,    // «Узнай: …» под строкой ответа
  eyebrow: 'Шифровка по ответам',
  subtitle: '',
  classLabel: '',
  dateLabel: '',
  duration: null,
  instruction: '',         // пусто = текст по умолчанию (CryptogramSheet)
  notes: '',
  notesTitle: 'Дополнительная информация',
  footerNote: '',
  cryptTitle: 'Шифровка по ответам',
};

/**
 * Компактный режим — не только «две копии»: на половине A4 полная шапка съела
 * бы треть высоты, поэтому вместе с форматом переключается и всё, что делает
 * лист короче. Обратный пресет возвращает канон A4.
 */
export const CRYPTOGRAM_MODE_PRESETS = {
  duo: {
    headerMode: 'compact',
    columns: 2,
    margins: 'narrow',
    fontScale: 0.9,
    answerStyle: 'box',
    solutionSpace: 'none',
    showFooter: false,
  },
  single: {
    headerMode: 'full',
    columns: 2,
    margins: 'normal',
    fontScale: 1,
    answerStyle: 'box',
    showFooter: true,
  },
};

const oneOf = (value, allowed, fallback) => (allowed.includes(value) ? value : fallback);

export function normalizeCryptogramSettings(settings = {}) {
  const d = DEFAULT_CRYPTOGRAM_SETTINGS;
  const next = { ...d, ...(settings || {}) };

  next.mode = oneOf(next.mode, ['single', 'duo'], d.mode);
  next.headerMode = oneOf(next.headerMode, ['full', 'compact'], d.headerMode);
  next.margins = oneOf(next.margins, ['normal', 'narrow'], d.margins);
  next.fontFamily = oneOf(next.fontFamily, ['sans', 'serif'], d.fontFamily);
  next.answerStyle = oneOf(next.answerStyle, ['none', 'line', 'box'], d.answerStyle);
  next.solutionSpace = oneOf(next.solutionSpace, ['none', 's', 'm', 'l', 'xl'], d.solutionSpace);
  next.solutionFill = oneOf(next.solutionFill, ['blank', 'lines', 'grid'], d.solutionFill);
  next.figureSize = oneOf(next.figureSize, ['s', 'm', 'l', 'xl'], d.figureSize);
  next.columns = next.columns === 1 ? 1 : 2;
  next.fontScale = Number(next.fontScale) > 0 ? Number(next.fontScale) : d.fontScale;
  next.duration = Number(next.duration) > 0 ? Number(next.duration) : null;

  ['showFigures', 'showFooter', 'showStudentFields', 'showClassField',
    'showTasksCount', 'showKey', 'showDefinition'].forEach((key) => {
    next[key] = next[key] !== false;
  });

  ['eyebrow', 'subtitle', 'classLabel', 'dateLabel', 'instruction', 'notes',
    'notesTitle', 'footerNote', 'cryptTitle'].forEach((key) => {
    next[key] = String(next[key] ?? '');
  });

  return next;
}

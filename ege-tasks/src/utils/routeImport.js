/**
 * Импорт и экспорт готового маршрута текстом (`.md`).
 *
 * Зачем: маршрут — это не набор задач из банка, а цепочка, где ответ каждой
 * задачи живёт в условии следующей. Такую цепочку удобно получить от коллеги
 * одним файлом или попросить у внешней модели по нашему промпту — своей
 * ИИ-ручки для этого сознательно не заводим (то же решение, что в «Импорте
 * работы»: `utils/workImportFormat.js`).
 *
 * Формат намеренно повторяет «Импорт работы»: YAML-шапка, задачи заголовками
 * `### N`, метастрока «ответ:» СРАЗУ под заголовком и ДО условия. Так граница
 * условия однозначна, и внутри него можно писать что угодно — хоть строку,
 * начинающуюся со слова «Ответ:».
 *
 * Разбор чистый: без React, без сети, без обращений к базе.
 */

import { CIRCLE_NUMBERS, circleNum, chainIssues } from './routeSheet';

// ── Шапка ────────────────────────────────────────────────────────────────────
const HEAD_KEYS = {
  'маршрут': 'title',
  'route': 'title',
  'название': 'title',
  'title': 'title',
  'класс': 'classNumber',
  'class': 'classNumber',
  'тема': 'topic',
  'topic': 'topic',
};

// ── Метастроки задачи ────────────────────────────────────────────────────────
const TASK_KEYS = {
  'ответ': 'answer',
  'answer': 'answer',
};

const TASK_HEAD_RE = /^#{2,4}\s*(\d{1,2})\s*\.?\s*$/;
const FRONTMATTER_RE = /^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/;

/**
 * Плейсхолдеры в человеческой записи → кружковые цифры.
 *
 * Модель (да и человек) пишет `[1]`, `[#1]`, `[№1]` заметно чаще, чем `[①]`:
 * кружковую цифру ещё надо где-то взять. Приводим их к нашему виду здесь, один
 * раз на входе, — дальше по коду живёт только `[①]`.
 *
 * `(1)` намеренно НЕ трогаем: в условиях это обычная скобка с числом.
 */
export function normalizePlaceholders(text) {
  return String(text || '').replace(/\[\s*[#№]?\s*(\d{1,2})\s*\]/g, (full, digits) => {
    const idx = Number(digits) - 1;
    return idx >= 0 && idx < CIRCLE_NUMBERS.length ? `[${circleNum(idx)}]` : full;
  });
}

function parseFrontmatter(raw) {
  const m = raw.match(FRONTMATTER_RE);
  if (!m) return { meta: {}, rest: raw };

  const meta = {};
  m[1].split('\n').forEach((line) => {
    const idx = line.indexOf(':');
    if (idx === -1) return;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    const field = HEAD_KEYS[key];
    if (field && value) meta[field] = value;
  });
  return { meta, rest: raw.slice(m[0].length) };
}

/**
 * Разобрать маршрут из markdown.
 *
 * @returns {{title: string, classNumber: number|null, tasks: Array,
 *            errors: string[], warnings: string[]}}
 *   `errors` блокируют импорт, `warnings` — нет (их учитель может принять
 *   осознанно: например, лист без ответов печатается, просто ключ будет пустым).
 */
export function parseRouteMarkdown(raw) {
  const errors = [];
  const warnings = [];
  const text = normalizePlaceholders(String(raw || '').replace(/\r\n?/g, '\n'));

  const { meta, rest } = parseFrontmatter(text);

  const lines = rest.split('\n');
  const blocks = [];
  let current = null;

  lines.forEach((line) => {
    const head = line.match(TASK_HEAD_RE);
    if (head) {
      current = { number: Number(head[1]), metaLines: [], body: [], metaDone: false };
      blocks.push(current);
      return;
    }
    if (!current) return;

    // Метастроки идут сплошным блоком сразу под заголовком; первая же строка
    // условия закрывает их навсегда — иначе «ответ:» внутри текста задачи
    // утащил бы кусок условия в поле ответа.
    if (!current.metaDone) {
      if (!line.trim()) {
        if (current.metaLines.length) current.metaDone = true;
        return;
      }
      const idx = line.indexOf(':');
      const key = idx > 0 ? line.slice(0, idx).trim().toLowerCase() : null;
      if (key && TASK_KEYS[key]) {
        current.metaLines.push([TASK_KEYS[key], line.slice(idx + 1).trim()]);
        return;
      }
      current.metaDone = true;
    }
    current.body.push(line);
  });

  if (!blocks.length) {
    errors.push('Не найдено ни одной задачи. Заголовок задачи — строка «### 1».');
    return { title: meta.title || '', classNumber: null, tasks: [], errors, warnings };
  }

  const tasks = blocks.map((block) => {
    const fields = Object.fromEntries(block.metaLines);
    return {
      number: block.number,
      statement_md: block.body.join('\n').trim(),
      answer: (fields.answer || '').trim(),
    };
  });

  tasks.forEach((task, i) => {
    if (!task.statement_md) errors.push(`Задача ${i + 1}: пустое условие.`);
    if (!task.answer) warnings.push(`Задача ${i + 1}: нет строки «ответ:» — в ключе будет прочерк.`);
  });

  // Нумерация в файле — подсказка для человека, порядок берём по факту. Но если
  // она сбита, цепочка почти наверняка собрана не так, как задумано: номер в
  // плейсхолдере ссылается именно на неё.
  const expected = tasks.map((_, i) => i + 1);
  const actual = tasks.map(t => t.number);
  if (actual.join(',') !== expected.join(',')) {
    warnings.push(
      `Нумерация задач в файле — ${actual.join(', ')}; читаю по порядку как ${expected.join(', ')}. `
      + 'Проверьте, на те ли задачи ссылаются номера в условиях.',
    );
  }

  if (tasks.length > CIRCLE_NUMBERS.length) {
    errors.push(`Задач больше ${CIRCLE_NUMBERS.length} — столько кружковых номеров не бывает.`);
  }

  // Разрывы самой цепочки считает тот же разбор, что и в редакторе листа.
  warnings.push(...chainIssues(tasks).filter(t => !t.includes('не задан ответ')));

  const classNumber = meta.classNumber ? Number(String(meta.classNumber).replace(/\D+/g, '')) : null;

  return {
    title: meta.title || '',
    classNumber: Number.isFinite(classNumber) && classNumber > 0 ? classNumber : null,
    tasks,
    errors,
    warnings,
  };
}

/**
 * Собрать маршрут обратно в markdown — обмен листами с коллегой и бэкап цепочки
 * текстом. Разбирается своим же `parseRouteMarkdown` (сторожит тест).
 */
export function buildRouteMarkdown({ title, classNumber, tasks = [] }) {
  const head = ['---', `маршрут: ${title || 'Маршрутный лист'}`];
  if (classNumber) head.push(`класс: ${classNumber}`);
  head.push('---', '');

  const body = tasks.flatMap((task, i) => {
    const block = [`### ${i + 1}`];
    if (task.answer) block.push(`ответ: ${task.answer}`);
    block.push('', String(task.statement_md || '').trim(), '');
    return block;
  });

  return [...head, ...body].join('\n').trimEnd() + '\n';
}

/** Имя файла для выгрузки маршрута. */
export function routeMarkdownFilename(title) {
  const base = String(title || 'marshrut').trim().replace(/[\\/:*?"<>|]+/g, '').slice(0, 60);
  return `${base || 'marshrut'}.md`;
}

/**
 * Промпт для внешней модели. Своей ИИ-ручки под разбор фото нет намеренно —
 * учитель копирует это в любую модель вместе с фотографией листка и вставляет
 * результат обратно.
 */
export function buildRouteAiPrompt({ classNumber = null, topic = '', length = 4 } = {}) {
  const circles = CIRCLE_NUMBERS.slice(0, 6).join(' ');
  return [
    'Ты помогаешь собрать «маршрутный лист» по математике — цепочку задач, где ответ каждой задачи',
    'подставляется в условие следующей.',
    '',
    'Верни ОДИН markdown-файл строго по формату ниже. Без пояснений до и после, без ```-ограждений.',
    '',
    '=== ФОРМАТ ===',
    '',
    '---',
    'маршрут: <название>',
    `класс: <число>${classNumber ? ` (здесь: ${classNumber})` : ''}`,
    '---',
    '',
    '### 1',
    'ответ: <точный ответ первой задачи>',
    '',
    '<условие первой задачи>',
    '',
    '### 2',
    'ответ: <точный ответ второй задачи>',
    '',
    '<условие, в котором вместо ответа задачи 1 стоит [1]>',
    '',
    '=== ПРАВИЛА ===',
    '',
    '1. Метастрока «ответ:» идёт СРАЗУ под заголовком «### N» и ДО условия. После условия её писать нельзя.',
    '2. Место подстановки ответа задачи N обозначай [N] — в квадратных скобках, номер задачи-источника.',
    `   Кружковые цифры (${circles}) тоже подойдут. Обычные скобки (1) для этого НЕ используй.`,
    '3. Задача 1 ни на кого не ссылается. Каждая следующая обязана использовать хотя бы один предыдущий ответ,',
    '   и ссылаться можно ТОЛЬКО назад — на задачу с меньшим номером.',
    '4. В поле «ответ:» — конкретное число, посчитанное с РЕАЛЬНЫМИ значениями предыдущих ответов, а не с [N].',
    '5. Ответ обязан быть точным: целое число или простая дробь (1/3, 2.5). Никаких округлений и корней',
    '   из неквадратных чисел — если приём даёт такой ответ, подбери другие числа.',
    '6. Не нумеруй задачи внутри условия: номер печатает сам лист.',
    '7. Формулы — LaTeX внутри $…$ (KaTeX): \\frac{a}{b}, \\sqrt{x}, x^{2}, x_{0}. Десятичная запятая — $0{,}5$.',
    '8. Проверь цепочку перед выдачей: подставь ответы и пересчитай каждую задачу.',
    '',
    '=== ЗАДАНИЕ ===',
    '',
    `Составь цепочку из ${length} задач${topic ? ` по теме «${topic}»` : ''}${classNumber ? ` для ${classNumber} класса` : ''}.`,
    'Если к этому сообщению приложено фото листка — перенеси в формат задачи с него, ничего не придумывая.',
  ].join('\n');
}

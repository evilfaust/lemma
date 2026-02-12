import yaml from 'js-yaml';

const TAG_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
  '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B500', '#52BE80',
];

/**
 * Преобразует математические обозначения РЕШУ ЕГЭ в LaTeX.
 * Примеры:
 * - "косинусальфа = минус дробь: числитель: 1, знаменатель: корень из: 10"
 *   -> "$\\cos\\alpha = -\\frac{1}{\\sqrt{10}}$"
 * - "синусальфа = минус дробь: числитель: 5, знаменатель: корень из: 26"
 *   -> "$\\sin\\alpha = -\\frac{5}{\\sqrt{26}}$"
 */
export function convertToLatex(text) {
  if (!text || typeof text !== 'string') return text;

  let result = text;

  // Шаг 1: Удаляем "конец дроби" - это артефакт парсинга
  result = result.replace(/\s*конец\s+дроби/gi, '');

  // Шаг 2: Тригонометрические функции (склеенные с альфа)
  result = result.replace(/косинусальфа/gi, '\\cos\\alpha');
  result = result.replace(/синусальфа/gi, '\\sin\\alpha');
  result = result.replace(/тангенсальфа/gi, '\\tan\\alpha');
  result = result.replace(/котангенсальфа/gi, '\\cot\\alpha');

  // Шаг 3: Тригонометрические функции с пробелом
  result = result.replace(/косинус\s+альфа/gi, '\\cos\\alpha');
  result = result.replace(/синус\s+альфа/gi, '\\sin\\alpha');
  result = result.replace(/тангенс\s+альфа/gi, '\\tan\\alpha');
  result = result.replace(/котангенс\s+альфа/gi, '\\cot\\alpha');

  // Шаг 4: Простые тригонометрические функции
  result = result.replace(/\bкосинус\b/gi, '\\cos');
  result = result.replace(/\bсинус\b/gi, '\\sin');
  result = result.replace(/\bтангенс\b/gi, '\\tan');
  result = result.replace(/\bкотангенс\b/gi, '\\cot');

  // Шаг 5: Pi с числами (до греческих букв!)
  result = result.replace(/(\d+)\s*Пи/gi, '$1\\pi');

  // Шаг 6: Греческие буквы
  result = result.replace(/\bальфа\b/gi, '\\alpha');
  result = result.replace(/\bбета\b/gi, '\\beta');
  result = result.replace(/\bгамма\b/gi, '\\gamma');
  result = result.replace(/\bдельта\b/gi, '\\delta');
  result = result.replace(/\bпи\b/gi, '\\pi');

  // Шаг 7: Корни (до дробей!)
  result = result.replace(/корень\s+из:\s*(\d+)/gi, '\\sqrt{$1}');
  result = result.replace(/квадратный\s+корень\s+из:\s*(\d+)/gi, '\\sqrt{$1}');

  // Шаг 8: Дроби формата "дробь: числитель: X, знаменатель: Y"
  let maxIterations = 10;
  let iteration = 0;
  while (/дробь:/i.test(result) && iteration < maxIterations) {
    // Паттерн: числитель до запятой, знаменатель до пробела/скобки/конца
    const fractionPattern = /дробь:\s*числитель:\s*([^,]+?),\s*знаменатель:\s*([^\s\)\.]+)/i;
    const match = result.match(fractionPattern);

    if (!match) {
      // Альтернативный паттерн без запятой
      const altPattern = /дробь:\s*числитель:\s*(.+?)\s+знаменатель:\s*(.+?)(?=\s|$|\.|\))/i;
      const altMatch = result.match(altPattern);
      if (!altMatch) break;

      const numerator = altMatch[1].trim().replace(/[,\.;]+$/, '');
      const denominator = altMatch[2].trim().replace(/[,\.;]+$/, '');
      const latexFraction = `\\frac{${numerator}}{${denominator}}`;
      result = result.substring(0, altMatch.index) + latexFraction + result.substring(altMatch.index + altMatch[0].length);
    } else {
      const numerator = match[1].trim().replace(/[,\.;]+$/, '');
      const denominator = match[2].trim().replace(/[,\.;]+$/, '');
      const latexFraction = `\\frac{${numerator}}{${denominator}}`;
      result = result.substring(0, match.index) + latexFraction + result.substring(match.index + match[0].length);
    }

    iteration++;
  }

  // Шаг 9: Степени
  result = result.replace(/(\d+)\s+в\s+степени\s+\(?\s*(\d+)\s*\)?/gi, '$1^{$2}');
  result = result.replace(/(\w+)\s+в\s+степени\s+\(?\s*(\d+)\s*\)?/gi, '$1^{$2}');

  // Шаг 10: Минус и арифметические операции
  result = result.replace(/\s+минус\s+/gi, ' -');
  result = result.replace(/\s+плюс\s+/gi, ' + ');
  result = result.replace(/\s+умножить\s+на\s+/gi, ' \\cdot ');

  // Шаг 11: Специальные слова
  result = result.replace(/иальфаприналлежит/gi, ' и $\\alpha \\in$');
  result = result.replace(/и\s+альфа\s+прина[лд]+[еж]+ит/gi, ' и $\\alpha \\in$');
  result = result.replace(/\bприналлежит\b/gi, '\\in');

  // Шаг 12: Очистка лишних пробелов
  result = result.replace(/\s+/g, ' ').trim();

  // Шаг 13: Оборачиваем математику в $...$
  // Находим последовательные математические символы и оборачиваем их
  if (/\\/.test(result)) {
    // Паттерн для поиска математических выражений (включая вложенные фигурные скобки)
    // Ищем последовательности с LaTeX командами
    const mathExpressionPattern = /([^\s]*\\[a-zA-Z]+(?:\{[^}]*\})*[^\s]*(?:\s+[^\s]*\\[a-zA-Z]+(?:\{[^}]*\})*[^\s]*)*)/g;

    result = result.replace(mathExpressionPattern, (match) => {
      // Если уже обёрнуто, не оборачиваем снова
      if (match.startsWith('$') && match.endsWith('$')) {
        return match;
      }
      return `$${match}$`;
    });
  }

  return result;
}

/**
 * Парсит строку тегов в массив строк.
 * Поддерживает: "тег", "тег1, тег2", "[тег1, тег2]", массив
 */
export function parseTags(tagsInput) {
  if (!tagsInput) return [];

  if (Array.isArray(tagsInput)) {
    return tagsInput.map(t => String(t).trim()).filter(Boolean);
  }

  if (typeof tagsInput === 'string') {
    let str = tagsInput.trim();
    if (str.startsWith('[') && str.endsWith(']')) {
      str = str.slice(1, -1);
    }
    return str.split(',').map(t => t.trim()).filter(Boolean);
  }

  return [];
}

/**
 * Извлекает YAML frontmatter из markdown текста.
 * Возвращает { metadata, content } где content — текст без YAML-блока.
 */
export function parseYamlFrontmatter(text) {
  const yamlMatch = text.match(/^---\s*\n(.*?)\n---/s);
  if (!yamlMatch) {
    return { metadata: null, content: text };
  }

  try {
    const metadata = yaml.load(yamlMatch[1]);
    const content = text.slice(yamlMatch[0].length).trim();
    return { metadata: metadata || {}, content };
  } catch (e) {
    return { metadata: null, content: text, yamlError: e.message };
  }
}

/**
 * Определяет формат файла: 'ege' или 'mordkovich'.
 * Мордкович: **043.9a** [2] — с точкой и буквами
 * ЕГЭ: **1** [1] — просто число
 */
export function detectFormat(content) {
  const mordkovichPattern = /\*\*\d{2,3}\.\d+[a-zа-я]?\*\*/;
  if (mordkovichPattern.test(content)) {
    return 'mordkovich';
  }
  return 'ege';
}

/**
 * Парсит задачи в формате ЕГЭ (pb_parser.py).
 * Формат: **номер** [сложность] текст условия
 *         ответ: ответ
 *         tags: [тег1, тег2]
 */
export function parseEgeTasks(content, metadata) {
  // Убираем заголовки markdown
  let cleaned = content.replace(/^#{1,3}.*$/gm, '');

  const lines = cleaned.split('\n');
  const tasks = [];
  let currentTask = null;
  let currentStatement = [];
  let inStatement = false;
  const defaultDifficulty = String(metadata.difficulty || '1');

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // Пропускаем пустые строки вне условия
    if (!line && !inStatement) continue;

    // Начало нового задания: **номер** [сложность] текст
    const match = line.match(/^\*\*(\d+)\*\*\s+\[(\d+)\]\s+(.*)$/);
    if (match) {
      // Сохраняем предыдущее задание
      if (currentTask && currentStatement.length > 0) {
        currentTask.statement_md = currentStatement.join('\n').trim();
        tasks.push(currentTask);
      }

      const number = parseInt(match[1], 10);
      const difficulty = match[2];
      let firstLine = match[3].trim();
      let imageUrl = '';

      // Проверяем изображение в первой строке
      const imgMatch = firstLine.match(/!\[image\]\((https?:\/\/[^)]+)\)/);
      if (imgMatch) {
        imageUrl = imgMatch[1];
        firstLine = firstLine.replace(/!\[image\]\(https?:\/\/[^)]+\)/, '').trim();
      }

      currentTask = {
        number,
        difficulty: difficulty || defaultDifficulty,
        answer: '',
        tags: [],
        imageUrl,
      };
      currentStatement = firstLine ? [firstLine] : [];
      inStatement = true;
      continue;
    }

    // Строка с ответом
    if (line.toLowerCase().startsWith('ответ:')) {
      if (currentTask) {
        currentTask.answer = line.replace(/^ответ:\s*/i, '').trim();
        inStatement = false;
      }
      continue;
    }

    // Строка с тегами задачи
    if (line.toLowerCase().startsWith('tags:')) {
      if (currentTask) {
        const tagsStr = line.replace(/^tags:\s*/i, '').trim();
        currentTask.tags = parseTags(tagsStr);
      }
      continue;
    }

    // Собираем строки условия
    if (inStatement && line) {
      // Проверяем изображение
      const imgMatch = line.match(/!\[image\]\((https?:\/\/[^)]+)\)/);
      if (imgMatch && currentTask) {
        currentTask.imageUrl = imgMatch[1];
        const cleanedLine = line.replace(/!\[image\]\(https?:\/\/[^)]+\)/, '').trim();
        if (cleanedLine) currentStatement.push(cleanedLine);
      } else {
        currentStatement.push(line);
      }
    }
  }

  // Сохраняем последнее задание
  if (currentTask && currentStatement.length > 0) {
    currentTask.statement_md = currentStatement.join('\n').trim();
    tasks.push(currentTask);
  }

  // Применяем преобразование в LaTeX
  tasks.forEach(task => {
    task.statement_md = convertToLatex(task.statement_md);
    task.answer = convertToLatex(task.answer);
  });

  return tasks;
}

/**
 * Парсит задачи в формате Мордковича (pb_parser_mordkovich.py).
 * Формат: **043.9a** [2]
 *         текст условия
 *         Ответ: ответ
 *         tags: [тег1, тег2]
 */
export function parseMordkovichTasks(content, metadata) {
  // Убираем заголовки markdown
  let cleaned = content.replace(/^#{1,3}.*$/gm, '');

  const lines = cleaned.split('\n');
  const tasks = [];
  let currentTask = null;
  let currentStatement = [];
  let inStatement = false;
  const defaultDifficulty = String(metadata.difficulty || '1');

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line && !inStatement) continue;

    // Начало задания: **043.9a** [2] или **043.9a** (без сложности)
    const match = line.match(/^\*\*(\d{2,3})\.(\d+)([a-zа-я]?)\*\*\s*(?:\[(\d+)\])?\s*(.*)$/);
    if (match) {
      // Сохраняем предыдущее задание
      if (currentTask && currentStatement.length > 0) {
        currentTask.statement_md = currentStatement.join('\n').trim();
        tasks.push(currentTask);
      }

      const paragraph = match[1];
      const taskNumber = match[2];
      const letter = match[3] || '';
      const difficulty = match[4] || defaultDifficulty;
      let firstLine = (match[5] || '').trim();

      const fullNumber = `${paragraph}.${taskNumber}${letter}`;

      currentTask = {
        number: fullNumber,
        paragraphNum: paragraph,
        taskNumber,
        letter,
        difficulty,
        answer: '',
        tags: [],
        imageUrl: '',
      };

      currentStatement = firstLine ? [firstLine] : [];
      inStatement = true;
      continue;
    }

    // Строка с ответом (Ответ: или ответ:)
    if (/^ответ:\s*/i.test(line)) {
      if (currentTask) {
        currentTask.answer = line.replace(/^ответ:\s*/i, '').trim();
        inStatement = false;
      }
      continue;
    }

    // Строка с тегами
    if (line.toLowerCase().startsWith('tags:')) {
      if (currentTask) {
        const tagsStr = line.replace(/^tags:\s*/i, '').trim();
        currentTask.tags = parseTags(tagsStr);
      }
      continue;
    }

    // Собираем строки условия
    if (inStatement && line) {
      const imgMatch = line.match(/!\[image\]\((https?:\/\/[^)]+)\)/);
      if (imgMatch && currentTask) {
        currentTask.imageUrl = imgMatch[1];
        const cleanedLine = line.replace(/!\[image\]\(https?:\/\/[^)]+\)/, '').trim();
        if (cleanedLine) currentStatement.push(cleanedLine);
      } else {
        currentStatement.push(line);
      }
    }
  }

  // Сохраняем последнее задание
  if (currentTask && currentStatement.length > 0) {
    currentTask.statement_md = currentStatement.join('\n').trim();
    tasks.push(currentTask);
  }

  // Применяем преобразование в LaTeX
  tasks.forEach(task => {
    task.statement_md = convertToLatex(task.statement_md);
    task.answer = convertToLatex(task.answer);
  });

  return tasks;
}

/**
 * Главная точка входа парсинга.
 * Принимает текст markdown файла, возвращает структурированные данные.
 */
export function parseMarkdownFile(text) {
  const errors = [];
  const warnings = [];

  // 1. Парсим YAML
  const { metadata, content, yamlError } = parseYamlFrontmatter(text);

  if (yamlError) {
    errors.push(`Ошибка парсинга YAML: ${yamlError}`);
    return { metadata: {}, format: null, tasks: [], errors, warnings };
  }

  if (!metadata) {
    errors.push('YAML-блок не найден. Файл должен начинаться с --- ... ---');
    return { metadata: {}, format: null, tasks: [], errors, warnings };
  }

  if (!metadata.topic) {
    errors.push('Поле "topic" обязательно в YAML-блоке');
  }

  // 2. Определяем формат
  const format = detectFormat(content);

  // 3. Глобальные теги из YAML
  const globalTags = parseTags(metadata.tags);

  // 4. Парсим задачи
  let tasks;
  if (format === 'mordkovich') {
    tasks = parseMordkovichTasks(content, metadata);
  } else {
    tasks = parseEgeTasks(content, metadata);
  }

  // 5. Объединяем глобальные теги с тегами задач
  tasks.forEach(task => {
    if (globalTags.length > 0) {
      const allTags = [...new Set([...globalTags, ...task.tags])];
      task.tags = allTags;
    }
  });

  // 6. Валидация задач
  tasks.forEach((task, i) => {
    if (!task.statement_md || !task.statement_md.trim()) {
      errors.push(`Задание #${task.number}: пустое условие`);
    }
    if (!task.answer || !task.answer.trim()) {
      warnings.push(`Задание #${task.number}: нет ответа`);
    }
  });

  if (tasks.length === 0 && errors.length === 0) {
    errors.push('Задания не найдены в файле. Проверьте формат: **номер** [сложность] текст');
  }

  return {
    metadata: {
      topic: metadata.topic || '',
      subtopic: metadata.subtopic || '',
      difficulty: String(metadata.difficulty || '1'),
      source: metadata.source || '',
      year: metadata.year || null,
      tags: globalTags,
    },
    format,
    tasks,
    errors,
    warnings,
  };
}

/**
 * Конвертирует результат парсинга sdamgia.ru в формат, совместимый с useTaskImport.
 * @param {Array} problems — массив от сервера: [{ id, condition, answer, images }]
 * @param {Object} metadata — метаданные из формы UI: { taskNumber, subtopic, difficulty, tagsStr }
 */
export function parseSdamgiaResult(problems, metadata = {}) {
  const errors = [];
  const warnings = [];
  const difficulty = String(metadata.difficulty || '1');
  const globalTags = parseTags(metadata.tagsStr);
  const taskNumber = metadata.taskNumber || '';
  const topicName = taskNumber ? `ЕГЭ-База №${taskNumber}` : '';

  const tasks = problems.map((problem, index) => {
    // Применяем преобразование в LaTeX к условию и ответу
    const statement = convertToLatex((problem.condition || '').trim());
    const answer = convertToLatex((problem.answer || '').trim());

    const task = {
      number: index + 1,
      difficulty,
      statement_md: statement,
      answer: answer,
      tags: [...globalTags],
      imageUrl: '',
      sdamgiaId: problem.id || '',
    };

    // Первое изображение из списка
    if (problem.images && problem.images.length > 0) {
      task.imageUrl = problem.images[0];
    }

    // Валидация
    if (!task.statement_md) {
      errors.push(`Задание #${task.number}: пустое условие`);
    }
    if (!task.answer) {
      warnings.push(`Задание #${task.number}: нет ответа`);
    }

    return task;
  });

  if (tasks.length === 0 && errors.length === 0) {
    errors.push('Задачи не найдены на странице');
  }

  return {
    metadata: {
      topic: topicName,
      subtopic: metadata.subtopic || '',
      difficulty,
      source: 'РЕШУ ЕГЭ — математика базовая',
      year: new Date().getFullYear(),
      tags: globalTags,
    },
    format: 'sdamgia',
    tasks,
    errors,
    warnings,
  };
}

/**
 * Возвращает случайный цвет для нового тега.
 */
export function getRandomTagColor() {
  return TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)];
}

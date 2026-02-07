import yaml from 'js-yaml';

const TAG_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
  '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B500', '#52BE80',
];

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
    const task = {
      number: index + 1,
      difficulty,
      statement_md: (problem.condition || '').trim(),
      answer: (problem.answer || '').trim(),
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

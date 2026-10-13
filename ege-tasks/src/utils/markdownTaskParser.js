import yaml from 'js-yaml';
import { checkDrawingBlocks } from './workImportDrawings';

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
 * Определяет, нужно ли применять legacy-конвертацию текста в LaTeX.
 * Если в тексте уже есть LaTeX/Markdown-разметка, конвертацию пропускаем.
 * «пи» — только отдельным словом (или после цифры: «2Пи»): иначе срабатывали
 * «пирамида», «запишите», «типа».
 */
function shouldConvertLegacyMath(text) {
  if (!text) return false;
  if (/\\[a-zA-Z]+/.test(text) || /\$/.test(text) || /!\[[^\]]*]\([^)]+\)/.test(text) || /\|.*\|/.test(text)) {
    return false;
  }
  return /(дробь:|числитель:|знаменатель:|корень\s+из|косинус|синус|тангенс|котангенс|альфа|бета|гамма|дельта|(?<![а-яё])пи(?![а-яё]))/i.test(text);
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

// ── Нумерованные задачи (форматы ЕГЭ и Мордковича) ───────────────────────────

/** Строка открывает/закрывает fenced-блок (```planim, ```stereo, ```plot…). */
const FENCE_RE = /^\s*(`{3,}|~{3,})/;
/** Картинка markdown с внешним адресом (+ необязательный размер {S|M|L|XL}). */
const IMAGE_RE = /!\[[^\]]*]\((https?:\/\/[^)\s]+)\)(?:\{(?:S|M|L|XL)\})?/i;

/**
 * Legacy-конвертация «словесной» математики РЕШУ — только в обычном тексте:
 * fenced-блоки (чертежи нашими редакторами) и `инлайн-код` не трогаются,
 * переводы строк сохраняются (convertToLatex схлопывает пробелы в строке).
 */
export function convertLegacyMath(text) {
  if (!text || typeof text !== 'string') return text;
  const lines = text.split('\n');
  const prose = [];
  let fence = null;
  for (const line of lines) {
    const m = line.match(FENCE_RE);
    if (m) {
      if (!fence) fence = m[1];
      else if (m[1][0] === fence[0] && m[1].length >= fence.length) fence = null;
      continue;
    }
    if (!fence) prose.push(line.replace(/`[^`]*`/g, ''));
  }
  if (!shouldConvertLegacyMath(prose.join('\n'))) return text;

  fence = null;
  return lines.map((line) => {
    const m = line.match(FENCE_RE);
    if (m) {
      if (!fence) fence = m[1];
      else if (m[1][0] === fence[0] && m[1].length >= fence.length) fence = null;
      return line;
    }
    if (fence || !line.trim() || /`/.test(line)) return line;
    return convertToLatex(line);
  }).join('\n');
}

/** Пустые строки по краям убираются, тройные переводы строк схлопываются. */
function joinStatement(lines) {
  const out = [...lines];
  while (out.length && !out[0].trim()) out.shift();
  while (out.length && !out[out.length - 1].trim()) out.pop();
  return out.join('\n').replace(/\n{3,}/g, '\n\n');
}

/**
 * Общий разбор нумерованных задач: строка-заголовок задачи, строки условия,
 * «ответ:», «tags:». Внутри fenced-блока (```planim, ```stereo, ```plot,
 * ```chart, ```numline, ```grid…) строки идут в условие как есть — с отступами,
 * пустыми строками и комментариями `#`: служебные строки там не ищутся.
 * Пустые строки между абзацами условия сохраняются (иначе «а) …» и «б) …»
 * склеивались в один абзац).
 *
 * Картинка уходит в поле imageUrl (её скачает импорт), только если это первая
 * картинка задачи и она стоит в строке-заголовке или одна в своей строке;
 * картинки в таблицах (галереи «на каком рисунке…») и в тексте остаются в
 * условии — иначе таблица теряла первую клетку.
 */
function parseNumberedTasks(content, { header, makeTask }) {
  const tasks = [];
  let task = null;
  let statement = [];
  let inStatement = false;
  let fence = null;

  const flush = () => {
    if (!task) return;
    task.statement_md = joinStatement(statement);
    if (task.statement_md) tasks.push(task);
    task = null;
  };

  const takeImage = (line, wholeLine) => {
    if (task.imageUrl || /^\s*\|/.test(line)) return line;
    const m = line.match(IMAGE_RE);
    if (!m) return line;
    const rest = line.replace(IMAGE_RE, '').trim();
    if (!wholeLine && rest) return line;
    task.imageUrl = m[1];
    return rest;
  };

  for (const rawLine of content.split(/\r?\n/)) {
    const fenceMatch = rawLine.match(FENCE_RE);

    if (fence) {
      // Заголовок следующей задачи внутри блока — блок забыли закрыть:
      // закрываем сами, иначе все дальнейшие задачи ушли бы в этот чертёж.
      if (header.test(rawLine.trim())) {
        if (task && inStatement) {
          statement.push(fence);
          task.unclosedFence = true;
        }
        fence = null;
      } else {
        if (fenceMatch && fenceMatch[1][0] === fence[0] && fenceMatch[1].length >= fence.length) fence = null;
        if (task && inStatement) statement.push(rawLine.replace(/\s+$/, ''));
        continue;
      }
    }

    if (fenceMatch) {
      fence = fenceMatch[1];
      if (task && inStatement) statement.push(rawLine.trim());
      continue;
    }

    const line = rawLine.trim();

    // Заголовки markdown («# Раздел») вне блоков — разметка файла, не условие
    if (/^#/.test(line)) continue;

    const head = line.match(header);
    if (head) {
      flush();
      task = makeTask(head);
      const first = takeImage((task.firstLine || '').trim(), true);
      delete task.firstLine;
      statement = first ? [first] : [];
      inStatement = true;
      continue;
    }

    if (!task) continue;

    if (/^ответ:/i.test(line)) {
      task.answer = line.replace(/^ответ:\s*/i, '').trim();
      inStatement = false;
      continue;
    }

    if (/^tags:/i.test(line)) {
      task.tags = parseTags(line.replace(/^tags:\s*/i, '').trim());
      continue;
    }

    if (!inStatement) continue;
    if (!line) {
      statement.push('');
      continue;
    }
    const kept = takeImage(line, false);
    if (kept) statement.push(kept);
  }
  if (fence && task && inStatement) {
    statement.push(fence);
    task.unclosedFence = true;
  }
  flush();

  tasks.forEach((t) => {
    t.statement_md = convertLegacyMath(t.statement_md);
    t.answer = convertLegacyMath(t.answer);
  });
  return tasks;
}

/**
 * Парсит задачи в формате ЕГЭ (pb_parser.py).
 * Формат: **номер** [сложность] текст условия
 *         ответ: ответ
 *         tags: [тег1, тег2]
 * Условие может начинаться со следующей строки и содержать блоки чертежей.
 */
export function parseEgeTasks(content, metadata) {
  const defaultDifficulty = String(metadata.difficulty || '1');
  return parseNumberedTasks(content, {
    header: /^\*\*(\d+)\*\*\s*\[(\d+)\]\s*(.*)$/,
    makeTask: (m) => ({
      number: parseInt(m[1], 10),
      difficulty: m[2] || defaultDifficulty,
      answer: '',
      tags: [],
      imageUrl: '',
      firstLine: m[3],
    }),
  });
}

/**
 * Парсит задачи в формате Мордковича (pb_parser_mordkovich.py).
 * Формат: **043.9a** [2]
 *         текст условия
 *         Ответ: ответ
 *         tags: [тег1, тег2]
 */
export function parseMordkovichTasks(content, metadata) {
  const defaultDifficulty = String(metadata.difficulty || '1');
  return parseNumberedTasks(content, {
    // Начало задания: **043.9a** [2] или **043.9a** (без сложности)
    header: /^\*\*(\d{2,3})\.(\d+)([a-zа-я]?)\*\*\s*(?:\[(\d+)\])?\s*(.*)$/,
    makeTask: (m) => ({
      number: `${m[1]}.${m[2]}${m[3] || ''}`,
      paragraphNum: m[1],
      taskNumber: m[2],
      letter: m[3] || '',
      difficulty: m[4] || defaultDifficulty,
      answer: '',
      tags: [],
      imageUrl: '',
      firstLine: m[5] || '',
    }),
  });
}

/**
 * Парсер MD-файла в формате sdamgia (расширенный, v3.9.33+).
 * Маркер: `format: sdamgia` в YAML-frontmatter.
 *
 * Структура одной задачи:
 *   ## №<sdamgia_id> [сложность]
 *   - sdamgia_url: ...
 *   - exam_part: 1|2
 *   - max_score: N
 *   - latex_needs_review: true|false
 *
 *   ### Условие
 *   ...текст с LaTeX и ![image](url)...
 *
 *   ### Ответ
 *   ...
 *
 *   ### Решение
 *   ...
 *
 *   ### Критерии
 *   | ... | ... |
 *
 *   ### Картинки
 *   **Условие:** список URL с метаданными в HTML-комментариях
 *   **Решение:**  ...
 *   **Критерии:** ...
 */
export function parseSdamgiaMd(content, metadata) {
  const errors = [];
  const warnings = [];
  const globalTags = parseTags(metadata.tags);
  const defaultDifficulty = String(metadata.difficulty || '1');
  const defaultExamPart = Number(metadata.exam_part) || 1;

  // Убираем HTML-комментарии за пределами картинок (внутри картинок они несут метаданные)
  // Поэтому удаляем только многострочные top-level комментарии.
  const cleaned = content.replace(/<!--[^>]*?Формат:[\s\S]*?-->/g, '');

  // Разбиваем на блоки по маркеру `## №`
  const blocks = cleaned.split(/\n(?=##\s*№)/);
  const tasks = [];
  let index = 0;

  const parseImagesByRole = (block, label) => {
    const re = new RegExp(`\\*\\*${label}:\\*\\*\\s*\\n([\\s\\S]*?)(?=\\n\\*\\*[А-Я]|$)`, 'i');
    const m = block.match(re);
    if (!m) return [];
    const items = [];
    for (const line of m[1].split('\n')) {
      const lm = line.match(/^\s*-\s*(\S+)(?:\s*<!--\s*([^>]*?)\s*-->)?/);
      if (!lm) continue;
      const url = lm[1].trim();
      if (!url || url === '(нет)' || !/^https?:\/\//i.test(url)) continue;
      const metaStr = lm[2] || '';
      const obj = { url, order: items.length + 1, role: label.toLowerCase() };
      const fm = metaStr.match(/file_id=([^,\s]+)/);
      if (fm) obj.file_id = fm[1];
      const om = metaStr.match(/order=(\d+)/);
      if (om) obj.order = parseInt(om[1], 10);
      const rm = metaStr.match(/role=(\w+)/);
      if (rm) obj.role = rm[1];
      items.push(obj);
    }
    return items;
  };

  for (const block of blocks) {
    const header = block.match(/^##\s*№(\S+)\s*(?:\[(\d+)\])?/);
    if (!header) continue;
    index++;
    const sdamgiaId = header[1];
    const difficulty = header[2] || defaultDifficulty;
    const rest = block.slice(header[0].length);

    // Парсим поля `- key: value` до первой секции `###`
    const fieldsMatch = rest.match(/^([\s\S]*?)(?=\n###\s|$)/);
    const fields = {};
    if (fieldsMatch) {
      for (const line of fieldsMatch[1].split('\n')) {
        const fm = line.match(/^\s*-\s*([a-zA-Z_]+):\s*(.+?)\s*$/);
        if (fm) fields[fm[1]] = fm[2].trim();
      }
    }

    // Секции
    const sections = {};
    const sectionRe = /\n###\s+([^\n]+)\n([\s\S]*?)(?=\n###\s+|$)/g;
    let sm;
    while ((sm = sectionRe.exec(rest)) !== null) {
      const name = sm[1].trim().toLowerCase();
      sections[name] = sm[2].trim();
    }

    const stripPlaceholder = (s) => (s || '').replace(/^\(пусто\)\s*$/m, '').trim();
    const condition = stripPlaceholder(sections['условие']);
    const answer = stripPlaceholder(sections['ответ']);
    const solution = stripPlaceholder(sections['решение']);
    const criteria = stripPlaceholder(sections['критерии']);
    const imagesBlock = sections['картинки'] || '';

    const conditionImages = parseImagesByRole(imagesBlock, 'Условие');
    const solutionImages = parseImagesByRole(imagesBlock, 'Решение');
    const criteriaImages = parseImagesByRole(imagesBlock, 'Критерии');

    const examPart = Number(fields.exam_part) || defaultExamPart;
    const maxScore = fields.max_score ? Number(fields.max_score) : null;
    const needsReview = /^(true|1|yes)$/i.test(fields.latex_needs_review || '');

    const task = {
      number: index,
      difficulty,
      statement_md: condition,
      answer,
      solution_md: solution,
      tags: [...globalTags],
      imageUrl: conditionImages[0]?.url || '',
      sdamgiaId,
      sdamgia_url: fields.sdamgia_url || '',
      exam_part: examPart,
      criteria_md: criteria,
      max_score: maxScore,
      latex_needs_review: needsReview,
      condition_images: conditionImages,
      solution_images: solutionImages,
      criteria_images: criteriaImages,
    };

    if (!task.statement_md) {
      errors.push(`Задание #${task.number} (sdamgia_id=${sdamgiaId}): пустое условие`);
    }
    if (!task.answer) {
      warnings.push(`Задание #${task.number} (sdamgia_id=${sdamgiaId}): нет ответа`);
    }

    tasks.push(task);
  }

  if (tasks.length === 0) {
    errors.push('Не найдено ни одной задачи. Ожидался формат `## №<id> [<difficulty>]`.');
  }

  return { tasks, errors, warnings };
}

/**
 * Чертежи нашими редакторами в условии и решении (```planim, ```stereo,
 * ```plot, ```chart) разбираются теми же парсерами, что рисуют их на сайте:
 * битая строка молча выпала бы из чертежа — учитель узнаёт о ней до импорта.
 * В задачу кладётся `drawings` — виды чертежей (метка в превью).
 */
function annotateDrawings(tasks, warnings) {
  tasks.forEach((task) => {
    task.drawings = [];
    for (const [field, label] of [['statement_md', ''], ['solution_md', ' в решении']]) {
      const { kinds, problems } = checkDrawingBlocks(task[field]);
      task.drawings.push(...kinds);
      for (const p of problems) {
        const at = p.line ? `строка ${p.line} «${p.command}»: ` : '';
        warnings.push(`Задание #${task.number}, чертёж ${p.kind}${label}: ${at}${p.message} — строка будет пропущена`);
      }
    }
    if (task.unclosedFence) {
      warnings.push(`Задание #${task.number}: блок \`\`\` не закрыт — закрыт автоматически перед следующей задачей`);
      delete task.unclosedFence;
    }
  });
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

  // 1b. Расширенный формат sdamgia — отдельная ветка
  if ((metadata.format || '').toLowerCase() === 'sdamgia') {
    const globalTags = parseTags(metadata.tags);
    const sourceLabel = metadata.source || SDAMGIA_SOURCE_LABELS.ege_prof;
    const { tasks, errors: e, warnings: w } = parseSdamgiaMd(content, metadata);
    errors.push(...e);
    warnings.push(...w);
    annotateDrawings(tasks, warnings);
    return {
      metadata: {
        topic: metadata.topic || '',
        subtopic: metadata.subtopic || '',
        difficulty: String(metadata.difficulty || '1'),
        source: sourceLabel,
        year: metadata.year || new Date().getFullYear(),
        tags: globalTags,
      },
      format: 'sdamgia',
      tasks,
      errors,
      warnings,
    };
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

  annotateDrawings(tasks, warnings);

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

export const SDAMGIA_SOURCE_LABELS = {
  ege_base: 'РЕШУ ЕГЭ — математика базовая',
  ege_prof: 'РЕШУ ЕГЭ — математика профильная',
  oge:      'РЕШУ ОГЭ — математика',
  vpr5:     'РЕШУ ВПР — математика 5 класс',
  vpr6:     'РЕШУ ВПР — математика 6 класс',
  vpr7:     'РЕШУ ВПР — математика 7 класс',
  vpr8:     'РЕШУ ВПР — математика 8 класс',
};

/**
 * Конвертирует результат парсинга sdamgia.ru в формат, совместимый с useTaskImport.
 * @param {Array} problems — массив от сервера: [{ id, condition, answer, images }]
 * @param {Object} metadata — метаданные из формы UI: { taskNumber, subtopic, difficulty, tagsStr, sourceType }
 */
export function parseSdamgiaResult(problems, metadata = {}) {
  const errors = [];
  const warnings = [];
  const difficulty = String(metadata.difficulty || '1');
  const globalTags = parseTags(metadata.tagsStr);
  const taskNumber = metadata.taskNumber || '';
  const sourceType = metadata.sourceType || 'ege_base';
  const sourceLabel = SDAMGIA_SOURCE_LABELS[sourceType] || SDAMGIA_SOURCE_LABELS.ege_base;
  const isVpr = sourceType.startsWith('vpr') || sourceType === 'oge';
  const topicName = !isVpr && taskNumber ? `ЕГЭ-База №${taskNumber}` : '';
  const normalizeSdamgiaText = (text) => String(text || '')
    .replace(/___BR___/g, '\n')
    .replace(/\u00AD/g, '') // soft hyphen
    .replace(/\u200B/g, '') // zero-width space
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // examPart переопределяется учителем в форме (1 или 2); по умолчанию 1
  const examPart = Number(metadata.examPart) || 1;

  const tasks = problems.map((problem, index) => {
    const rawStatement = normalizeSdamgiaText(problem.condition);
    const rawAnswer = normalizeSdamgiaText(problem.answer);
    const rawSolution = normalizeSdamgiaText(problem.solution || '');
    const rawCriteria = normalizeSdamgiaText(problem.criteria_md || '');

    // Конвертируем в LaTeX только если пришёл "старый" текст без готовой разметки
    const statement = shouldConvertLegacyMath(rawStatement) ? convertToLatex(rawStatement) : rawStatement;
    const answer = shouldConvertLegacyMath(rawAnswer) ? convertToLatex(rawAnswer) : rawAnswer;
    // Решение и критерии: LaTeX-формулы уже вставлены сервером как $...$, конвертация не нужна
    const solution = rawSolution;
    const criteria = rawCriteria;

    const task = {
      number: index + 1,
      difficulty,
      statement_md: statement,
      answer: answer,
      solution_md: solution,
      tags: [...globalTags],
      imageUrl: '',
      sdamgiaId: problem.id || '',
      // Поля части 2 (могут быть пустыми для части 1)
      sdamgia_url: problem.sdamgia_url || '',
      exam_part: examPart,
      criteria_md: criteria,
      max_score: problem.max_score ?? null,
      latex_needs_review: !!problem.latex_needs_review,
      // Структурированные картинки по ролям {url, file_id, order, role}
      condition_images: Array.isArray(problem.condition_images) ? problem.condition_images : [],
      solution_images: Array.isArray(problem.solution_images) ? problem.solution_images : [],
      criteria_images: Array.isArray(problem.criteria_images) ? problem.criteria_images : [],
    };

    // Первое изображение условия — для backward-compat поля imageUrl (часть 1)
    if (task.condition_images.length > 0) {
      task.imageUrl = task.condition_images[0].url || '';
    } else if (problem.images && problem.images.length > 0) {
      // Старый формат (плоский массив URL) — fallback
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
      source: sourceLabel,
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

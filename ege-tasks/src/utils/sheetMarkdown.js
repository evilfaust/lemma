/**
 * Экспорт листа генератора в Markdown с формулами LaTeX.
 *
 * Лист живёт снимком (тот же, что уходит в `generator_sheets`): варианты ×
 * задания вида `{ exprLatex, resultLatex, varLatex }` плюс план листа `layout`
 * (порядок заданий и черты). Отсюда собираются два текста:
 *
 *  • `compact` — читаемый лист: «## Вариант N», нумерованный список заданий,
 *    в конце «## Ответы». Для заметок, HedgeDoc, письма коллеге, промпта ИИ.
 *  • `work` — формат «Импорта работы» (WORK_IMPORT_FORMAT.md): YAML-шапка,
 *    «### N» и метастрока «ответ:». Такой файл возвращается в Lemma работой.
 *
 * Функции чистые — ни PocketBase, ни DOM, — поэтому покрыты юнит-тестами
 * (`__tests__/sheetMarkdown.test.js`).
 */

import { sheetKind, sheetGeneratorLabel, getSheetGenerator } from './sheetRegistry';

export const SHEET_MD_FORMATS = [
  { value: 'compact', label: 'Читаемый лист' },
  { value: 'work',    label: 'Для импорта в Lemma' },
];

// Больше вариантов «Импорт работы» не разбирает (MAX_VARIANTS в
// workImportFormat.js) — предупреждаем об этом в модалке экспорта.
export const WORK_MD_MAX_VARIANTS = 4;

// Контекст тем при импорте обратно в банк (`topics.exam_type`). Тригонометрия
// и устный счёт — свои контексты, уравнения и неравенства идут в «прочее».
const EXAM_TYPE_BY_GENERATOR = {
  oral_counting:      'oral',
  oral_ege_base:      'oral',
  oral_fractions:     'oral',
  oral_powers_roots:  'oral',
  oral_logarithms:    'oral',
  oral_mixed:         'oral',
  log_exp_equations:  'oral',
  trig_expressions:        'trig',
  inverse_trig:            'trig',
  trig_equations:          'trig',
  trig_equations_advanced: 'trig',
  reduction_formulas:      'trig',
  addition_formulas:       'trig',
  double_angle:            'trig',
  trig_mixed:              'trig',
};

// Чем заканчивается строка задания на листе — тем же правилом собирается ответ:
//   'eq'     — «=» (вычислите): ответ пишется как есть
//   'var'    — «x =» (решите уравнение): к ответу добавляется переменная
//   'answer' — «Ответ:» (неравенства и системы): ответ уже полный («x ∈ …»)
const PROMPT_BY_GENERATOR = {
  linear_equations:   'var',
  log_exp_equations:  'var',
  trig_equations:     'var',
  trig_equations_advanced: 'var',
  quadratic_equations:     'answer',
  quadratic_inequalities:  'answer',
  linear_inequalities:     'answer',
  double_inequalities:     'answer',
  linear_systems:          'answer',
  quadratic_systems:       'answer',
};

export function sheetExamType(generator) {
  return EXAM_TYPE_BY_GENERATOR[generator] || 'other';
}

export function sheetPrompt(generator) {
  return PROMPT_BY_GENERATOR[generator] || 'eq';
}

/** Формула строкой markdown. Пустая — прочерк, чтобы номер задания не потерялся */
export function texInline(latex) {
  const body = String(latex ?? '').trim();
  return body ? `$${body}$` : '—';
}

/** Условие задания. Задания-чертежи (единичная окружность) в текст не переносятся */
export function taskStatement(task) {
  const expr = String(task?.exprLatex ?? '').trim();
  return expr ? texInline(expr) : '_задание с чертежом — печатается рисунком_';
}

/**
 * Ответ задания. Для листов уравнений печатный ключ учителя пишет «x = …» —
 * здесь то же правило и тот же флаг `hideKeyPrompt` (особые ответы вроде
 * «x ∈ ℝ» переменную перед собой не хотят).
 */
export function taskAnswer(task, prompt) {
  const ans = String(task?.resultLatex ?? '').trim();
  if (!ans) return '—';
  return prompt === 'var' && !task?.hideKeyPrompt
    ? texInline(`${task.varLatex || 'x'} = ${ans}`)
    : texInline(ans);
}

/** Задания варианта в порядке листа: план `layout` вместе с чертами */
function orderedItems(variant, layout) {
  const tasks = Array.isArray(variant) ? variant : [];
  if (!Array.isArray(layout) || !layout.length) {
    return tasks.map((task) => ({ kind: 'task', task }));
  }
  const out = [];
  layout.forEach((item) => {
    if (item?.kind === 'divider') { out.push({ kind: 'divider' }); return; }
    const task = tasks[item?.idx];
    if (task) out.push({ kind: 'task', task });
  });
  return out;
}

/**
 * Снимок листа → общий вид для обоих форматов.
 *
 * Плоские генераторы дают один блок на вариант, смешанные работы («Смешанная
 * работа» устная и тригонометрическая) — по блоку на раздел со своей
 * инструкцией и своим видом ответа.
 */
export function normalizeSheet({
  generator, title, tasksData, layout, instruction,
} = {}) {
  const meta = getSheetGenerator(generator);
  const label = sheetGeneratorLabel(generator);
  const sheetInstruction = instruction || meta?.instruction || '';
  const prompt = sheetPrompt(generator);
  const data = Array.isArray(tasksData) ? tasksData : [];

  const variants = sheetKind(generator) === 'sections'
    ? data.map((variant, vi) => ({
      number: variant?.number ?? vi + 1,
      blocks: (variant?.sections || []).map((sec) => ({
        label: sec.label || '',
        instruction: sec.instruction || '',
        prompt: sec.promptMode || (sec.equationMode ? 'var' : 'eq'),
        items: (sec.tasks || []).map((task) => ({ kind: 'task', task })),
      })),
    }))
    : data.map((variant, vi) => ({
      number: vi + 1,
      blocks: [{
        label: '',
        instruction: sheetInstruction,
        prompt,
        items: orderedItems(variant, layout),
      }],
    }));

  return {
    generator,
    label,
    title: (title || '').trim() || label,
    instruction: sheetInstruction,
    prompt,
    variants,
  };
}

/** Сколько заданий в варианте — для подписи в модалке экспорта */
export function countTasks(variant) {
  return (variant?.blocks || []).reduce(
    (sum, block) => sum + block.items.filter((i) => i.kind === 'task').length, 0,
  );
}

// ── Читаемый лист ────────────────────────────────────────────────────────────

function compactVariant(variant, { withSectionHeads, showInstruction }) {
  const out = [];
  let n = 0;
  variant.blocks.forEach((block) => {
    if (withSectionHeads && block.label) out.push('', `### ${block.label}`);
    if (showInstruction && block.instruction) out.push('', block.instruction);
    out.push('');
    block.items.forEach((item) => {
      if (item.kind === 'divider') { out.push('', '---', ''); return; }
      out.push(`${++n}. ${taskStatement(item.task)}`);
    });
  });
  return out;
}

function compactAnswers(variants) {
  const out = ['', '## Ответы'];
  variants.forEach((variant) => {
    out.push('', `**Вариант ${variant.number}**`, '');
    let n = 0;
    variant.blocks.forEach((block) => {
      block.items.forEach((item) => {
        if (item.kind !== 'task') return;
        out.push(`${++n}. ${taskAnswer(item.task, block.prompt)}`);
      });
    });
  });
  return out;
}

function buildCompact(sheet, { withAnswers }) {
  const multiBlock = sheet.variants.some((v) => v.blocks.length > 1);
  const out = [`# ${sheet.title}`];

  // У смешанной работы инструкция своя в каждом разделе — общей шапки нет
  if (!multiBlock && sheet.instruction) out.push('', sheet.instruction);

  sheet.variants.forEach((variant) => {
    out.push('', `## Вариант ${variant.number}`);
    out.push(...compactVariant(variant, {
      withSectionHeads: multiBlock,
      showInstruction: multiBlock,
    }));
  });

  if (withAnswers) out.push(...compactAnswers(sheet.variants));
  return out;
}

// ── Формат «Импорта работы» ──────────────────────────────────────────────────

// Значение метастроки задачи: всё после первого двоеточия, поэтому достаточно
// свернуть переносы строк
const metaValue = (s) => String(s ?? '').replace(/\s*\n\s*/g, ' ').trim();

// В YAML-шапке двоеточие внутри значения ломает разбор («источник: Lemma,
// Смешанная работа: устный счёт»), поэтому опасные значения берутся в кавычки
const YAML_UNSAFE = /(:\s)|(\s#)|^[\s>|*&!%@`"'\[\]{},]|:$/;
const yamlValue = (s) => {
  const flat = metaValue(s);
  return YAML_UNSAFE.test(flat) ? `"${flat.replace(/(["\\])/g, '\\$1')}"` : flat;
};

function buildWork(sheet, { withAnswers, topic }) {
  const out = ['---', `работа: ${yamlValue(sheet.title)}`];
  out.push(`контекст: ${sheetExamType(sheet.generator)}`);
  if (topic) out.push(`тема: ${yamlValue(topic)}`);
  out.push(`источник: ${yamlValue(`Lemma, ${sheet.label}`)}`);
  out.push('---');

  const multi = sheet.variants.length > 1;
  sheet.variants.forEach((variant) => {
    if (multi) out.push('', `## Вариант ${variant.number}`);
    let n = 0;
    variant.blocks.forEach((block) => {
      block.items.forEach((item) => {
        if (item.kind !== 'task') return;
        out.push('', `### ${++n}`);
        // Метастроки идут сразу под заголовком и до условия — иначе парсер
        // прочтёт «ответ:» как часть текста задачи
        if (block.label) out.push(`подтема: ${metaValue(block.label)}`);
        if (withAnswers) out.push(`ответ: ${taskAnswer(item.task, block.prompt)}`);
        out.push('', taskStatement(item.task));
      });
    });
  });

  return out;
}

/**
 * Собирает `.md` листа.
 *
 * @param {object} snapshot — { generator, title, tasksData, layout, instruction }
 * @param {object} [options]
 * @param {'compact'|'work'} [options.format='compact']
 * @param {boolean} [options.withAnswers=true] — ответы (блок «## Ответы» либо метастрока)
 * @param {boolean} [options.onlyFirstVariant=false] — только вариант 1
 * @param {string}  [options.topic] — тема для шапки формата «work»
 */
export function buildSheetMarkdown(snapshot, options = {}) {
  const {
    format = 'compact', withAnswers = true, onlyFirstVariant = false, topic = '',
  } = options;

  const sheet = normalizeSheet(snapshot);
  if (!sheet.variants.length) return '';
  if (onlyFirstVariant) sheet.variants = sheet.variants.slice(0, 1);

  const lines = format === 'work'
    ? buildWork(sheet, { withAnswers, topic })
    : buildCompact(sheet, { withAnswers });

  return `${lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;
}

/** Имя файла: название листа без символов, недопустимых в именах файлов */
export function sheetMarkdownFilename(snapshot, format = 'compact') {
  const sheet = normalizeSheet(snapshot);
  const base = sheet.title
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/ /g, '-')
    .slice(0, 80) || 'list';
  return format === 'work' ? `${base}-работа.md` : `${base}.md`;
}

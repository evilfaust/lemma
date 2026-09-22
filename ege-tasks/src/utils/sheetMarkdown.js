/**
 * Экспорт листа генератора в Markdown с формулами LaTeX.
 *
 * Лист живёт снимком (тот же, что уходит в `generator_sheets`): варианты ×
 * задания вида `{ exprLatex, resultLatex, varLatex }` — либо задания-чертежи
 * `{ question, plot, resultLatex }` (лист «Производная и график»), — плюс план
 * листа `layout` (порядок заданий и черты). Отсюда собираются два текста:
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
import { MATCH_LETTERS, CATEGORY_EXAM_GRAPH } from './derivativeGraphTasks';

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
//   'plain'  — ответ числом, без «$…$» (задания по графику)
const PROMPT_BY_GENERATOR = {
  linear_equations:   'var',
  log_exp_equations:  'var',
  trig_equations:     'var',
  trig_equations_advanced: 'var',
  quadratic_equations:     'answer',
  quadratic_inequalities:  'answer',
  linear_inequalities:     'answer',
  double_inequalities:     'answer',
  interval_method:         'answer',
  derivatives:             'var',     // «y′ = …», «f′(2) = …»
  linear_systems:          'answer',
  quadratic_systems:       'answer',
  // 'plain' — ответ числом, без формулы: его вписывают в бланк, и по нему же
  // проверяется ученик, если задание уедет в работу.
  graph_derivative:        'plain',
};

/**
 * Контекст тем при импорте обратно (`topics.exam_type`).
 *
 * Листу с графиками контекст выбирается по составу: чтение графика и задания
 * на соответствие — это база №3/№7, всё остальное (графики f, f′ и
 * первообразной) — профиль №9. Смешали — берём профиль: там же лежит и
 * большинство заданий такого листа.
 *
 * 🚨 По префиксу `b_` судить нельзя: два задания на соответствие из базы
 * исторически называются `f_tangent_match`/`f_sign_match`. Экзамен знает
 * `CATEGORY_EXAM_GRAPH`, префикс остался фолбэком для незнакомых типов.
 */
export function sheetExamType(generator, sheet = null) {
  if (generator === 'graph_derivative') {
    const cats = (sheet?.variants || []).flatMap(
      (v) => v.blocks.flatMap((b) => b.items.filter((i) => i.kind === 'task').map((i) => i.task?.cat)),
    ).filter(Boolean);
    const isBase = (c) => (CATEGORY_EXAM_GRAPH[c] ? CATEGORY_EXAM_GRAPH[c] === 'Б' : String(c).startsWith('b_'));
    return cats.length && cats.every(isBase) ? 'ege_base' : 'ege_profile';
  }
  return EXAM_TYPE_BY_GENERATOR[generator] || 'other';
}

/**
 * Формула условия. У заданий с флагом `askInStatement` (производные: «f′(2) =»,
 * «y″ =») вопрос живёт в `varLatex` и на листе печатается отдельно от формулы —
 * в тексте и в тесте без него задание непонятно, поэтому он дописывается.
 * Собирается на лету: снимок листа можно править, готовая строка устарела бы.
 */
export function statementLatexOf(task) {
  const expr = String(task?.exprLatex ?? '');
  if (!task?.askInStatement || !expr.trim()) return expr;
  return `${expr},\\; ${task.varLatex || 'x'} = \\,?`;
}

export function sheetPrompt(generator) {
  return PROMPT_BY_GENERATOR[generator] || 'eq';
}

/** Формула строкой markdown. Пустая — прочерк, чтобы номер задания не потерялся */
export function texInline(latex) {
  const body = String(latex ?? '').trim();
  return body ? `$${body}$` : '—';
}

/**
 * Условие задания.
 *
 * Обычное задание — формула в `$…$`. Задание по графику несёт условие словами
 * (`question`) и чертёж в нашем DSL (`plot`) — он выгружается блоком ```plot,
 * поэтому после импорта обратно в Lemma график рисуется сам, а не теряется
 * картинкой. Задания, у которых нет ни того ни другого (единичная окружность),
 * в текст по-прежнему не переносятся.
 */
export function taskStatement(task) {
  const expr = statementLatexOf(task).trim();
  if (expr) return texInline(expr);
  const question = String(task?.question ?? '').trim();
  const plot = String(task?.plot ?? '').trim();
  const note = String(task?.note ?? '').trim();
  const parts = [question, figureGallery(task?.plots), matchingTable(task?.matching)];
  if (plot) parts.push('```plot', plot, '```');
  parts.push(note);
  const body = parts.filter(Boolean).join('\n');
  return body || '_задание с чертежом — печатается рисунком_';
}

/**
 * Списки задания на соответствие — markdown-таблицей «точка | значение».
 *
 * У задания «графики ↔ характеристики» левого списка нет: чертежи выгружаются
 * галереей выше, а буквы уже стоят под ними, — остаётся один столбец.
 */
function matchingTable(matching) {
  const values = matching?.values || [];
  if (!values.length) return '';
  const cell = (v) => (matching.plain ? String(v) : texInline(v));
  const right = matching.valuesTitle || 'ЗНАЧЕНИЯ ПРОИЗВОДНОЙ';
  const points = matching.points || [];
  if (!points.length) {
    return [
      `| ${right} |`,
      '| --- |',
      ...values.map((v, i) => `| ${i + 1}) ${cell(v)} |`),
    ].join('\n');
  }
  if (points.length !== values.length) return '';
  return [
    `| ${matching.leftTitle || 'ТОЧКИ'} | ${right} |`,
    '| --- | --- |',
    ...points.map((p, i) => `| ${MATCH_LETTERS[i]}) ${p} | ${i + 1}) ${cell(values[i])} |`),
  ].join('\n');
}

/**
 * Несколько чертежей одного задания — строкой-галереей «А) … Б) …».
 * Директива `{галерея}` снимает с первой строки роль шапки и раздаёт колонкам
 * равную ширину (см. `remarkTableModifiers`), поэтому четыре графика встают в
 * ряд, а не таблицей с заголовком.
 */
function figureGallery(plots) {
  if (!Array.isArray(plots) || !plots.length) return '';
  const cells = plots.map((spec, i) => `${MATCH_LETTERS[i]}) \`plot: ${String(spec).replace(/\n/g, '; ')}\``);
  return ['{галерея}', `| ${cells.join(' | ')} |`].join('\n');
}

/**
 * Ответ задания. Для листов уравнений печатный ключ учителя пишет «x = …» —
 * здесь то же правило и тот же флаг `hideKeyPrompt` (особые ответы вроде
 * «x ∈ ℝ» переменную перед собой не хотят).
 */
export function taskAnswer(task, prompt) {
  const ans = String(task?.resultLatex ?? '').trim();
  if (!ans) return '—';
  if (prompt === 'plain') {
    // Ответ по графику — число: «0,5», а не «$0{,}5$» (в KaTeX запятая берётся
    // в скобки, и в текстовом файле это выглядело бы мусором).
    return Number.isFinite(task?.answerValue)
      ? String(task.answerValue).replace('.', ',')
      : ans.replace(/\{,\}/g, ',');
  }
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

/**
 * Пункт нумерованного списка. У задания по графику условие многострочное
 * (текст + блок ```plot), и продолжение пишется с отступом в три пробела —
 * иначе чертёж вывалится из пункта и разорвёт нумерацию.
 */
function listItem(n, text) {
  const [first, ...rest] = String(text).split('\n');
  return [`${n}. ${first}`, ...rest.map((l) => (l ? `   ${l}` : ''))].join('\n');
}

function compactVariant(variant, { withSectionHeads, showInstruction }) {
  const out = [];
  let n = 0;
  variant.blocks.forEach((block) => {
    if (withSectionHeads && block.label) out.push('', `### ${block.label}`);
    if (showInstruction && block.instruction) out.push('', block.instruction);
    out.push('');
    block.items.forEach((item) => {
      if (item.kind === 'divider') { out.push('', '---', ''); return; }
      out.push(listItem(++n, taskStatement(item.task)));
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
  out.push(`контекст: ${sheetExamType(sheet.generator, sheet)}`);
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

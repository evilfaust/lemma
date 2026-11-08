/** Только типы, сопоставленные с прототипами банка базового ЕГЭ.
 * Новое семейство добавляется здесь явно, а не по совпадению названия темы.
 * Имена подтем разрешаются в актуальные ID, всегда внутри темы ege_base.
 */
import { DEC_GENERATORS, DEC_LABELS } from './oral/decimals';
import { FR_GENERATORS, FR_LABELS } from './oral/fractions';
import { POW_GENERATORS, POW_LABELS } from './oral/powers';
import { LOG_GENERATORS, LOG_LABELS } from './oral/logarithms';
import { LOGEXP_GENERATORS, LOGEXP_LABELS } from './oral/logexp';
import { BY_VALUE_GENERATORS, BY_VALUE_LABELS, NUMERIC_TRIG_GENERATORS } from './trig/byValue';
import { CATEGORY_LABELS_GRAPH, makeGraphTask, MATCH_LETTERS } from './derivativeGraphTasks';
import { CATEGORY_LABELS_CHART, CATEGORY_GROUPS_CHART, makeChartTask } from './chartReadingTasks';
import { chartToSpec, emptyChartDoc } from './chartSpec';
import { examAnswerLatex } from './oralAnswerFilter';

export const EGE_GENERATOR_SOURCE = 'Генератор Lemma · ЕГЭ база';
const registry = [];
function add(family, number, subtopic, labels, generators, keys, instruction = 'Найдите значение выражения') {
  keys.forEach(cat => registry.push({
    id: `${family}:${cat}`, number, subtopic, label: labels[cat], instruction,
    make: () => generators[cat](2),
  }));
}
add('decimal', 14, 'Действия с десятичными дробями', DEC_LABELS, DEC_GENERATORS, ['sumTimes', 'diffTimes', 'prodMinus', 'prodPlus', 'addDivision', 'subDivision', 'divBySum', 'divByDiff', 'diffDiv', 'decimalFraction', 'trickFraction']);
add('fraction', 14, 'Действия с обыкновенными дробями', FR_LABELS, FR_GENERATORS, ['sumFracTimesInt', 'fracSumTimesDecimal', 'decimalDivFrac', 'bracketDivFrac', 'multiFracTimesInt', 'fracProdPlusInt', 'fracDivPlusMixed', 'oneOverDiff', 'fracDecMix', 'fracProdMinusFrac', 'fracPlusFracDivFrac']);
const roots = ['productOfRoots', 'rootQuotient', 'rootSquareFrac', 'rootOfFraction'];
const powerKeys = [...roots, 'fractionalPower', 'negPower', 'sameBaseProduct', 'sameBaseQuotient', 'irrationalExp', 'powerMixedBases', 'decimalExponent', 'sciNotation'];
add('root', 16, 'Преобразования числовых иррациональных выражений', POW_LABELS, POW_GENERATORS, powerKeys.filter(k => roots.includes(k)));
add('power', 16, 'Действия со степенями', POW_LABELS, POW_GENERATORS, powerKeys.filter(k => !roots.includes(k)));
add('log', 16, 'Преобразования числовых логарифмических выражений', LOG_LABELS, LOG_GENERATORS, ['basicLog', 'logReciprocal', 'logOfRoot', 'basicIdentity', 'complexIdentity', 'logOfSameBasePower', 'logSum', 'logDiff', 'lgSumDiff', 'changeBase', 'nestedLog', 'logRatio', 'logProduct']);
const exp = ['basicExp', 'fracBaseEqual', 'shiftedExp', 'negCoeffExp', 'productExp'];
const equationKeys = ['basicExp', 'shiftedExp', 'negCoeffExp', 'productExp', 'simpleLog', 'logLinear', 'logSumConst', 'logDiffConst', 'constPlusLog', 'logFraction', 'logRhsSum', 'logEqualArgs'];
add('expEquation', 17, 'Показательные уравнения', LOGEXP_LABELS, LOGEXP_GENERATORS, equationKeys.filter(k => exp.includes(k)), 'Найдите корень уравнения');
add('logEquation', 17, 'Логарифмические уравнения', LOGEXP_LABELS, LOGEXP_GENERATORS, equationKeys.filter(k => !exp.includes(k)), 'Найдите корень уравнения');
// В банке базы есть нахождение функции по другой функции и четверти.
// Профильные однородные дроби и сложные двойные углы сюда не переносим.
add('trig', 16, 'Вычисление значений тригонометрических выражений', BY_VALUE_LABELS, BY_VALUE_GENERATORS,
  ['identity_sc', 'identity_tg']);
add('trigNumeric', 16, 'Преобразования числовых тригонометрических выражений', {
  reductionRatio: 'Частное функций: формулы приведения',
  complementaryProduct: 'Произведение тангенсов и котангенсов',
  standardAngles: 'Число и функция стандартного угла',
}, NUMERIC_TRIG_GENERATORS, ['reductionRatio', 'complementaryProduct', 'standardAngles']);
// Числовые выражения со стандартными углами — отдельный существующий генератор.
registry.push({
  id: 'trig:standardAngles', number: 16,
  subtopic: 'Преобразования числовых тригонометрических выражений', label: 'Произведение функций стандартных углов',
  instruction: 'Найдите значение выражения',
  make: async () => {
    const { generateTrigExpressionsVariants } = await import('../hooks/useTrigExpressions');
    return generateTrigExpressionsVariants({ variantsCount: 1, questionsCount: 1, taskType: 'product', termsCount: 2, useDegrees: true })[0]?.[0];
  },
});
for (const cat of ['twoStep', 'bothSides', 'brackets', 'fracDenom']) {
  registry.push({
    id: `linear:${cat}`, number: 17, subtopic: 'Линейные, квадратные, кубические уравнения',
    label: ({ twoStep: 'Линейное уравнение', bothSides: 'Переменная в обеих частях', brackets: 'Линейное уравнение со скобками', fracDenom: 'Линейное уравнение с дробью' })[cat],
    instruction: 'Найдите корень уравнения',
    make: async () => {
      const { generateLinearEquationVariants } = await import('../hooks/useLinearEquations');
      return generateLinearEquationVariants({ variantsCount: 1, questionsCount: 1, categories: { [cat]: true }, varsMode: 'x', decimalOnly: true })[0]?.[0];
    },
  });
}
// №7 требует именно соответствия из четырёх позиций. Профильные вопросы
// про число экстремумов, первообразную и длины промежутков не включены.
for (const cat of ['f_tangent_match', 'f_sign_match', 'b_interval_match', 'b_tangent_graphs', 'b_linear_slope', 'b_char_match']) {
  registry.push({ id: `graph:${cat}`, number: 7, subtopic: 'Анализ графиков функций', label: CATEGORY_LABELS_GRAPH[cat], make: () => makeGraphTask(cat) });
}
for (const [i, group] of CATEGORY_GROUPS_CHART.entries()) {
  for (const cat of group.keys) {
    registry.push({
      id: `chart:${cat}`, number: i === 2 ? 7 : 3,
      subtopic: i === 0 ? 'Определение величины по графику' : i === 1 ? 'Определение величины по диаграмме' : 'Скорость изменения величин',
      label: CATEGORY_LABELS_CHART[cat], make: () => makeChartTask(cat),
    });
  }
}
export const EGE_BASE_GENERATORS = registry;
const normalize = s => String(s || '').normalize('NFKC').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
export function generatorsForTopic(topic, subtopics, selected = []) {
  if (topic?.exam_type !== 'ege_base') return [];
  return registry.filter(g => g.number === Number(topic.ege_number)).flatMap(g => {
    const sub = subtopics.find(s => s.topic === topic.id && normalize(s.name) === normalize(g.subtopic));
    return sub && (!selected.length || selected.includes(sub.id)) ? [{ ...g, topicId: topic.id, subtopicId: sub.id }] : [];
  });
}

/** Модель существующего генератора → редактируемый chart DSL, без файлов и URL. */
export function generatedChartSpec(chart) {
  const doc = emptyChartDoc();
  doc.type = chart.type;
  for (const key of ['x', 'y']) {
    const axis = chart[key];
    doc[key] = { min: axis.min, max: axis.max, step: axis.grid || 1, label: axis.labelEvery || null, decimals: axis.decimals };
    doc[`${key}title`] = axis.title || '';
    doc[`${key}unit`] = axis.unit || '';
  }
  doc.series = (chart.series || []).map(s => ({ ...s, color: 'ink' }));
  doc.bars = (chart.bars || []).map((b, i) => ({ v: b.v, label: chart.x.ticks[i]?.label || String(i + 1) }));
  doc.xlabels = chart.x.ticks?.[0]?.v === chart.x.min
    ? chart.x.ticks.map(t => t.label).join(' | ') : '';
  if (chart.type !== 'bar' && chart.x.ticks?.length > 1) {
    doc.x.label = chart.x.ticks[1].v - chart.x.ticks[0].v;
  }
  doc.groups = (chart.x.groups || []).map(g => `(${g.from}; ${g.to}) ${g.label}`).join(' | ');
  doc.size = { w: 600, h: 340 };
  return chartToSpec(doc);
}
function graphStatement(task) {
  const parts = [task.question];
  if (task.plots?.length) {
    parts.push('{галерея}', `| ${task.plots.map((p, i) => `${MATCH_LETTERS[i]}) \`plot: ${p.replace(/\n/g, '; ')}\``).join(' | ')} |`);
  }
  if (task.plot) parts.push('```plot\n' + task.plot + '\n```');
  if (task.chart) parts.push('```chart\n' + generatedChartSpec(task.chart) + '\n```');
  const m = task.matching;
  if (m) {
    const val = s => m.plain ? s : `$${s}$`;
    if (m.kind === 'graphs') {
      parts.push(`| ${m.valuesTitle || 'ХАРАКТЕРИСТИКИ'} |\n| --- |\n` + m.values.map((v, i) => `| ${i + 1}) ${val(v)} |`).join('\n'));
    } else {
      parts.push(`| ${m.leftTitle || 'ТОЧКИ'} | ${m.valuesTitle || 'ЗНАЧЕНИЯ ПРОИЗВОДНОЙ'} |\n| --- | --- |\n` + m.points.map((p, i) => `| ${MATCH_LETTERS[i]}) ${p} | ${i + 1}) ${val(m.values[i])} |`).join('\n'));
    }
  }
  if (task.note) parts.push(task.note);
  if (m) parts.push('| А | Б | В | Г |\n| --- | --- | --- | --- |\n|  |  |  |  |');
  return parts.filter(Boolean).join('\n\n');
}
export async function generateEgeBaseTask({ topic, subtopics, generatorId, used = new Set() }) {
  const g = generatorsForTopic(topic, subtopics).find(g => g.id === generatorId);
  if (!g) throw new Error('Для выбранной темы и подтемы нет подходящего генератора');
  for (let i = 0; i < 160; i++) {
    const task = await g.make();
    if (!task) continue;
    const answer = examAnswerLatex(String(task.resultLatex));
    if (answer === null || (g.number === 7 && (!/^[1-4]{4}$/.test(answer) || new Set(answer).size !== 4))) continue;
    const statement_md = task.question ? graphStatement(task) : `${g.instruction}:\n\n$${task.exprLatex}$.`;
    if (!statement_md || used.has(statement_md)) continue;
    used.add(statement_md);
    return {
      topic: topic.id, subtopic: [g.subtopicId], statement_md,
      answer: answer.replace(/\{,\}/g, ','), difficulty: '2',
      source: `${EGE_GENERATOR_SOURCE} · ${g.id}`,
      has_image: false,
    };
  }
  throw new Error(`Не удалось получить новую задачу типа «${g.label}». Выберите другой тип.`);
}

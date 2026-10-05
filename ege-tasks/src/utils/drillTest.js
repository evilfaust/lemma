/**
 * Тренировка из генератора, выданная онлайн (v3.9.296).
 *
 * Задание генератора («(−9)·7/9») несамостоятельно — у него нет темы, кода,
 * решаемости, вектора. Поэтому тренировка НЕ пишет задачи в банк `tasks`:
 * задания живут в снимке теста (`mc_tests.variants[].tasks[]` с ключом
 * `v2-q7`), ответы ученика — в самой попытке (`attempts.drill_answers`), а не в
 * `attempt_answers`. Так тренировки не попадают ни в каталог, ни в векторный
 * индекс, ни в решаемость задач и профиль слабостей.
 *
 * Старые тесты (до v3.9.296) несут `task_id` — они идут прежним путём.
 */
import { canCheckByValue, checkDrillAnswer } from './drillAnswer';
import { shuffleOptionsWithSeed, hashStringToSeed } from './distractorGenerator';

/** Генераторы, чьи ответы — числа: им доступен режим «Вписать ответ». */
export const INPUT_GENERATORS = new Set([
  'oral_counting',
  'oral_ege_base',
  'oral_fractions',
  'oral_powers_roots',
  'oral_logarithms',
  'log_exp_equations',
  'linear_equations',
]);

export const ANSWER_MODES = { choice: 'choice', input: 'input' };

export const answerModeOf = (mcTest) => (mcTest?.answer_mode === 'input' ? 'input' : 'choice');

// Как `sheetMarkdown.statementLatexOf`: вопрос «с вопросом» дописывается к
// условию. Не импортом — sheetMarkdown тянет реестр всех генераторов, а этот
// модуль грузит ученическое приложение.
function questionOf(task) {
  const expr = String(task?.exprLatex ?? '');
  if (!task?.askInStatement || !expr.trim()) return expr;
  return `${expr},\\; ${task.varLatex || 'x'} = \\,?`;
}

export const drillKey = (variantIdx, taskIdx) => `v${variantIdx + 1}-q${taskIdx + 1}`;

/** Тест-тренировка: задания без ссылок на банк. */
export function isDrillTest(mcTest) {
  const items = (mcTest?.variants || []).flatMap(v => v.tasks || []);
  return items.length > 0 && items.every(t => t.key && !t.task_id);
}

/**
 * Снимок листа генератора → варианты теста без вариантов ответа (их достраивает
 * окно сохранения: дистракторы бывают асинхронными).
 */
export function drillVariants(tasksData, defaultInstruction = 'Вычислите:') {
  return (tasksData || []).map((variantTasks, vi) => ({
    number: vi + 1,
    tasks: (variantTasks || []).map((task, ti) => ({
      key: drillKey(vi, ti),
      instruction: task.instruction || defaultInstruction,
      question: questionOf(task),
      answer: task.resultLatex,
    })),
  }));
}

/** Задания, ответ на которые нельзя проверить по значению (для режима ввода). */
export function uncheckableItems(tasksData) {
  const bad = [];
  (tasksData || []).forEach((variantTasks, vi) => {
    (variantTasks || []).forEach((task, ti) => {
      if (!canCheckByValue(task.resultLatex)) {
        bad.push({ variant: vi + 1, position: ti + 1, answer: task.resultLatex });
      }
    });
  });
  return bad;
}

/**
 * Задания варианта для страницы ученика. `id` = ключ задания (на нём держатся
 * черновик ответов и проверка). У варианта ответа — `orig`, его место в
 * исходном списке: в попытку пишется он, а не место после перемешивания.
 */
export function drillStudentTasks(variantData, { shuffleMode = 'fixed', seedBase = 'fixed', variantNumber } = {}) {
  return (variantData?.tasks || []).map((t, ti) => {
    const opts = (t.options || []).map((o, i) => ({ ...o, orig: i }));
    const seed = hashStringToSeed(`${seedBase}-${variantNumber}-${ti}-${t.key}`);
    return {
      id: t.key,
      key: t.key,
      statement_md: `${t.instruction || ''}\n\n$$${t.question}$$`.trim(),
      answer: t.answer,
      mc_options: shuffleMode === 'per_student' ? shuffleOptionsWithSeed(opts, seed) : opts,
    };
  });
}

/**
 * Проверка попытки. `answers` — { [key]: индекс показанного варианта | текст }.
 * → { score, drill_answers: [{ key, given, correct }] }
 */
export function gradeDrill(tasks, answers, mode) {
  let score = 0;
  const drill_answers = (tasks || []).map((task) => {
    const raw = answers?.[task.id];
    let given = null;
    let correct = false;
    if (mode === 'input') {
      const text = typeof raw === 'string' ? raw.trim() : '';
      given = text || null;
      correct = !!text && checkDrillAnswer(text, task.answer);
    } else if (Number.isInteger(raw)) {
      const opt = task.mc_options?.[raw];
      given = opt ? opt.orig ?? raw : null;
      correct = !!opt?.is_correct;
    }
    if (correct) score++;
    return { key: task.key, given, correct };
  });
  return { score, drill_answers };
}

/** Зачесть / снять зачёт ответу тренировки → новые drill_answers и балл. */
export function setDrillAnswerCorrect(drillAnswers, key, correct) {
  const next = (drillAnswers || []).map(a => (a.key === key ? { ...a, correct, manual: true } : a));
  return { drill_answers: next, score: next.filter(a => a.correct).length };
}

/** Строки ответов попытки для учительской таблицы: задание + ответ ученика. */
export function drillAnswerRows(attempt, mcTest) {
  const variant = (mcTest?.variants || []).find(
    v => String(v.number) === String(attempt?.mc_variant ?? attempt?.variant),
  );
  const items = new Map((variant?.tasks || []).map((t, i) => [t.key, { ...t, position: i + 1 }]));
  return (attempt?.drill_answers || []).map((a) => {
    const item = items.get(a.key) || {};
    const opt = Number.isInteger(a.given) ? item.options?.[a.given] : null;
    return {
      id: a.key,
      key: a.key,
      position: item.position,
      question: item.question || '',
      instruction: item.instruction || '',
      answer: item.answer || '',
      given: opt ? opt.text : a.given,
      givenIsLatex: !!opt,
      is_correct: !!a.correct,
      manual: !!a.manual,
    };
  });
}

/** Статистика по заданиям теста из попыток: { [key]: { choices, correctCount, total } }. */
export function drillAnswerStats(attempts) {
  const stats = {};
  for (const att of attempts || []) {
    for (const a of att.drill_answers || []) {
      const s = stats[a.key] || (stats[a.key] = { choices: {}, correctCount: 0, total: 0 });
      const choice = a.given == null ? '' : String(a.given);
      s.choices[choice] = (s.choices[choice] || 0) + 1;
      s.total++;
      if (a.correct) s.correctCount++;
    }
  }
  return stats;
}

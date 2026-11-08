import { describe, expect, it } from 'vitest';
import { generateProbabilityVariants } from '../utils/egeBase5Tasks';
import { buildSheetMarkdown } from '../utils/sheetMarkdown';
import { parseWorkMarkdown } from '../utils/workImportFormat';
import { buildImportRows } from '../utils/workImportPlan';
import { parsePlanimBlock, planimPrintSvgFromSpec, planimSvgFromSpec } from '../utils/planim';

const rounds = value => Math.round((value + Number.EPSILON) * 100) / 100;
const theoremAnswers = [
  ['allThree', ([a, b, c]) => a * b * c],
  ['neither', ([a, b]) => (1 - a) * (1 - b)],
  ['bothGood', ([a, b]) => (1 - a) * (1 - b)],
  ['sequence', ([shots, p, hits]) => rounds(p ** hits * (1 - p) ** (shots - hits))],
  ['total', ([share, first, second]) => (share * first + (100 - share) * second) / 10_000],
  ['totalMiss', ([bows, tuned, first, second]) => (tuned * (1 - first) + (bows - tuned) * (1 - second)) / bows],
  ['inverse', ([first, second, overall]) => (overall - second) / (first - second)],
  ['conditional', ([defective, detected]) => rounds((100 - defective) * 100 / (10_000 - defective * detected))],
];

function makeSheet(cat, questionsCount = 30, variantsCount = 10) {
  return generateProbabilityVariants({ categories: { [cat]: true }, questionsCount, variantsCount }).flat();
}

function mazeProbability(spec, exitLabel) {
  const points = [...spec.matchAll(/^(P\d+) = \((-?[\d.]+); (-?[\d.]+)\)$/gm)];
  const start = points.find(([, , x]) => Number(x) === 0)[1];
  const exitY = [...spec.matchAll(/^текст \(13; ([\d.]+)\) ([A-I])$/gm)]
    .find(([, , label]) => label === exitLabel)[1];
  const exit = points.find(([, , x, y]) => Number(x) === 12 && Number(y) === Number(exitY))[1];
  const adjacency = new Map(points.map(([, id]) => [id, []]));
  for (const [, a, b] of spec.matchAll(/^отрезок (P\d+)(P\d+)$/gm)) {
    adjacency.get(a).push(b);
    adjacency.get(b).push(a);
  }
  expect([...adjacency.values()].every(neighbors => neighbors.length >= 1 && neighbors.length <= 3)).toBe(true);
  const visited = new Set();
  function walk(current, previous) {
    expect(visited.has(current)).toBe(false);
    visited.add(current);
    const forward = adjacency.get(current).filter(next => next !== previous);
    if (!forward.length) return Number(current === exit);
    return forward.reduce((sum, next) => sum + walk(next, current), 0) / forward.length;
  }
  const probability = walk(start);
  expect(visited.size).toBe(points.length);
  return probability;
}

describe('ЕГЭ база №5', () => {
  it.each(theoremAnswers)('%s: проверяет 300 разных условий по напечатанным данным', (cat, solve) => {
    const tasks = makeSheet(cat);
    expect(tasks).toHaveLength(300);
    expect(new Set(tasks.map(task => task.statement_md)).size).toBe(300);
    for (const { statement_md, answer } of tasks) {
      const values = statement_md.match(/\d+(?:,\d+)?/g).map(value => Number(value.replace(',', '.')));
      expect(answer).toMatch(/^0,\d{1,4}$/);
      expect(Number(answer.replace(',', '.'))).toBeCloseTo(solve(values), 10);
      if (cat === 'sequence' || cat === 'conditional') expect(statement_md).toContain('округлите до сотых');
    }
  });

  it('строит 300 различных схем, а вероятность совпадает с проходом по коридорам', () => {
    const tasks = makeSheet('maze');
    expect(tasks).toHaveLength(300);
    expect(new Set(tasks.map(task => task.statement_md)).size).toBe(300);
    for (const { statement_md, answer } of tasks) {
      const [, exit] = statement_md.match(/выхода ([A-I])\?/);
      const [, spec] = statement_md.match(/```planim\n([\s\S]+)\n```/);
      expect(Number(answer.replace(',', '.'))).toBe(mazeProbability(spec, exit));
    }
    const sample = tasks.slice(0, 12).map(task => task.statement_md.split('```')[1].slice('planim\n'.length));
    for (const spec of sample) {
      expect(parsePlanimBlock(spec).errors).toEqual([]);
    }
    const [spec] = sample;
    expect(planimSvgFromSpec(spec)).toContain('<svg');
    expect(planimPrintSvgFromSpec(spec, { widthMm: 65, heightMm: 55, letterMm: 2.6 })).toContain('<svg');
  });

  it('импортирует лабиринт вместе со схемой, ответом и подтемой', () => {
    const [task] = makeSheet('maze', 1, 1);
    const parsed = parseWorkMarkdown(buildSheetMarkdown({
      generator: 'probability',
      tasksData: [[task]],
    }, { format: 'work' }));
    expect(parsed.errors).toEqual([]);
    expect(parsed.warnings).toEqual([]);
    expect(parsed.variants[0].tasks[0]).toMatchObject({
      statement_md: task.statement_md,
      answer: task.answer,
      subtopicName: 'Теоремы о вероятностях событий',
      drawings: ['planim'],
    });
  });

  it.each(['draw', 'complement', 'schedule'])('%s: 300 уникальных моделей с точным ответом из условия', cat => {
    const variants = generateProbabilityVariants({
      categories: { [cat]: true },
      questionsCount: 30,
      variantsCount: 10,
    });
    const tasks = variants.flat();
    expect(variants).toHaveLength(10);
    expect(variants.every(tasks => tasks.length === 30)).toBe(true);
    const models = new Set();
    for (const { statement_md, answer } of tasks) {
      const [total, first, second] = statement_md.match(/\d+/g).map(Number);
      let favorable = first;
      if (cat === 'complement') favorable = total - first;
      if (cat === 'schedule') {
        expect(first).toBeGreaterThan(0);
        expect(second).toBeGreaterThan(0);
        const remaining = total - first - second;
        expect(remaining % 2).toBe(0);
        favorable = remaining / 2;
        models.add(`${total}:${Math.min(first, second)}:${Math.max(first, second)}`);
      } else {
        models.add(`${total}:${first}`);
      }
      expect(favorable).toBeGreaterThan(0);
      expect(favorable).toBeLessThan(total);
      expect(answer).toMatch(/^0,\d{1,3}$/);
      const [, digits] = answer.split(',');
      expect(Number(digits) * total).toBe(favorable * 10 ** digits.length);
    }
    expect(models.size).toBe(300);
  });

  it('умножает вероятности двух независимых событий и не повторяет пары на листе', () => {
    const tasks = generateProbabilityVariants({
      categories: { independent: true },
      questionsCount: 30,
      variantsCount: 10,
    }).flat();
    expect(tasks).toHaveLength(300);
    const pairs = new Set();
    for (const { statement_md, answer } of tasks) {
      expect(statement_md).toContain('независимы');
      const [first, second] = [...statement_md.matchAll(/0,(\d{1,2})\b/g)]
        .map(match => Number(match[1].padEnd(2, '0')));
      expect(first).toBeGreaterThan(0);
      expect(second).toBeGreaterThan(0);
      expect(answer).toMatch(/^0,\d{1,3}$/);
      const [, digits] = answer.split(',');
      expect(Number(digits.padEnd(4, '0'))).toBe(first * second);
      pairs.add(`${Math.min(first, second)}:${Math.max(first, second)}`);
    }
    expect(pairs.size).toBe(300);
  });

  it('сохраняет порядок типов, условия и десятичные ответы при импорте работы', () => {
    const tasksData = generateProbabilityVariants({
      categories: { draw: true, complement: true, schedule: true, independent: true },
      questionsCount: 4,
      variantsCount: 2,
    });
    expect(tasksData.map(tasks => tasks.map(task => task.cat)))
      .toEqual(Array.from({ length: 2 }, () => ['draw', 'complement', 'schedule', 'independent']));
    const md = buildSheetMarkdown({ generator: 'probability', tasksData }, { format: 'work' });
    const parsed = parseWorkMarkdown(md);
    expect(parsed.errors).toEqual([]);
    expect(parsed.warnings).toEqual([]);
    expect(parsed.work.examType).toBe('ege_base');
    const rows = buildImportRows(parsed, {
      topics: [{ id: 'topic5', title: 'ЕГЭ-База. №5 Начала теории вероятностей', exam_type: 'ege_base' }],
      subtopics: [
        { id: 'classical', name: 'Классическое определение вероятности', topic: 'topic5' },
        { id: 'theorems', name: 'Теоремы о вероятностях событий', topic: 'topic5' },
      ],
    });
    expect(rows.map(row => row.topicId)).toEqual(Array(8).fill('topic5'));
    expect(rows.map(row => row.subtopicId))
      .toEqual(['classical', 'classical', 'classical', 'theorems', 'classical', 'classical', 'classical', 'theorems']);
    expect(rows.map(({ task }) => [task.statement_md, task.answer]))
      .toEqual(tasksData.flat().map(task => [task.statement_md, task.answer]));
  });
});

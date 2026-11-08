import { describe, expect, it } from 'vitest';
import { generateProbabilityVariants } from '../utils/egeBase5Tasks';
import { buildSheetMarkdown } from '../utils/sheetMarkdown';
import { parseWorkMarkdown } from '../utils/workImportFormat';

function sheet(cat, questionsCount = 30, variantsCount = 10) {
  return generateProbabilityVariants({ categories: { [cat]: true }, questionsCount, variantsCount }).flat();
}

const readNumbers = statement => statement.match(/\d+(?:,\d+)?/g).map(s => Number(s.replace(',', '.')));
const expected = [
  ['listedGroups', ([a, b, target]) => target / (a + b + target)],
  ['remainder', ([total, a, b]) => (total - a - b) / total],
  ['flights', ([total, capacity, trip]) => Math.min(capacity, total - (trip - 1) * capacity) / total],
  ['opponent', ([total, club]) => (club - 1) / (total - 1)],
  ['ratio', ([first, second]) => first / (first + second)],
  ['frequency', ([p, total, count]) => Math.abs(count / total - p)],
  ['clock', ([ticks, ...numbers]) => {
    const [start, end] = numbers.slice(-2);
    return ((end - start + ticks) % ticks) / ticks;
  }],
  ['relativeOrder', ([total, start, end = start]) => (end - start + 1) / total],
];

function checkAnswer(task, probability) {
  expect(probability).toBeGreaterThan(0);
  expect(probability).toBeLessThan(1);
  const rounded = task.statement_md.includes('округлите до сотых');
  expect(task.answer).toMatch(/^0,\d{1,4}$/);
  const answer = Number(task.answer.replace(',', '.'));
  expect(answer).toBeCloseTo(rounded ? Math.round((probability + Number.EPSILON) * 100) / 100 : probability, 10);
}

describe('сюжеты классической вероятности №5', () => {
  it.each(expected)('%s: 300 разных условий с проверяемым ответом', (cat, solve) => {
    const tasks = sheet(cat);
    expect(tasks).toHaveLength(300);
    expect(new Set(tasks.map(task => task.statement_md)).size).toBe(300);
    tasks.forEach(task => checkAnswer(task, solve(readNumbers(task.statement_md))));
  });

  it.each([
    ['dice', [1, 2, 3, 4, 5, 6]],
    ['coin', [0, 1]],
  ])('%s: проверяет 40 задач перебором исходов и предупреждает о лимите', (cat, faces) => {
    const tasks = sheet(cat, 10, 4);
    expect(new Set(tasks.map(task => task.statement_md)).size).toBe(40);
    for (const task of tasks) {
      const [count, target] = readNumbers(task.statement_md);
      let outcomes = [0];
      for (let i = 0; i < count; i++) outcomes = outcomes.flatMap(sum => faces.map(face => sum + face));
      const [, comparison] = task.statement_md.match(/(ровно|не менее|не более) \d/);
      const matches = outcomes.filter(sum => comparison === 'ровно' ? sum === target
        : comparison === 'не менее' ? sum >= target : sum <= target);
      checkAnswer(task, matches.length / outcomes.length);
    }
    expect(() => sheet(cat, 10, 5)).toThrow('до 40 разных задач');
  });

  it('чередует сюжеты внутри существующих типов', () => {
    const stories = [
      ['draw', ['команду', 'билетов', 'пазл', 'конфет']],
      ['complement', ['аккумуляторов', 'насосов', 'экзаменационных вопросов', 'телевизор']],
      ['schedule', ['Конференция', 'Музыкальный конкурс']],
    ];
    for (const [cat, markers] of stories) {
      const tasks = sheet(cat, 15, 4);
      for (const marker of markers) expect(tasks.some(task => task.statement_md.includes(marker))).toBe(true);
    }
  });

  it('экспортирует новые условия и ответы в классическую подтему №5', () => {
    const tasks = ['opponent', 'frequency', 'clock', 'dice', 'coin'].flatMap(cat => sheet(cat, 1, 1));
    const parsed = parseWorkMarkdown(buildSheetMarkdown({
      generator: 'probability',
      tasksData: [tasks],
    }, { format: 'work' }));
    expect(parsed.errors).toEqual([]);
    expect(parsed.warnings).toEqual([]);
    expect(parsed.variants[0].tasks.map(task => [task.statement_md, task.answer, task.subtopicName]))
      .toEqual(tasks.map(task => [task.statement_md, task.answer, 'Классическое определение вероятности']));
  });
});

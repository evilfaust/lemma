import { describe, expect, it } from 'vitest';
import { generateEverydayMathVariants } from '../utils/egeBase1Tasks';
import { buildSheetMarkdown } from '../utils/sheetMarkdown';
import { parseWorkMarkdown } from '../utils/workImportFormat';
import { buildImportRows } from '../utils/workImportPlan';

function generate() {
  return generateEverydayMathVariants({
    categories: { packs: true, shelves: true, change: true, savings: true },
    questionsCount: 30,
    variantsCount: 10,
  });
}

describe('ЕГЭ база №1', () => {
  it('сохраняет порядок типов и проверяемые ответы в 300 уникальных условиях', () => {
    const variants = generate();
    expect(variants).toHaveLength(10);
    expect(variants[0].slice(0, 4).map(task => task.cat)).toEqual(['packs', 'shelves', 'change', 'savings']);
    expect(variants.every(tasks => tasks.length === 30)).toBe(true);
    expect(new Set(variants.flat().map(task => task.statement_md)).size).toBe(300);

    for (const tasks of variants) {
      expect(tasks.map(task => task.cat)).toEqual(variants[0].map(task => task.cat));
      for (const task of tasks) {
        const [a, b, c] = task.statement_md.match(/\d+/g).map(Number);
        const answer = Number(task.answer);
        expect(Number.isInteger(answer) && answer > 0).toBe(true);
        if (task.cat === 'packs') {
          expect(answer * c).toBeGreaterThan(a * b);
          expect((answer - 1) * c).toBeLessThan(a * b);
        } else if (task.cat === 'shelves') {
          expect(answer * c).toBeLessThan(a * b);
          expect((answer + 1) * c).toBeGreaterThan(a * b);
        } else if (task.cat === 'change') {
          expect([500, 1000, 2000]).toContain(c);
          expect(a * b + answer).toBe(c);
        } else {
          expect(b + answer).toBe(a * c);
        }
      }
    }
  });

  it('возвращает условия и ответы через импорт работы с существующими подтемами №1', () => {
    const tasksData = generate().slice(0, 2).map(tasks => tasks.slice(0, 4));
    const topic = { id: 'topic1', title: 'ЕГЭ-База. №1 Простейшие текстовые задачи', exam_type: 'ege_base' };
    const subtopics = [
      { id: 'up', name: 'Округление с избытком', topic: topic.id },
      { id: 'down', name: 'Округление с недостатком', topic: topic.id },
      { id: 'other', name: 'Разные задачи', topic: topic.id },
    ];
    const md = buildSheetMarkdown({ generator: 'everyday_math', tasksData }, { format: 'work' });
    const parsed = parseWorkMarkdown(md);
    expect(parsed.errors).toEqual([]);
    expect(parsed.warnings).toEqual([]);
    expect(parsed.work.examType).toBe('ege_base');
    const rows = buildImportRows(parsed, { topics: [topic], subtopics });
    expect(rows.map(row => row.topicId)).toEqual(Array(8).fill(topic.id));
    expect(rows.map(row => row.subtopicId)).toEqual(['up', 'down', 'other', 'other', 'up', 'down', 'other', 'other']);
    expect(rows.map(({ task }) => [task.statement_md, task.answer]))
      .toEqual(tasksData.flat().map(task => [task.statement_md, task.answer]));
  });
});

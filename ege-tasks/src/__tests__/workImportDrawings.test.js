import { describe, it, expect } from 'vitest';
import {
  promptExampleBlocks,
  buildDrawingsPromptSection,
  extractDrawingBlocks,
  checkDrawingBlocks,
} from '../utils/workImportDrawings';
import { parsePlanimBlock } from '../utils/planim/dsl';
import { parseStereoBlock } from '../utils/stereo/dsl';
import { buildBody } from '../utils/stereo/bodies';
import { buildAiPrompt, parseWorkMarkdown } from '../utils/workImportFormat';

describe('шпаргалка промпта — каждая команда понятна редактору', () => {
  const { planim, stereo } = promptExampleBlocks();

  it.each(planim)('planim: %s', (block) => {
    const r = parsePlanimBlock(block);
    expect(r.errors).toEqual([]);
    expect(r.scene.ops.length + (r.grid ? 1 : 0)).toBeGreaterThan(0);
  });

  it.each(stereo)('stereo: %s', (block) => {
    expect(parseStereoBlock(block).errors).toEqual([]);
  });

  // Формы, упомянутые в пояснениях шпаргалки («…», «…»), — тоже должны работать.
  it.each([
    'треугольник ABC\nпрямая C ⊥ AB',
    'треугольник ABC\nпрямая AB\nлуч AC',
    'треугольник ABC\nM = середина AC',
    'треугольник ABC\nK на AB 0,25',
    'треугольник ABC\nI = вписанная ABC',
    'треугольник ABC\nугол ABC α\nугол BCA ?\nугол CAB\nдлина AB sqrt(3)',
    'O = (0; 0)\nA = (2; 0)\nокружность O A',
    'равнобедренная трапеция ABCD 8 4 3',
    'прямоугольная трапеция ABCD 8 4 3',
  ])('planim, пояснение: %s', (block) => {
    expect(parsePlanimBlock(block).errors).toEqual([]);
  });

  it.each([
    'куб 4\nH = A1 ⊥ BD',
    'куб 4\nM на AA1 0,25\nпрямая MC',
  ])('stereo, пояснение: %s', (block) => {
    expect(parseStereoBlock(block).errors).toEqual([]);
  });

  it('параллелепипед: рёбра AB, AD, AA1 по порядку чисел', () => {
    const { scene } = parseStereoBlock('параллелепипед 4 3 2');
    const body = buildBody(scene.body);
    const d = (a, b) => Math.hypot(...['x', 'y', 'z'].map((k) => body.vertices[a][k] - body.vertices[b][k]));
    expect(d('A', 'B')).toBeCloseTo(4);
    expect(d('A', 'D')).toBeCloseTo(3);
    expect(d('A', 'A1')).toBeCloseTo(2);
  });

  it('примеры в промпте — те же, что проверены', () => {
    const text = buildDrawingsPromptSection().join('\n');
    expect(text).toContain('```planim\nтрапеция ABCD 10 4 4');
    expect(text).toContain('```stereo\nкуб 4');
    expect(text).toContain('![](рисN)');
  });
});

describe('buildAiPrompt и чертежи', () => {
  it('по умолчанию раздел о чертежах есть', () => {
    const prompt = buildAiPrompt({ topics: [] });
    expect(prompt).toContain('=== ЧЕРТЕЖИ ===');
    expect(prompt).toContain('```planim');
    expect(prompt).toContain('```stereo');
  });

  it('drawings: false — только плейсхолдеры, как раньше', () => {
    const prompt = buildAiPrompt({ topics: [], drawings: false });
    expect(prompt).not.toContain('=== ЧЕРТЕЖИ ===');
    expect(prompt).not.toContain('```planim');
    expect(prompt).toContain('![](рис1)');
  });
});

describe('extractDrawingBlocks / checkDrawingBlocks', () => {
  it('находит блоки и пропускает чужие ограждения', () => {
    const md = [
      'Условие.',
      '```planim',
      'треугольник ABC',
      '```',
      '```plot',
      'f x^2',
      '```',
      '~~~stereo',
      'куб 4',
      '~~~',
    ].join('\n');
    expect(extractDrawingBlocks(md)).toEqual([
      { kind: 'planim', text: 'треугольник ABC' },
      { kind: 'stereo', text: 'куб 4' },
    ]);
  });

  it('ошибка строки — с номером и текстом команды', () => {
    const md = '```stereo\nкуб 4\nM на AA1 1:2\nсечение M B1 D\n```';
    const r = checkDrawingBlocks(md);
    expect(r.count).toBe(1);
    expect(r.problems).toHaveLength(1);
    expect(r.problems[0]).toMatchObject({ kind: 'stereo', line: 3, command: 'сечение M B1 D' });
  });

  it('пустой блок — проблема', () => {
    expect(checkDrawingBlocks('```planim\n```').problems[0].message).toBe('пустой чертёж');
  });

  it('кириллица-двойник в именах точек не ошибка', () => {
    expect(checkDrawingBlocks('```planim\nтреугольник АВС 5 6 7\nН = высота В АС\n```').problems).toEqual([]);
  });
});

describe('parseWorkMarkdown и чертежи текстом', () => {
  const md = [
    '### 1',
    'ответ: 6',
    '',
    'В трапеции $ABCD$ основания равны 10 и 4. Найдите среднюю линию.',
    '',
    '```planim',
    'трапеция ABCD 10 4 4',
    'AC',
    'X = AC ∩ KL',
    '```',
    '',
    '### 2',
    'ответ: 2',
    '',
    'В кубе найдите расстояние.',
    '',
    '```stereo',
    'куб 4',
    'M = середина AA1',
    '```',
  ].join('\n');

  it('блок остаётся в условии, файл к нему не нужен', () => {
    const r = parseWorkMarkdown(md);
    const [t1, t2] = r.variants[0].tasks;
    expect(t1.statement_md).toContain('```planim');
    expect(t1.drawings).toEqual(['planim']);
    expect(t2.drawings).toEqual(['stereo']);
    expect(r.imagePlaceholders).toEqual([]);
  });

  it('ошибочная строка чертежа — предупреждение с адресом', () => {
    const r = parseWorkMarkdown(md);
    const w = r.warnings.find((x) => x.includes('чертёж'));
    expect(w).toContain('вариант 1, задача 1');
    expect(w).toContain('строка 3');
    expect(w).toContain('X = AC ∩ KL');
    expect(r.errors).toEqual([]);
  });
});

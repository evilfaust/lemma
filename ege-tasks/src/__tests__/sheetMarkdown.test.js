import { describe, it, expect } from 'vitest';
import {
  buildSheetMarkdown, sheetMarkdownFilename, normalizeSheet, countTasks,
  taskAnswer, sheetExamType, sheetPrompt,
} from '../utils/sheetMarkdown';
import { parseWorkMarkdown } from '../utils/workImportFormat';

const task = (n, ans = `ans${n}`, extra = {}) => ({
  exprLatex: `expr${n}`, resultLatex: ans, ...extra,
});

// Лист систем: ответ уже полный («x ∈ …»), переменная перед ним не нужна
const systems = {
  generator: 'quadratic_systems',
  title: 'Системы, 8А',
  tasksData: [
    [task(1), task(2), task(3)],
    [task(4), task(5), task(6)],
  ],
  layout: [],
  instruction: 'Решите систему:',
};

// Лист уравнений: в ключе учителя ответ печатается как «x = …»
const equations = {
  generator: 'linear_equations',
  title: 'Линейные уравнения',
  tasksData: [[task(1, '5'), task(2, '\\varnothing', { hideKeyPrompt: true })]],
  layout: [],
};

// Смешанная работа — снимок другой формы: разделы со своими инструкциями
const mixed = {
  generator: 'oral_mixed',
  title: 'Пятиминутка',
  tasksData: [{
    number: 1,
    sections: [
      { id: 'a', label: 'Дроби', instruction: 'Вычислите:', tasks: [task(1), task(2)] },
      { id: 'b', label: 'Уравнения', instruction: 'Решите уравнение:', equationMode: true, tasks: [task(3, '7')] },
    ],
  }],
};

describe('читаемый лист', () => {
  it('собирает заголовок, инструкцию, варианты и ответы', () => {
    const md = buildSheetMarkdown(systems);
    expect(md).toContain('# Системы, 8А');
    expect(md).toContain('Решите систему:');
    expect(md).toContain('## Вариант 1');
    expect(md).toContain('## Вариант 2');
    expect(md).toContain('1. $expr1$');
    expect(md).toContain('3. $expr3$');
    expect(md).toContain('## Ответы');
    expect(md).toContain('**Вариант 2**');
    expect(md).toContain('1. $ans4$');
  });

  it('без ответов блока «Ответы» нет', () => {
    const md = buildSheetMarkdown(systems, { withAnswers: false });
    expect(md).not.toContain('## Ответы');
    expect(md).toContain('1. $expr1$');
  });

  it('выгружает только первый вариант', () => {
    const md = buildSheetMarkdown(systems, { onlyFirstVariant: true });
    expect(md).toContain('## Вариант 1');
    expect(md).not.toContain('## Вариант 2');
    expect(md).not.toContain('$expr4$');
  });

  it('идёт порядком листа: перестановка и черта', () => {
    const md = buildSheetMarkdown({
      ...systems,
      layout: [
        { kind: 'task', idx: 2 },
        { kind: 'divider' },
        { kind: 'task', idx: 0 },
      ],
    });
    // черта не сбивает нумерацию — как на печатном листе
    expect(md).toContain('1. $expr3$');
    expect(md).toContain('---');
    expect(md).toContain('2. $expr1$');
    expect(md).not.toContain('$expr2$');
    // ключ учителя разложен тем же порядком
    expect(md.split('## Ответы')[1]).toContain('1. $ans3$');
  });

  it('в уравнениях к ответу добавляет переменную, а к особому — нет', () => {
    const md = buildSheetMarkdown(equations);
    const key = md.split('## Ответы')[1];
    expect(key).toContain('1. $x = 5$');
    expect(key).toContain('2. $\\varnothing$');
  });

  it('смешанная работа печатается разделами со сквозной нумерацией', () => {
    const md = buildSheetMarkdown(mixed);
    expect(md).toContain('### Дроби');
    expect(md).toContain('### Уравнения');
    expect(md).toContain('1. $expr1$');
    expect(md).toContain('3. $expr3$');
    // раздел уравнений отвечает через «x =», раздел вычислений — нет
    const key = md.split('## Ответы')[1];
    expect(key).toContain('2. $ans2$');
    expect(key).toContain('3. $x = 7$');
  });

  it('задание с чертежом отмечает, что в текст не переносится', () => {
    const md = buildSheetMarkdown({
      generator: 'trig_mixed',
      title: 'Окружность',
      tasksData: [{ number: 1, sections: [{ id: 'uc', label: 'Единичная окружность', tasks: [{ points: [] }] }] }],
    });
    expect(md).toContain('_задание с чертежом — печатается рисунком_');
  });
});

describe('формат «Импорта работы»', () => {
  it('читается собственным парсером Lemma', () => {
    const md = buildSheetMarkdown(systems, { format: 'work' });
    const parsed = parseWorkMarkdown(md);

    expect(parsed.errors).toEqual([]);
    expect(parsed.work.title).toBe('Системы, 8А');
    expect(parsed.work.examType).toBe('other');
    expect(parsed.variants).toHaveLength(2);
    expect(parsed.variants[0].tasks).toHaveLength(3);
    expect(parsed.variants[0].tasks[0].statement_md).toBe('$expr1$');
    expect(parsed.variants[0].tasks[0].answer).toBe('$ans1$');
    expect(parsed.variants[1].tasks[2].answer).toBe('$ans6$');
  });

  it('контекст тем берётся по генератору', () => {
    expect(sheetExamType('oral_counting')).toBe('oral');
    expect(sheetExamType('trig_equations')).toBe('trig');
    expect(sheetExamType('linear_systems')).toBe('other');
    expect(sheetPrompt('linear_equations')).toBe('var');
    expect(sheetPrompt('oral_counting')).toBe('eq');
  });

  it('разделы смешанной работы становятся подтемами', () => {
    const md = buildSheetMarkdown(mixed, { format: 'work' });
    const parsed = parseWorkMarkdown(md);
    expect(parsed.errors).toEqual([]);
    expect(parsed.variants[0].tasks.map(t => t.subtopicName))
      .toEqual(['Дроби', 'Дроби', 'Уравнения']);
  });

  it('без ответов метастрока не пишется', () => {
    const md = buildSheetMarkdown(systems, { format: 'work', withAnswers: false });
    expect(md).not.toContain('ответ:');
    expect(parseWorkMarkdown(md).variants[0].tasks[0].answer).toBeFalsy();
  });
});

describe('мелочи', () => {
  it('считает варианты и задания', () => {
    const sheet = normalizeSheet(systems);
    expect(sheet.variants).toHaveLength(2);
    expect(countTasks(sheet.variants[0])).toBe(3);
    expect(sheet.title).toBe('Системы, 8А');
  });

  it('без названия подставляет метку генератора', () => {
    const sheet = normalizeSheet({ ...systems, title: '  ' });
    expect(sheet.title).toBe('Системы квадратных неравенств');
  });

  it('пустой ответ печатает прочерк', () => {
    expect(taskAnswer({ resultLatex: '' }, 'answer')).toBe('—');
  });

  it('имя файла чистится от недопустимых символов', () => {
    expect(sheetMarkdownFilename({ ...systems, title: 'Лист 8А/Б: устно' }))
      .toBe('Лист-8А-Б-устно.md');
    expect(sheetMarkdownFilename(systems, 'work')).toBe('Системы,-8А-работа.md');
  });

  it('пустой снимок даёт пустой текст', () => {
    expect(buildSheetMarkdown({ generator: 'linear_equations', tasksData: null })).toBe('');
  });
});

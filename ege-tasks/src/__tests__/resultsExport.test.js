// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import {
  buildXlsx, workbookParts, columnLetter, cellRef, escapeXml, safeSheetName, safeFileName,
} from '../utils/xlsxWriter';
import {
  buildResultsTable, pickBestAttempts, attemptItems, taskPositions, resultsSheets,
  summarizeResults, resultsFileName, studentKey,
} from '../utils/resultsExport';
import {
  sessionResultsHidden, attemptResultsHidden, visibleResultAttempts, hiddenState,
} from '../utils/resultsVisibility';
import { recentResults } from '../utils/studentHome';

// Выгрузка результатов в Excel и ручное закрытие результатов (v3.9.321).

describe('xlsxWriter', () => {
  it('буквы колонок и адреса ячеек', () => {
    expect(columnLetter(0)).toBe('A');
    expect(columnLetter(25)).toBe('Z');
    expect(columnLetter(26)).toBe('AA');
    expect(columnLetter(701)).toBe('ZZ');
    expect(columnLetter(702)).toBe('AAA');
    expect(cellRef(3, 2)).toBe('C4');
  });

  it('экранирует XML и выкидывает управляющие символы', () => {
    expect(escapeXml('a < b & "c" > d')).toBe('a &lt; b &amp; &quot;c&quot; &gt; d');
    expect(escapeXml('x\u0001y\u0008z')).toBe('xyz');
  });

  it('имена листов: запрещённые символы, длина, повтор', () => {
    const taken = new Set();
    expect(safeSheetName('Итоги [10А]: 1/2', taken)).toBe('Итоги  10А   1 2');
    expect(safeSheetName('Итоги [10А]: 1/2', taken)).toBe('Итоги  10А   1 2 (2)');
    expect(safeSheetName('x'.repeat(40), new Set())).toHaveLength(31);
    expect(safeFileName('Контрольная: 10/А?')).toBe('Контрольная 10 А.xlsx');
  });

  it('книга — валидный zip со всеми частями, строки inline, числа числами', () => {
    const bytes = buildXlsx([{
      name: 'Результаты',
      rows: [[{ v: 'Заголовок', s: 'title' }], [], ['Иванов & Ко', 7, null, '']],
      cols: [10, 30],
      freeze: { row: 1, col: 1 },
      merges: ['A1:C1'],
      autoFilter: 'A3:D3',
    }]);
    expect(bytes[0]).toBe(0x50); // 'PK'
    expect(bytes[1]).toBe(0x4b);
    const files = unzipSync(bytes);
    expect(Object.keys(files)).toEqual(expect.arrayContaining([
      '[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/_rels/workbook.xml.rels',
      'xl/styles.xml', 'xl/worksheets/sheet1.xml',
    ]));
    const sheet = strFromU8(files['xl/worksheets/sheet1.xml']);
    expect(sheet).toContain('<c r="A1" s="5" t="inlineStr"><is><t xml:space="preserve">Заголовок</t></is></c>');
    expect(sheet).toContain('<row r="2"/>');
    expect(sheet).toContain('Иванов &amp; Ко');
    expect(sheet).toContain('<c r="B3"><v>7</v></c>');
    expect(sheet).not.toContain('r="C3"');
    expect(sheet).toContain('state="frozen"');
    expect(sheet).toContain('<mergeCell ref="A1:C1"/>');
    expect(sheet).toContain('<col min="2" max="2" width="30" customWidth="1"/>');
    const wb = strFromU8(files['xl/workbook.xml']);
    expect(wb).toContain('<sheet name="Результаты" sheetId="1" r:id="rId1"/>');
    expect(wb).toContain("'Результаты'!$A$3:$D$3");
  });

  it('несколько листов — связи и типы на каждый', () => {
    const parts = workbookParts([{ name: 'А', rows: [] }, { name: 'Б', rows: [] }]);
    expect(parts['xl/worksheets/sheet2.xml']).toBeTruthy();
    expect(parts['[Content_Types].xml']).toContain('/xl/worksheets/sheet2.xml');
    expect(parts['xl/_rels/workbook.xml.rels']).toContain('Target="worksheets/sheet2.xml"');
    expect(parts['xl/_rels/workbook.xml.rels']).toContain('Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles"');
  });
});

// ── Данные: бумажная работа, внесённая с телефона ───────────────────────

const variant1 = {
  id: 'v1', number: 1, tasks: ['t1', 't2', 't3'],
  order: [{ taskId: 't2', position: 0 }, { taskId: 't1', position: 1 }, { taskId: 't3', position: 2 }],
};
const variant2 = { id: 'v2', number: 2, tasks: ['t4', 't5', 't6'], order: [] };

const att = (id, extra = {}) => ({
  id, session: 's1', status: 'submitted', score: 0, total: 3,
  submitted_at: '2026-10-07T09:00:00Z', created: '2026-10-07T09:00:00Z', ...extra,
});
const ans = (attempt, task, ok, raw = '') => ({ attempt, task, is_correct: ok, answer_raw: raw });

const attempts = [
  att('a1', { student: 'st1', student_name: 'Петров Пётр', score: 2, expand: { variant: variant1 } }),
  att('a2', { student: 'st2', student_name: 'Алексеева Анна', score: 3, variant: 'v2', expand: { variant: variant2 } }),
  // повторная попытка Петрова — хуже первой
  att('a3', { student: 'st1', student_name: 'Петров Пётр', score: 1, submitted_at: '2026-10-07T10:00:00Z', expand: { variant: variant1 } }),
  // незаконченная — в выгрузку не идёт
  att('a4', { student: 'st3', student_name: 'Сидоров', status: 'started', expand: { variant: variant1 } }),
  // ФИО текстом, без аккаунта
  att('a5', { student_name: 'Борисов Борис', score: 1, expand: { variant: variant1 } }),
];
const answersByAttempt = {
  a1: [ans('a1', 't1', true, '5'), ans('a1', 't2', false, '12'), ans('a1', 't3', true, '-1')],
  a2: [ans('a2', 't4', true, '1'), ans('a2', 't5', true, '2'), ans('a2', 't6', true, '3')],
  a3: [ans('a3', 't1', true, '5')],
  a5: [ans('a5', 't2', true, '7'), ans('a5', 't1', false, ''), ans('a5', 't3', false, '0')],
};

describe('таблица результатов', () => {
  it('номер задания — из порядка варианта, иначе из списка задач', () => {
    expect(taskPositions(attempts[0])).toEqual({ t2: 1, t1: 2, t3: 3 });
    expect(taskPositions(attempts[1])).toEqual({ t4: 1, t5: 2, t6: 3 });
  });

  it('ученик — аккаунт, а без него — ФИО без регистра и «ё»', () => {
    expect(studentKey({ student: 'x', student_name: 'А' })).toBe('s:x');
    expect(studentKey({ student_name: '  Пётр  Петров ' })).toBe('n:петр петров');
  });

  it('лучшая попытка на ученика; при равенстве — более поздняя', () => {
    const best = pickBestAttempts(attempts.filter((a) => a.status === 'submitted'));
    expect(best.map((a) => a.id).sort()).toEqual(['a1', 'a2', 'a5']);
    const tie = pickBestAttempts([
      att('x1', { student: 'q', score: 2, submitted_at: '2026-10-01T10:00:00Z' }),
      att('x2', { student: 'q', score: 2, submitted_at: '2026-10-02T10:00:00Z' }),
    ]);
    expect(tie[0].id).toBe('x2');
  });

  it('строки по алфавиту, задания 1/0 по номеру варианта, процент и оценка', () => {
    const { rows, taskCount, summary } = buildResultsTable({ attempts, answersByAttempt });
    expect(rows.map((r) => r.name)).toEqual(['Алексеева Анна', 'Борисов Борис', 'Петров Пётр']);
    expect(taskCount).toBe(3);
    const petrov = rows[2];
    expect(petrov.variant).toBe(1);
    expect(petrov.date).toBe('07.10.2026');
    // t2 — задание №1 (неверно), t1 — №2, t3 — №3
    expect(petrov.items[1]).toMatchObject({ correct: false, given: '12' });
    expect(petrov.items[2]).toMatchObject({ correct: true, given: '5' });
    expect(petrov.pct).toBe(67);
    expect(petrov.grade).toBe(4);
    expect(rows[0]).toMatchObject({ pct: 100, grade: 5 });
    expect(rows[1]).toMatchObject({ pct: 33, grade: 2 });
    expect(summary.solved).toEqual([67, 67, 67]);
    expect(summary.avgScore).toBe(2);
    expect(summary.grades).toEqual({ 5: 1, 4: 1, 3: 0, 2: 1 });
    expect(summary.success).toBe(67);
    expect(summary.quality).toBe(67);
  });

  it('все попытки, если «лучшая» выключена; незаконченных нет никогда', () => {
    const { rows } = buildResultsTable({ attempts, answersByAttempt, bestOnly: false });
    expect(rows).toHaveLength(4);
    expect(rows.find((r) => r.name === 'Сидоров')).toBeUndefined();
  });

  it('пороги оценки — свои', () => {
    const { rows } = buildResultsTable({ attempts, answersByAttempt, thresholds: { 5: 100, 4: 60, 3: 30 } });
    expect(rows.map((r) => r.grade)).toEqual([5, 3, 4]);
  });

  it('тренировка из генератора: ответы из самой попытки', () => {
    const mcTest = { variants: [{ number: 1, tasks: [{ key: 'v1-q1', answer: '4' }, { key: 'v1-q2', answer: '9' }] }] };
    const drill = att('d1', {
      student_name: 'Иванов', score: 1, total: 2, variant: '1',
      drill_answers: [{ key: 'v1-q2', given: '8', correct: false }, { key: 'v1-q1', given: '4', correct: true }],
    });
    expect(attemptItems(drill, [], mcTest)).toEqual([
      { position: 1, correct: true, given: '4' },
      { position: 2, correct: false, given: '8' },
    ]);
  });

  it('тест с выбором (без варианта работы): ответ — буквой', () => {
    const mcTest = { variants: [{ number: 2, tasks: [{ task_id: 'm1' }, { task_id: 'm2' }] }] };
    const a = att('m', { variant: '2', mc_variant: 2 });
    expect(attemptItems(a, [ans('m', 'm2', true, '1'), ans('m', 'm1', false, '3')], mcTest)).toEqual([
      { position: 1, correct: false, given: 'Г' },
      { position: 2, correct: true, given: 'Б' },
    ]);
  });

  it('пустая сводка без деления на ноль', () => {
    expect(summarizeResults([], 0)).toMatchObject({ count: 0, avgScore: null, success: null, quality: null });
  });
});

describe('листы книги', () => {
  const table = buildResultsTable({ attempts, answersByAttempt });

  it('лист «Результаты»: шапка, строки, итог «Решили, %», успеваемость', () => {
    const [sheet, answers] = resultsSheets(table, { title: 'Контрольная 2', subtitle: 'Класс: 10' });
    expect(sheet.name).toBe('Результаты');
    expect(sheet.rows[0][0].v).toBe('Контрольная 2');
    expect(sheet.rows[1][0].v).toBe('Класс: 10 · Учеников: 3');
    const head = sheet.rows[3].map((c) => c.v);
    expect(head).toEqual(['№', 'Ученик', 'Вариант', 'Дата', '1', '2', '3', 'Баллы', 'Из', '%', 'Оценка']);
    expect(sheet.rows[4].map((c) => c.v)).toEqual([1, 'Алексеева Анна', 2, '07.10.2026', 1, 1, 1, 3, 3, 100, 5]);
    const total = sheet.rows[7].map((c) => c.v);
    expect(total.slice(1, 7)).toEqual(['Решили, %', '', '', 67, 67, 67]);
    expect(total[7]).toBe(2);
    const labels = sheet.rows.map((r) => r[1]?.v);
    expect(labels).toContain('Успеваемость, %');
    expect(labels).toContain('Качество знаний, %');
    expect(sheet.freeze).toEqual({ row: 4, col: 2 });
    expect(answers.name).toBe('Ответы');
    expect(answers.rows[4].map((c) => c.v)).toEqual([1, 'Алексеева Анна', 2, '1', '2', '3']);
    expect(answers.rows[5].slice(3).map((c) => c.v)).toEqual(['7', '— ✗', '0 ✗']);
  });

  it('без заданий и без оценки — короткая таблица, без листа ответов', () => {
    const sheets = resultsSheets(table, { title: 'Т' }, { withTasks: false, withGrade: false, withAnswers: false });
    expect(sheets).toHaveLength(1);
    expect(sheets[0].rows[3].map((c) => c.v)).toEqual(['№', 'Ученик', 'Вариант', 'Дата', 'Баллы', 'Из', '%']);
  });

  it('несколько выдач — колонка «Выдача»', () => {
    const t = buildResultsTable({
      attempts: [att('p', { student_name: 'А', session: 's1' }), att('q', { student_name: 'Б', session: 's2' })],
    });
    const [sheet] = resultsSheets(t, { title: 'Т', sessionLabels: { s1: 'Выдача 1', s2: 'Выдача 2' } });
    expect(sheet.rows[3].map((c) => c.v).slice(0, 3)).toEqual(['№', 'Ученик', 'Выдача']);
    expect(sheet.rows[4][2].v).toBe('Выдача 1');
  });

  it('книга из листов результатов собирается в xlsx', () => {
    const files = unzipSync(buildXlsx(resultsSheets(table, { title: 'Контрольная 2' })));
    expect(strFromU8(files['xl/worksheets/sheet1.xml'])).toContain('Петров Пётр');
    expect(strFromU8(files['xl/worksheets/sheet2.xml'])).toContain('— ✗');
  });

  it('имя файла', () => {
    expect(resultsFileName({ title: 'Контрольная 2', groupName: '10 класс', date: '07.10.2026' }))
      .toBe('Контрольная 2 — 10 класс — 07.10.2026');
    expect(resultsFileName({})).toBe('Результаты');
  });
});

describe('видимость результатов ученику', () => {
  const open = { expand: { session: { id: 's1' } } };
  const hidden = { expand: { session: { id: 's2', results_hidden: true } } };

  it('по умолчанию видны, закрытые — отсекаются', () => {
    expect(sessionResultsHidden({})).toBe(false);
    expect(sessionResultsHidden({ results_hidden: true })).toBe(true);
    expect(attemptResultsHidden(open)).toBe(false);
    expect(attemptResultsHidden(hidden)).toBe(true);
    expect(visibleResultAttempts([open, hidden])).toEqual([open]);
  });

  it('состояние переключателя по набору выдач', () => {
    expect(hiddenState([])).toBe('none');
    expect(hiddenState([{}, {}])).toBe('none');
    expect(hiddenState([{ results_hidden: true }, {}])).toBe('some');
    expect(hiddenState([{ results_hidden: true }])).toBe('all');
  });

  it('главная ученика: закрытый результат — «сдано» без баллов', () => {
    const list = recentResults([
      { id: 'x', session: 's2', status: 'submitted', score: 9, total: 10, created: '2026-10-07T10:00:00Z',
        expand: { session: { id: 's2', results_hidden: true, student_title: 'Контрольная' } } },
      { id: 'y', session: 's1', status: 'submitted', score: 5, total: 10, created: '2026-10-06T10:00:00Z',
        expand: { session: { id: 's1', student_title: 'Самостоятельная' } } },
    ]);
    expect(list[0]).toMatchObject({ sessionId: 's2', hidden: true, score: null, total: null, pct: null });
    expect(list[1]).toMatchObject({ sessionId: 's1', score: 5, total: 10, pct: 50 });
  });
});

// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import { buildGrid, indexMarks, mergeColumns } from '../utils/classJournal';
import { journalSheets } from '../utils/journalExport';
import { buildXlsx } from '../utils/xlsxWriter';

const block = { id: 'b', kind: 'credit', title: 'Корни и степени', date_from: '2026-10-29' };
const columns = mergeColumns([
  { id: 'p', block: 'b', role: 'work', source: 'manual', title: 'Вычисления', scale: 'points', max_score: 9, date: '2026-10-29' },
  { id: 't', block: 'b', role: 'total', source: 'manual', title: 'Итог', scale: 'grade', date: '2026-10-29' },
], new Map(), { blocks: [block] });
const students = [
  { id: 's1', name: 'Иванова Анна' }, { id: 's2', name: '=Фамилия', former: true },
  { id: 's3', name: 'Петров Иван' },
];
const marks = indexMarks([
  { col: 'p', student: 's1', value: '5.5' }, { col: 't', student: 's1', value: '.4-' },
  { col: 'p', student: 's2', value: '0' }, { col: 't', student: 's2', value: '4+' },
  { col: 'p', student: 's3', value: '6' },
]);
const makeGrid = (mode = 'raw') => buildGrid(students, columns, marks, new Map(), { blocks: [block], mode });

describe('Excel журнала', () => {
  it('числа остаются числами; дозачёт, плюс и выбывший сохраняются; подсказка итога пуста', () => {
    const grid = makeGrid();
    expect(grid.rows[2].cells[1].kind).toBe('hint');
    const [sheet] = journalSheets(grid, columns, { block, groupName: '10 А' });
    const values = sheet.rows.slice(4, 7).map((row) => row.map((c) => c.v));
    expect(values[0]).toEqual([1, 'Иванова Анна', 5.5, '.4−']);
    expect(values[1]).toEqual([2, '=Фамилия (выбыл)', 0, '4+']);
    expect(values[2]).toEqual([3, 'Петров Иван', 6, '']);
    expect(sheet.rows[3].map((c) => c.v)).not.toContain('Средний');
    expect(sheet.rows[7][2].v).toBe(3.5); // выбывший с нулём не входит в среднее
    expect(sheet.freeze).toEqual({ row: 4, col: 2 });
  });

  it('заголовок учитывает показ оценками; общий журнал отличает одноимённые части разных блоков', () => {
    const [sheet] = journalSheets(makeGrid('grade'), columns, { blocks: [block], mode: 'grade' });
    expect(sheet.rows[3][2].v).toContain('Зачёт · Корни и степени');
    expect(sheet.rows[3][2].v).toContain('Оценка 2–5');
    expect(sheet.rows[3][2].v).not.toContain('из 9');
    expect(sheet.rows[3].at(-1).v).toBe('Средний');
    expect(sheet.rows[4][2].v).toBe(3);
  });

  it('отсутствие, вейтинг и освобождение не превращаются в числа', () => {
    const special = indexMarks([
      { col: 'p', student: 's1', value: 'н' },
      { col: 'p', student: 's2', value: 'w' },
      { col: 'p', student: 's3', value: '—' },
    ]);
    const grid = buildGrid(students, columns, special, new Map(), { blocks: [block] });
    const [sheet] = journalSheets(grid, columns, { block });
    expect(sheet.rows.slice(4, 7).map((row) => row[2].v)).toEqual(['н', 'w', '—']);
    expect(sheet.rows.slice(4, 7).every((row) => typeof row[2].v === 'string')).toBe(true);
  });

  it('создаёт настоящий xlsx с числовыми ячейками и безопасным текстом вместо формул', () => {
    const zip = unzipSync(buildXlsx(journalSheets(makeGrid(), columns, { block })));
    const xml = strFromU8(zip['xl/worksheets/sheet1.xml']);
    expect(zip['[Content_Types].xml']).toBeDefined();
    expect(xml).toMatch(/<c r="C5"[^>]*><v>5.5<\/v><\/c>/);
    expect(xml).toContain('=Фамилия (выбыл)');
    expect(xml).not.toContain('<f>');
    expect(xml).not.toContain('≈');
  });
});

import { describe, it, expect } from 'vitest';
import {
  buildGrid, indexMarks, inPeriod, journalTable, mergeColumns, nextDay, periodColumns, periodLabel,
  planAttestationFill, retakeTargets, roundAverage, suggestAttestationPeriod, suggestAttestationTitle,
} from '../utils/classJournal';

// Аттестация за период (v3.9.414): I четверть 01.09–26.10 и год.
const at = (day) => `${day} 12:00:00.000Z`;
const manual = (id, day, extra = {}) => ({
  id, group: 'g1', source: 'manual', title: id, date: at(day), scale: 'grade', created: id, ...extra,
});
const stored = [
  manual('sep', '2026-09-10'),
  manual('oct', '2026-10-15', { weight: 2 }),
  manual('nov', '2026-11-12'),
  manual('hid', '2026-10-01', { hidden: true }),
  manual('pts', '2026-10-20', { scale: 'points', max_score: 10 }),
  manual('q1', '2026-10-26', { title: 'I четверть', period: '2026-09-01..2026-10-26', no_avg: true, category: 'Аттестация' }),
  manual('year', '2027-05-28', { title: 'Год', period: '2026-09-01..2027-05-28', no_avg: true }),
];
const students = [
  { id: 's1', name: 'Аникин Пётр' },
  { id: 's2', name: 'Бойко Анна' },
  { id: 's3', name: 'Выбыл Иван', former: true },
];
const marks = [
  // s1 за четверть: 5 + 4×2 + (8 из 10 → 4) = 17 / 4 = 4,25; скрытая «2» не в счёт
  { col: 'sep', student: 's1', value: '5' }, { col: 'oct', student: 's1', value: '4' },
  { col: 'pts', student: 's1', value: '8' }, { col: 'hid', student: 's1', value: '2' },
  { col: 'nov', student: 's1', value: '2' },
  // s2: четверть уже выставлена учителем
  { col: 'sep', student: 's2', value: '5' }, { col: 'oct', student: 's2', value: '5' },
  { col: 'q1', student: 's2', value: '5', comment: 'молодец' },
  { col: 'sep', student: 's3', value: '3' },
];
const all = mergeColumns(stored, new Map());
const idx = indexMarks(marks);

describe('колонка аттестации', () => {
  it('period читается из записи, мусор — обычная колонка', () => {
    const q1 = all.find((c) => c.id === 'q1');
    expect(q1.period).toBe('2026-09-01..2026-10-26');
    expect(all.find((c) => c.id === 'sep').period).toBe('');
    const [junk] = mergeColumns([manual('x', '2026-10-01', { period: 'вчера' })], new Map());
    expect(junk.period).toBe('');
    expect(periodLabel(q1.period)).toBe('01.09–26.10');
  });

  it('колонки периода: в датах, без скрытых и других аттестаций', () => {
    const ids = periodColumns(all, '2026-09-01..2026-10-26').map((c) => c.id);
    expect(ids).toEqual(['sep', 'oct', 'pts']);
    expect(periodColumns(all, 'all')).toEqual([]);
  });

  it('пустая клетка — средний за период подсказкой, по всем колонкам периода', () => {
    // В сетке видна только сама аттестация (фильтр месяца «Октябрь» и т. п.).
    const visible = all.filter((c) => c.id === 'q1');
    const grid = buildGrid(students, visible, idx, new Map(), { allColumns: all });
    const cell = grid.rows[0].cells[0];
    expect(cell.kind).toBe('hint');
    expect(cell.text).toBe('≈4,25');
    expect(cell.periodAvg).toBeCloseTo(4.25);
    expect(cell.periodCount).toBe(3);
    expect(cell.tip).toMatch('01.09–26.10');
    // Выставленная оценка остаётся, средний — в подсказке.
    const s2 = grid.rows[1].cells[0];
    expect(s2.kind).toBe('manual');
    expect(s2.text).toBe('5');
    expect(s2.tip).toMatch('молодец');
    expect(s2.tip).toMatch('Средний за 01.09–26.10: 5,00');
  });

  it('без оценок за период — пустая клетка без подсказки', () => {
    const grid = buildGrid([{ id: 's9', name: 'Новенький' }], all, idx, new Map());
    const cell = grid.rows[0].cells[all.findIndex((c) => c.id === 'q1')];
    expect(cell.kind).toBe('empty');
    expect(cell.tip).toMatch('оценок нет');
  });

  it('аттестация не входит в средний за год и не задвоена подсказкой', () => {
    const grid = buildGrid(students, all, idx, new Map());
    // s2: 5, 5 и выставленная «5» за четверть — средний по отметкам, 2 оценки
    expect(grid.rows[1].summary.count).toBe(2);
    // s1: 5, 4×2, 4, 2 = 19/5 = 3,8 — «≈» аттестаций не в счёт
    expect(grid.rows[0].summary.avg).toBeCloseTo(3.8);
    const year = grid.rows[0].cells[all.findIndex((c) => c.id === 'year')];
    expect(year.text).toBe('≈3,80');
  });

  it('подсказка аттестации не идёт в выгрузку', () => {
    const grid = buildGrid(students, all, idx, new Map());
    const table = journalTable(grid, all);
    const col = 1 + all.findIndex((c) => c.id === 'q1');
    expect(table[1][col]).toBe('');
    expect(table[2][col]).toBe('5');
  });

  it('аттестация — не цель «Это пересдача колонки…»', () => {
    const sep = all.find((c) => c.id === 'sep');
    expect(retakeTargets(sep, all).map((c) => c.id)).not.toContain('q1');
    expect(retakeTargets(all.find((c) => c.id === 'q1'), all)).toEqual([]);
  });

  it('колонка аттестации стоит в своём периоде по дате конца', () => {
    const q1 = all.find((c) => c.id === 'q1');
    expect(inPeriod(q1, '2026-09-01..2026-10-26')).toBe(true);
    expect(inPeriod(q1, '2026-10')).toBe(true);
  });
});

describe('округление и выставление', () => {
  it('от 0,5 вверх или от 0,6', () => {
    expect(roundAverage(4.49)).toBe(4);
    expect(roundAverage(4.5)).toBe(5);
    expect(roundAverage(4.5, 0.6)).toBe(4);
    expect(roundAverage(4.6, 0.6)).toBe(5);
    expect(roundAverage(3 * 1.2, 0.6)).toBe(4); // 3,5999… — погрешность float не мешает
    expect(roundAverage(2.25)).toBe(2);
    expect(roundAverage(5)).toBe(5);
    expect(roundAverage(null)).toBe(null);
  });

  it('пишет только пустые клетки учеников с оценками, выбывших пропускает', () => {
    const rows = [
      { student: students[0], avg: 4.25, stored: '' },
      { student: students[1], avg: 4.5, stored: '5', comment: 'молодец' },
      { student: students[2], avg: 3, stored: '' },
      { student: { id: 's9' }, avg: null, stored: '' },
    ];
    expect(planAttestationFill(rows)).toEqual([{ student: students[0], value: '4', comment: '' }]);
    // Перезапись: s2 = 5 уже стоит — не пишем лишний раз.
    expect(planAttestationFill(rows, { overwrite: true }).map((w) => w.value)).toEqual(['4']);
    expect(planAttestationFill(rows, { overwrite: true, edge: 0.6 }).map((w) => [w.student.id, w.value]))
      .toEqual([['s1', '4'], ['s2', '4']]);
  });
});

describe('подсказки для новой аттестации', () => {
  it('название — следующая четверть', () => {
    expect(suggestAttestationTitle([])).toBe('I четверть');
    expect(suggestAttestationTitle(all)).toBe('II четверть');
  });

  it('период — со дня после прошлой аттестации по сегодня', () => {
    const opts = { yearStart: '2026-09-01', today: '2026-12-27' };
    expect(nextDay('2026-10-26')).toBe('2026-10-27');
    expect(nextDay('2026-12-31')).toBe('2027-01-01');
    expect(suggestAttestationPeriod([], opts)).toBe('2026-09-01..2026-12-27');
    // «Год» кончается позже сегодня — не в счёт; от конца I четверти
    expect(suggestAttestationPeriod(all, opts)).toBe('2026-10-27..2026-12-27');
    expect(suggestAttestationPeriod(all, { ...opts, title: 'I полугодие' })).toBe('2026-09-01..2026-12-27');
    expect(suggestAttestationPeriod(all, { ...opts, title: 'Год' })).toBe('2026-09-01..2026-12-27');
  });
});

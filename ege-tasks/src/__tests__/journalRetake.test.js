import { describe, it, expect } from 'vitest';
import {
  parseCellInput, decodeValue, editText, resolveCell, summarizeRow, summarizeColumn, buildGrid,
  indexMarks, journalTable, retakeHistoryComment, isAppendedAttempt, planRetakeMerge, retakeTargets,
  countedStored, isRetake,
} from '../utils/classJournal';
import { needsRetake } from '../utils/intensiveFeedback';

// Пересдача той же работы в одной клетке через «/» (v3.9.391).
const pts = (max = 11, extra = {}) => ({ key: 'm:c1', id: 'c1', scale: 'points', max_score: max, ...extra });
const grade = { key: 'm:g', id: 'g', scale: 'grade' };

describe('ввод пересдачи', () => {
  it('«9/11» — две попытки, «1,5 / 11» — с запятой и пробелами', () => {
    expect(parseCellInput('9/11', pts())).toEqual({ ok: true, stored: '9/11' });
    expect(parseCellInput('1,5 / 11', pts())).toEqual({ ok: true, stored: '1.5/11' });
    expect(parseCellInput('3/7/10', pts())).toEqual({ ok: true, stored: '3/7/10' });
  });

  it('«/11» дописывает пересдачу к стоящей отметке', () => {
    expect(parseCellInput('/11', pts(), { prev: '9' })).toEqual({ ok: true, stored: '9/11' });
    expect(parseCellInput('/10', pts(), { prev: '3/7' })).toEqual({ ok: true, stored: '3/7/10' });
  });

  it('«/11» к пустой клетке, «н» или «w» — просто отметка', () => {
    for (const prev of ['', 'н', 'w']) {
      expect(parseCellInput('/11', pts(), { prev })).toEqual({ ok: true, stored: '11' });
    }
  });

  it('при наборе слэш — всегда пересдача, при вставке «18/20» — баллы из максимума', () => {
    expect(parseCellInput('9/11', pts(11))).toEqual({ ok: true, stored: '9/11' });
    expect(parseCellInput('9/11', pts(11), { paste: true })).toEqual({ ok: true, stored: '9' });
    expect(parseCellInput('18/20', pts(20), { paste: true })).toEqual({ ok: true, stored: '18' });
    // знаменатель не максимум — и при вставке это пересдача
    expect(parseCellInput('9/11', pts(20), { paste: true })).toEqual({ ok: true, stored: '9/11' });
  });

  it('каждая попытка проверяется по шкале; «н» и пустая попытка — ошибка', () => {
    expect(parseCellInput('9/25', pts(20)).ok).toBe(false);
    expect(parseCellInput('9/н', pts()).ok).toBe(false);
    expect(parseCellInput('9//11', pts()).ok).toBe(false);
    expect(parseCellInput('/', pts(), { prev: '9' }).ok).toBe(false);
    expect(parseCellInput('9/25', pts(20)).error).toMatch(/через «\/»/);
  });

  it('не больше пяти попыток', () => {
    expect(parseCellInput('1/2/3/4/5/6', pts()).ok).toBe(false);
    expect(parseCellInput('/6', pts(), { prev: '1/2/3/4/5' }).ok).toBe(false);
  });

  it('псевдонимы со слэшем не ломаются: «н/б» — не был, «н/з» — незачёт', () => {
    expect(parseCellInput('н/б', pts())).toEqual({ ok: true, stored: 'н' });
    expect(parseCellInput('н/з', { scale: 'pass' })).toEqual({ ok: true, stored: '0' });
    expect(parseCellInput('нз/з', { scale: 'pass' })).toEqual({ ok: true, stored: '0/1' });
  });

  it('оценки: «3/5», «4-/5», дозачёт «.4-/5»', () => {
    expect(parseCellInput('3/5', grade)).toEqual({ ok: true, stored: '3/5' });
    expect(parseCellInput('4−/5', grade)).toEqual({ ok: true, stored: '4-/5' });
    expect(parseCellInput('/5', grade, { prev: '.4-' })).toEqual({ ok: true, stored: '.4-/5' });
  });

  it('editText — снова разбирается в то же значение', () => {
    for (const [col, stored] of [[pts(), '9/11'], [pts(), '1.5/11'], [grade, '.4-/5'], [{ scale: 'pass' }, '0/1']]) {
      expect(parseCellInput(editText(col, stored), col).stored).toBe(stored);
    }
    expect(editText(pts(), '1.5/11')).toBe('1,5/11');
  });
});

describe('лучшая попытка', () => {
  it('в счёт — наибольшая; при равенстве — поздняя', () => {
    expect(decodeValue('9/11')).toMatchObject({ value: 11, best: 1 });
    expect(decodeValue('11/9')).toMatchObject({ value: 11, best: 0 });
    expect(decodeValue('4-/4+')).toMatchObject({ value: 4, mod: '+', best: 1 });
    expect(countedStored('11/9')).toBe('11');
    expect(countedStored('9')).toBe('9');
  });

  it('дозачёт закрывается пересдачей выше', () => {
    expect(isRetake('.4-/5')).toBe(false);
    expect(isRetake('.4-/3')).toBe(true);
  });

  it('клетка: цвет и средний по лучшей, текст — все попытки', () => {
    const cell = resolveCell(pts(11), { value: '3/10' }, undefined, {});
    expect(cell.value).toBe(10);
    expect(cell.grade).toBe(5);
    expect(cell.text).toBe('3 / 10');
    expect(cell.attempts).toEqual([{ text: '3', best: false }, { text: '10', best: true }]);
    expect(cell.tip).toMatch(/Пересдача: 3 → 10\. В средний — лучшая: 10/);
    expect(summarizeRow([pts(11)], [cell]).avg).toBe(5);
  });

  it('вид колонки применяется к каждой попытке', () => {
    const col = pts(20, { view: 'percent' });
    expect(resolveCell(col, { value: '9/15' }, undefined, {}).text).toBe('45% / 75%');
    expect(resolveCell(pts(20, { view: 'grade' }), { value: '9/15' }, undefined, {}).text).toBe('3 / 4');
  });

  it('подвал считает, сколько пересдали; выгрузка — «9 / 11»', () => {
    const col = pts(11);
    const students = [{ id: 's1', name: 'А' }, { id: 's2', name: 'Б' }];
    const marks = indexMarks([{ col: 'c1', student: 's1', value: '9/11' }, { col: 'c1', student: 's2', value: '8' }]);
    const grid = buildGrid(students, [col], marks, new Map());
    expect(summarizeColumn(grid.rows.map((r) => r.cells[0])).retaken).toBe(1);
    expect(journalTable(grid, [col])[1][1]).toBe('9 / 11');
  });

  it('итог интенсива «2/4» пересдачи уже не требует', () => {
    expect(needsRetake('2/4')).toBe(false);
    expect(needsRetake('4/2')).toBe(false);
    expect(needsRetake('2')).toBe(true);
  });
});

describe('комментарий о пересдаче', () => {
  it('дописали через «/» — в комментарий дата', () => {
    expect(isAppendedAttempt('9', '9/11')).toBe(true);
    expect(isAppendedAttempt('9', '11')).toBe(false);
    expect(retakeHistoryComment('9', '9/11', '', { day: '2026-10-19' })).toBe('пересдача 19.10');
    expect(retakeHistoryComment('9', '9/11', 'устно', { day: '2026-10-19' })).toBe('пересдача 19.10\nустно');
  });

  it('дозачёт, закрытый через «/», не пишет «до дозачёта» — прежняя оценка в клетке', () => {
    expect(retakeHistoryComment('.4-', '.4-/5', '', { day: '2026-10-19' })).toBe('пересдача 19.10');
    expect(retakeHistoryComment('.4-', '5', '')).toBe('до дозачёта: .4−');
  });
});

describe('«Это пересдача колонки…»', () => {
  const target = { key: 'm:t', id: 't', scale: 'points', max_score: 11, day: '2026-10-14', title: 'ТДФ' };
  const retake = { key: 'm:r', id: 'r', scale: 'points', max_score: 11, day: '2026-10-19', title: 'ТДФ пересдача' };
  const students = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => ({ id }));
  const marks = indexMarks([
    { col: 't', student: 'a', value: '9', comment: 'спешил' },
    { col: 'r', student: 'a', value: '11' },
    { col: 't', student: 'b', value: '1.5' }, // не пересдавал
    { col: 't', student: 'c', value: '9' },
    { col: 'r', student: 'c', value: 'н' }, // не пришёл на пересдачу
    { col: 't', student: 'd', value: 'н' },
    { col: 'r', student: 'd', value: '10' }, // писал только пересдачу
    { col: 't', student: 'e', value: '3/10' },
    { col: 'r', student: 'e', value: '10' }, // уже перенесено
    { col: 'r', student: 'f', value: '7', comment: 'устно' },
  ]);

  it('дописывает через «/», «н» пропускает, повтор не дублирует', () => {
    const plan = planRetakeMerge(target, retake, students, marks);
    expect(plan.writes).toEqual([
      { studentId: 'a', value: '9/11', comment: 'пересдача 19.10\nспешил' },
      { studentId: 'd', value: '10', comment: 'написал(а) 19.10' },
      { studentId: 'f', value: '7', comment: 'написал(а) 19.10\nустно' },
    ]);
    expect(plan).toMatchObject({ retaken: 1, late: 2, skipped: 1 });
  });

  it('предлагает только ручные колонки той же шкалы и максимума, ближайшую раньше — первой', () => {
    const cols = [
      target,
      retake,
      { key: 'm:x', id: 'x', scale: 'points', max_score: 20, day: '2026-10-14' },
      { key: 'm:y', id: 'y', scale: 'points', max_score: 11, day: '2026-10-01' },
      { key: 'm:z', id: 'z', scale: 'points', max_score: 11, day: '2026-10-25' },
      { key: 'w:1', id: 'o', online: true, scale: 'points', max_score: 11, day: '2026-10-14' },
      { key: 'm:b', id: 'bl', blockId: 'B', scale: 'points', max_score: 11, day: '2026-10-14' },
    ];
    expect(retakeTargets(retake, cols).map((c) => c.id)).toEqual(['t', 'y', 'z']);
    expect(retakeTargets(cols[5], cols)).toEqual([]);
  });
});

import { describe, it, expect } from 'vitest';
import {
  ABSENT, parseCellInput, decodeValue, editText, gradeFromPercent, normalizeThresholds,
  thresholdPoints, columnWeight, columnScale, dayOf, toStoredDate, shortDay, monthKey,
  monthLabel, localDay, yearWindow, collectOnline, onlineStatus, mergeColumns, resolveCell,
  summarizeRow, summarizeColumn, buildGrid, indexMarks, journalStudents, parseClipboard,
  planPaste, suggestNextTitle, monthSpans, columnMonths, inPeriod, journalTable, toCsv, toTsv,
  formatAvg, indexAttendance, lessonDay, sheetColumnPreset, findSheetColumn,
  WAIT, SKIP, headerSpans, rangeLabel, intensiveDays, intensiveSummary, finalShareOf,
  startsBlockSection, formatGrade,
} from '../utils/classJournal';

const pts = (max = 20, extra = {}) => ({ scale: 'points', max_score: max, ...extra });

describe('parseCellInput — баллы', () => {
  it('число в пределах максимума, запятая как десятичный знак', () => {
    expect(parseCellInput('18', pts())).toEqual({ ok: true, stored: '18' });
    expect(parseCellInput('7,5', pts())).toEqual({ ok: true, stored: '7.5' });
    expect(parseCellInput(' 0 ', pts())).toEqual({ ok: true, stored: '0' });
  });
  it('больше максимума и мусор — ошибка с подсказкой', () => {
    const r = parseCellInput('21', pts());
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/от 0 до 20/);
    expect(parseCellInput('abc', pts()).ok).toBe(false);
    expect(parseCellInput('-3', pts()).ok).toBe(false);
  });
  it('«18/20» из чужой таблицы — если знаменатель равен максимуму', () => {
    expect(parseCellInput('18/20', pts())).toEqual({ ok: true, stored: '18' });
    expect(parseCellInput('18/25', pts()).ok).toBe(false);
  });
  it('без максимума — любое неотрицательное', () => {
    expect(parseCellInput('150', pts(0))).toEqual({ ok: true, stored: '150' });
  });
  it('пусто — очистить', () => {
    expect(parseCellInput('', pts())).toEqual({ ok: true, stored: '' });
    expect(parseCellInput('   ', pts())).toEqual({ ok: true, stored: '' });
  });
});

describe('parseCellInput — «н» и другие шкалы', () => {
  it('«н» в любой шкале, в том числе с латинской раскладки', () => {
    for (const raw of ['н', 'Н', 'нб', 'н/б', 'y', 'n']) {
      expect(parseCellInput(raw, pts())).toEqual({ ok: true, stored: ABSENT });
      expect(parseCellInput(raw, { scale: 'grade' })).toEqual({ ok: true, stored: ABSENT });
    }
  });
  it('оценка — целое 1…5', () => {
    expect(parseCellInput('5', { scale: 'grade' })).toEqual({ ok: true, stored: '5' });
    expect(parseCellInput('6', { scale: 'grade' }).ok).toBe(false);
    expect(parseCellInput('4,5', { scale: 'grade' }).ok).toBe(false);
  });
  it('зачёт: плюс/минус, буквы, слова', () => {
    const col = { scale: 'pass' };
    for (const yes of ['+', 'з', 'зач', 'зачёт', '1']) expect(parseCellInput(yes, col).stored).toBe('1');
    for (const no of ['-', '−', 'нз', 'незачёт', '0']) expect(parseCellInput(no, col).stored).toBe('0');
    expect(parseCellInput('5', col).ok).toBe(false);
  });
  it('проценты — знак % необязателен, не больше 100', () => {
    expect(parseCellInput('85%', { scale: 'percent' })).toEqual({ ok: true, stored: '85' });
    expect(parseCellInput('101', { scale: 'percent' }).ok).toBe(false);
  });
  it('онлайн-колонка всегда в процентах — правка вручную тоже', () => {
    expect(columnScale({ source: 'work', scale: 'points' })).toBe('percent');
    expect(parseCellInput('70', { source: 'work' })).toEqual({ ok: true, stored: '70' });
  });
});

describe('хранение клетки', () => {
  it('decodeValue: число, «н», пусто', () => {
    expect(decodeValue('7.5')).toEqual({ value: 7.5, absent: false });
    expect(decodeValue('0')).toEqual({ value: 0, absent: false });
    expect(decodeValue('н')).toEqual({ value: null, absent: true });
    expect(decodeValue('')).toEqual({ value: null, absent: false });
  });
  it('editText возвращает то, что снова разберётся в то же значение', () => {
    for (const [col, stored] of [[pts(), '7.5'], [{ scale: 'pass' }, '1'], [{ scale: 'pass' }, '0'], [pts(), 'н']]) {
      expect(parseCellInput(editText(col, stored), col).stored).toBe(stored);
    }
  });
});

describe('перевод в оценку', () => {
  it('пороги по умолчанию 85/65/45 и граница «ровно порог»', () => {
    expect(gradeFromPercent(100)).toBe(5);
    expect(gradeFromPercent(85)).toBe(5);
    expect(gradeFromPercent((13 * 100) / 20)).toBe(4); // 65 %, без 64,999…
    expect(gradeFromPercent(45)).toBe(3);
    expect(gradeFromPercent(44.9)).toBe(2);
    expect(gradeFromPercent(null)).toBe(null);
  });
  it('мусорные и перепутанные пороги чинятся', () => {
    expect(normalizeThresholds({ 5: 'x', 4: 70, 3: 90 })).toEqual({ 5: 85, 4: 70, 3: 70 });
    expect(normalizeThresholds(null)).toEqual({ 5: 85, 4: 65, 3: 45 });
  });
  it('подсказка в баллах: из 20 — «5» от 17, «4» от 13, «3» от 9', () => {
    expect(thresholdPoints(20)).toEqual({ 5: 17, 4: 13, 3: 9 });
    expect(thresholdPoints(0)).toBe(null);
  });
  it('вес: пусто = 1, «не учитывать» = 0', () => {
    expect(columnWeight({})).toBe(1);
    expect(columnWeight({ weight: 0 })).toBe(1);
    expect(columnWeight({ weight: 2 })).toBe(2);
    expect(columnWeight({ weight: 2, no_avg: true })).toBe(0);
  });
});

describe('даты', () => {
  it('колонка хранится полднем UTC — день не уезжает', () => {
    expect(toStoredDate('2026-09-25')).toBe('2026-09-25 12:00:00.000Z');
    expect(dayOf('2026-09-25 12:00:00.000Z')).toBe('2026-09-25');
    expect(shortDay('2026-09-05')).toBe('05.09');
    expect(monthKey('2026-09-05')).toBe('2026-09');
    expect(monthLabel('2026-09')).toBe('Сентябрь');
  });
  it('localDay разбирает время PocketBase', () => {
    expect(localDay('2026-09-25 12:00:00.000Z')).toMatch(/^2026-09-2[56]$/);
    expect(localDay('')).toBe(null);
  });
  it('окно учебного года — с 1 августа', () => {
    expect(yearWindow('2026/2027')).toEqual({
      from: '2026-08-01 00:00:00.000Z', to: '2027-08-01 00:00:00.000Z',
    });
    expect(yearWindow('')).toBe(null);
  });
});

// ── Онлайн-работы ──────────────────────────────────────────────────────────

const session = (id, over = {}) => ({
  id, work: 'w1', created: '2026-09-10 09:00:00.000Z', deadline: '', passing_score: 0,
  expand: { work: { id: 'w1', title: 'Тест: степени' } }, ...over,
});
const attempt = (student, sess, over = {}) => ({
  id: `a-${student}-${sess.id}-${over.score ?? 0}`,
  student, session: sess.id, status: 'submitted', score: 8, total: 10,
  submitted_at: '2026-09-11 10:00:00.000Z', expand: { session: sess }, ...over,
});

describe('collectOnline', () => {
  it('все выдачи одной работы — одна колонка, лучшая попытка по проценту', () => {
    const s1 = session('s1');
    const s2 = session('s2', { created: '2026-09-12 09:00:00.000Z' });
    const { columns, cells } = collectOnline([
      attempt('st1', s1, { score: 5 }),
      attempt('st1', s2, { score: 9 }),
      attempt('st2', s2, { status: 'started', score: 0 }),
    ]);
    expect(columns.size).toBe(1);
    const info = columns.get('w:w1');
    expect(info.title).toBe('Тест: степени');
    expect(info.day).toBe(localDay('2026-09-10 09:00:00.000Z'));
    expect(cells.get('st1|w:w1').best.score).toBe(9);
    expect(cells.get('st2|w:w1')).toEqual({ best: null, bestSession: null, started: true });
  });
  it('тест без работы — колонка на выдачу', () => {
    const mc = { id: 'm1', work: '', created: '2026-09-10 09:00:00.000Z', expand: { mc_test: { title: 'Тест A/B/C/D' } } };
    const { columns } = collectOnline([attempt('st1', mc)]);
    expect([...columns.keys()]).toEqual(['s:m1']);
    expect(columns.get('s:m1').title).toBe('Тест A/B/C/D');
  });
  it('срок «для класса» — только по выдаче, которую открыли хотя бы двое', () => {
    const personal = session('p1', { deadline: '2026-09-01 00:00:00.000Z' });
    const own = collectOnline([attempt('st1', personal)]).columns.get('w:w1');
    expect(own.deadline).toBe('2026-09-01 00:00:00.000Z');
    expect(own.classDeadline).toBe('');

    const shared = session('c1', { deadline: '2026-09-15 00:00:00.000Z' });
    const cls = collectOnline([attempt('st1', shared), attempt('st2', shared)]).columns.get('w:w1');
    expect(cls.classDeadline).toBe('2026-09-15 00:00:00.000Z');
  });
});

describe('onlineStatus', () => {
  const now = new Date('2026-09-20T12:00:00Z');
  it('сдал / после срока / незачёт', () => {
    const s = session('s1', { deadline: '2026-09-11 00:00:00.000Z' });
    const late = onlineStatus({}, { best: attempt('a', s), bestSession: s }, { now });
    expect(late.kind).toBe('late');
    expect(late.pct).toBe(80);

    const ok = onlineStatus({}, { best: attempt('a', session('s2')), bestSession: session('s2') }, { now });
    expect(ok.kind).toBe('passed');

    const ps = session('s3', { passing_score: 9 });
    const fail = onlineStatus({}, { best: attempt('a', ps), bestSession: ps }, { now });
    expect(fail.kind).toBe('failed');
    expect(fail.tip).toMatch(/незачёт/);
  });
  it('пишет / долг / не сдавал', () => {
    expect(onlineStatus({}, { best: null, started: true }, { now }).kind).toBe('in_progress');
    const col = { deadline: '2026-09-15 00:00:00.000Z', classDeadline: '' };
    // Найденная по попыткам колонка: персональная выдача не делает должниками остальных.
    expect(onlineStatus(col, undefined, { now }).kind).toBe('none');
    // Колонку завёл учитель — работа выдана классу, срок касается всех.
    expect(onlineStatus(col, undefined, { now, assigned: true }).kind).toBe('overdue');
    expect(onlineStatus({ classDeadline: '2026-09-15 00:00:00.000Z' }, undefined, { now }).kind).toBe('overdue');
  });
});

describe('mergeColumns', () => {
  const online = collectOnline([attempt('st1', session('s1'))]).columns;

  it('найденная онлайн-работа — виртуальная колонка в процентах', () => {
    const cols = mergeColumns([], online);
    expect(cols).toHaveLength(1);
    expect(cols[0]).toMatchObject({ key: 'w:w1', id: null, virtual: true, online: true, scale: 'percent' });
  });
  it('закреплённая работа не дублируется, ручные колонки по дате', () => {
    const stored = [
      { id: 'c2', source: 'manual', title: 'Устный счёт 2', date: '2026-09-16 12:00:00.000Z', scale: 'points', max_score: 20, created: '2' },
      { id: 'c1', source: 'manual', title: 'Устный счёт 1', date: '2026-09-09 12:00:00.000Z', scale: 'points', max_score: 20, created: '1' },
      { id: 'c3', source: 'work', work: 'w1', title: 'Степени', date: '2026-09-11 12:00:00.000Z', created: '3', assigned: true },
    ];
    const cols = mergeColumns(stored, online);
    expect(cols.map((c) => c.key)).toEqual(['m:c1', 'w:w1', 'm:c2']);
    expect(cols[1]).toMatchObject({ id: 'c3', virtual: false, assigned: true, title: 'Степени' });
  });
  it('закреплённая ради правки клетки — не «выдана классу»', () => {
    const cols = mergeColumns([{ id: 'c4', source: 'work', work: 'w1', title: 'Степени' }], online);
    expect(cols[0]).toMatchObject({ id: 'c4', online: true, assigned: false });
  });
  it('срок закреплённой работы без единой попытки — из её выдач', () => {
    const cols = mergeColumns(
      [{ id: 'c9', source: 'work', work: 'w9', title: 'Новая', date: '2026-09-20 12:00:00.000Z' }],
      new Map(),
      { sessionDeadlines: new Map([['w:w9', '2026-09-22 00:00:00.000Z']]) },
    );
    expect(cols[0].deadline).toBe('2026-09-22 00:00:00.000Z');
  });
  it('без даты — в конец', () => {
    const cols = mergeColumns([
      { id: 'x', title: 'Без даты', created: '1' },
      { id: 'y', title: 'С датой', date: '2026-09-01 12:00:00.000Z', created: '2' },
    ]);
    expect(cols.map((c) => c.id)).toEqual(['y', 'x']);
  });
});

describe('resolveCell', () => {
  const manual = { id: 'c1', key: 'm:c1', online: false, scale: 'points', max_score: 20 };
  it('баллы: сырое значение или оценка, тон по оценке', () => {
    const mark = { value: '17' };
    expect(resolveCell(manual, mark, null, { mode: 'raw' })).toMatchObject({ kind: 'manual', text: '17', grade: 5, tone: 'teal' });
    expect(resolveCell(manual, mark, null, { mode: 'grade' }).text).toBe('5');
    expect(resolveCell(manual, { value: '9' }).grade).toBe(3);
  });
  it('«н» — без оценки, приглушённо', () => {
    expect(resolveCell(manual, { value: 'н' })).toMatchObject({ absent: true, grade: null, text: 'н', textTone: 'muted' });
  });
  it('зачёт — без оценки, цветом текста', () => {
    const col = { ...manual, scale: 'pass' };
    expect(resolveCell(col, { value: '1' })).toMatchObject({ text: 'зач', grade: null, textTone: 'teal' });
    expect(resolveCell(col, { value: '0' })).toMatchObject({ text: 'н/з', textTone: 'rose' });
  });
  it('комментарий без значения — клетка пустая, но комментарий виден', () => {
    const cell = resolveCell(manual, { value: '', comment: 'болел' });
    expect(cell).toMatchObject({ kind: 'empty', comment: 'болел', tip: 'болел' });
  });
  it('онлайн: процент, оценка, «пишет», «долг»', () => {
    const s = session('s1');
    const col = { key: 'w:w1', id: null, online: true, scale: 'percent', classDeadline: '2026-09-15 00:00:00.000Z' };
    const now = new Date('2026-09-20T12:00:00Z');
    expect(resolveCell(col, undefined, { best: attempt('a', s), bestSession: s }, { now })).toMatchObject({ kind: 'online', text: '80%', grade: 4 });
    expect(resolveCell(col, undefined, { best: attempt('a', s), bestSession: s }, { now, mode: 'grade' }).text).toBe('4');
    expect(resolveCell(col, undefined, { best: null, started: true }, { now })).toMatchObject({ text: 'пишет', grade: null });
    expect(resolveCell(col, undefined, undefined, { now })).toMatchObject({ kind: 'online', text: 'долг', textTone: 'rose' });
  });
  it('ручная правка онлайн-клетки перекрывает попытки', () => {
    const col = { key: 'w:w1', id: 'c3', online: true, scale: 'percent' };
    const cell = resolveCell(col, { value: '70' }, undefined, { now: new Date('2026-09-20T12:00:00Z') });
    expect(cell).toMatchObject({ kind: 'override', text: '70%', grade: 4 });
    expect(cell.tip).toMatch(/Исправлено вручную/);
  });
});

describe('сводки', () => {
  const cols = [
    { key: 'a', online: false, scale: 'grade' },
    { key: 'b', online: false, scale: 'grade', weight: 2 },
    { key: 'c', online: false, scale: 'grade', no_avg: true },
    { key: 'd', online: false, scale: 'points', max_score: 20 },
  ];
  it('взвешенный средний, «не учитывать» пропускается', () => {
    const cells = [
      resolveCell(cols[0], { value: '5' }),
      resolveCell(cols[1], { value: '3' }),
      resolveCell(cols[2], { value: '2' }),
      resolveCell(cols[3], { value: 'н' }),
    ];
    const s = summarizeRow(cols, cells);
    expect(s.avg).toBeCloseTo((5 + 2 * 3) / 3);
    expect(s.absences).toBe(1);
    expect(s.debts).toBe(1);
    expect(formatAvg(s.avg)).toBe('3,7');
  });
  it('скрытая колонка не входит ни в средний, ни в долги', () => {
    const hidden = { key: 'h', online: false, scale: 'grade', hidden: true };
    const s = summarizeRow([cols[0], hidden], [resolveCell(cols[0], { value: '5' }), resolveCell(hidden, { value: 'н' })]);
    expect(s.avg).toBe(5);
    expect(s.debts).toBe(0);
  });
  it('долг по онлайн-работе считается, если клетку не исправили вручную', () => {
    const col = { key: 'w:w1', id: 'c1', online: true, assigned: true, scale: 'percent', deadline: '2026-09-15 00:00:00.000Z' };
    const now = new Date('2026-09-20T12:00:00Z');
    expect(summarizeRow([col], [resolveCell(col, undefined, undefined, { now })]).debts).toBe(1);
    expect(summarizeRow([col], [resolveCell(col, { value: '90' }, undefined, { now })]).debts).toBe(0);
  });
  it('сводка колонки: заполнено и средняя оценка', () => {
    const col = cols[0];
    const cells = [resolveCell(col, { value: '5' }), resolveCell(col, { value: '4' }), resolveCell(col, undefined)];
    expect(summarizeColumn(cells)).toEqual({ filled: 2, total: 3, avg: 4.5 });
  });
  it('buildGrid собирает строки и колонки', () => {
    const students = [{ id: 'st1', name: 'Аня' }, { id: 'st2', name: 'Боря' }];
    const col = { id: 'c1', key: 'm:c1', online: false, scale: 'points', max_score: 20 };
    const marks = indexMarks([{ col: 'c1', student: 'st1', value: '18' }]);
    const grid = buildGrid(students, [col], marks, new Map());
    expect(grid.rows[0].cells[0].text).toBe('18');
    expect(grid.rows[1].cells[0].kind).toBe('empty');
    expect(grid.colStats[0]).toMatchObject({ filled: 1, total: 2 });
  });
});

describe('выбывшие в сетке', () => {
  it('без долгов и вне сводок класса', () => {
    const col = { id: 'c1', key: 'w:w1', online: true, assigned: true, scale: 'percent', deadline: '2026-09-15 00:00:00.000Z' };
    const students = [{ id: 'a', name: 'Аня' }, { id: 'z', name: 'Зоя', former: true }];
    const grid = buildGrid(students, [col], new Map(), new Map(), { now: new Date('2026-09-20T12:00:00Z') });
    expect(grid.rows[0].summary.debts).toBe(1);
    expect(grid.rows[1].summary.debts).toBe(0);
    expect(grid.colStats[0].total).toBe(1);
  });
});

describe('ученики журнала', () => {
  it('выбывшие с отметками дописываются в конец, дубли — нет', () => {
    const list = journalStudents(
      [{ id: 'a', name: 'Яна' }],
      [{ id: 'a', name: 'Яна' }, { id: 'z', name: 'Борис' }, { id: 'y', name: 'Алла' }],
    );
    expect(list.map((s) => s.id)).toEqual(['a', 'y', 'z']);
    expect(list[1].former).toBe(true);
  });
});

describe('вставка из таблицы', () => {
  it('столбец из Google Таблиц (с хвостовым переводом строки)', () => {
    expect(parseClipboard('18\n15\n\n20\n')).toEqual([['18'], ['15'], [''], ['20']]);
  });
  it('блок с табуляцией и CRLF, одиночное значение', () => {
    expect(parseClipboard('5\t4\r\n3\t2')).toEqual([['5', '4'], ['3', '2']]);
    expect(parseClipboard(' 17 ')).toEqual([['17']]);
  });
  it('лишнее обрезается и считается', () => {
    const plan = planPaste([['1', '2'], ['3', '4'], ['5', '']], { row: 1, col: 1, rowCount: 3, colCount: 2 });
    expect(plan.cells).toEqual([{ r: 1, c: 1, raw: '1' }, { r: 2, c: 1, raw: '3' }]);
    expect(plan.clipped).toBe(3); // «2», «4», «5»; пустое не считается
  });
});

describe('мелочи', () => {
  it('следующее название колонки', () => {
    expect(suggestNextTitle('Устный счёт 3')).toBe('Устный счёт 4');
    expect(suggestNextTitle('Самостоятельная №9 (дроби)')).toBe('Самостоятельная №10 (дроби)');
    expect(suggestNextTitle('Опрос')).toBe('Опрос');
  });
  it('месяцы и период', () => {
    const cols = [{ day: '2026-09-09' }, { day: '2026-09-16' }, { day: '2026-10-02' }, { day: null }];
    expect(columnMonths(cols)).toEqual([
      { key: '2026-09', label: 'Сентябрь', count: 2 },
      { key: '2026-10', label: 'Октябрь', count: 1 },
    ]);
    expect(monthSpans(cols).map((s) => [s.label, s.span])).toEqual([['Сентябрь', 2], ['Октябрь', 1], ['Без даты', 1]]);
    expect(inPeriod(cols[2], '2026-10')).toBe(true);
    expect(inPeriod(cols[0], '2026-10')).toBe(false);
    expect(inPeriod(cols[3], 'all')).toBe(true);
  });
  it('выгрузка: TSV и CSV с кавычками', () => {
    const students = [{ id: 'st1', name: 'Иванов; Пётр' }];
    const col = { id: 'c1', key: 'm:c1', online: false, scale: 'grade', title: 'Опрос', day: '2026-09-23' };
    const grid = buildGrid(students, [col], indexMarks([{ col: 'c1', student: 'st1', value: '5' }]), new Map());
    const table = journalTable(grid, [col]);
    expect(table[0]).toEqual(['Ученик', 'Опрос (23.09)', 'Средний']);
    expect(toTsv(table).split('\n')[1]).toBe('Иванов; Пётр\t5\t5,0');
    expect(toCsv(table).split('\r\n')[1]).toBe('"Иванов; Пётр";5;5,0');
  });
});

describe('«н» из посещаемости урока', () => {
  const manual = { id: 'c1', key: 'm:c1', online: false, scale: 'points', max_score: 20, lessonId: 'L1' };
  const now = new Date('2026-09-20T12:00:00Z');

  it('отсутствовал — пустая клетка сама «н», в долгах', () => {
    const cell = resolveCell(manual, undefined, undefined, { attendance: 'absent' });
    expect(cell).toMatchObject({ kind: 'absent', text: 'н', absent: true, grade: null, fromAttendance: true, excused: false });
    expect(cell.tip).toMatch(/Не был на уроке/);
    expect(summarizeRow([manual], [cell])).toMatchObject({ absences: 1, debts: 1 });
  });

  it('уважительная — тоже «н», с пометкой', () => {
    const cell = resolveCell(manual, undefined, undefined, { attendance: 'excused' });
    expect(cell).toMatchObject({ text: 'н', excused: true });
    expect(cell.tip).toMatch(/уважительная/);
  });

  it('был или опоздал — клетка пустая', () => {
    expect(resolveCell(manual, undefined, undefined, { attendance: 'present' }).kind).toBe('empty');
    expect(resolveCell(manual, undefined, undefined, { attendance: 'late' }).kind).toBe('empty');
  });

  it('ручная отметка главнее посещаемости (написал позже)', () => {
    expect(resolveCell(manual, { value: '17' }, undefined, { attendance: 'absent' })).toMatchObject({ kind: 'manual', text: '17', grade: 5 });
  });

  it('комментарий к клетке сохраняется рядом с «н»', () => {
    const cell = resolveCell(manual, { value: '', comment: 'болел' }, undefined, { attendance: 'absent' });
    expect(cell).toMatchObject({ kind: 'absent', comment: 'болел' });
    expect(cell.tip).toMatch(/болел/);
  });

  it('онлайн-работа: не сдал и не был — «н» вместо «долга»; сдал из дома — результат', () => {
    const s = { id: 's1', work: 'w1', deadline: '2026-09-15 00:00:00.000Z', created: '2026-09-10 09:00:00.000Z' };
    const col = { key: 'w:w1', id: 'c2', online: true, assigned: true, scale: 'percent', deadline: s.deadline, lessonId: 'L1' };
    const missed = resolveCell(col, undefined, undefined, { now, attendance: 'absent' });
    expect(missed).toMatchObject({ kind: 'absent', text: 'н' });
    expect(summarizeRow([col], [missed])).toMatchObject({ absences: 1, overdue: 0, debts: 1 });
    const best = { score: 8, total: 10, status: 'submitted', submitted_at: '2026-09-12 10:00:00.000Z' };
    expect(resolveCell(col, undefined, { best, bestSession: s }, { now, attendance: 'absent' })).toMatchObject({ kind: 'online', text: '80%' });
  });

  it('сводка колонки считает «н» из посещаемости заполненной клеткой', () => {
    const cells = [
      resolveCell(manual, undefined, undefined, { attendance: 'absent' }),
      resolveCell(manual, { value: '15' }),
      resolveCell(manual, undefined),
    ];
    expect(summarizeColumn(cells)).toMatchObject({ filled: 2, total: 3 });
  });

  it('buildGrid берёт посещаемость урока колонки', () => {
    const students = [{ id: 'a', name: 'Аня' }, { id: 'b', name: 'Боря' }];
    const other = { ...manual, id: 'c3', key: 'm:c3', lessonId: '' };
    const attendance = indexAttendance([
      { lesson: 'L1', student: 'a', status: 'absent' },
      { lesson: 'L1', student: 'b', status: 'present' },
      { lesson: 'L2', student: 'b', status: 'absent' },
    ]);
    const grid = buildGrid(students, [manual, other], new Map(), new Map(), { attendance });
    expect(grid.rows[0].cells[0].text).toBe('н');
    expect(grid.rows[1].cells[0].kind).toBe('empty');
    // Колонка без урока посещаемость не читает.
    expect(grid.rows[0].cells[1].kind).toBe('empty');
  });

  it('колонка из БД несёт урок; день урока — фактический, если перенесли', () => {
    const cols = mergeColumns([{ id: 'x', title: 'Интенсив', lesson: 'L7', date: '2026-09-18 12:00:00.000Z' }]);
    expect(cols[0].lessonId).toBe('L7');
    expect(lessonDay({ date_plan: '2026-09-18 07:15:00.000Z', date_fact: '' })).toBe(localDay('2026-09-18 07:15:00.000Z'));
    expect(lessonDay({ date_plan: '2026-09-18 07:15:00.000Z', date_fact: '2026-09-19 07:15:00.000Z' })).toBe(localDay('2026-09-19 07:15:00.000Z'));
  });
});

describe('колонка по листу генератора', () => {
  it('устный счёт: баллы из числа заданий в варианте, категория и ссылка на лист', () => {
    expect(sheetColumnPreset({ id: 'S1', title: 'Устный счёт 4', generator: 'oral_counting', questions_count: 12 }))
      .toEqual({
        title: 'Устный счёт 4',
        scale: 'points',
        max_score: 12,
        category: 'Устный счёт',
        ref: { type: 'sheet', id: 'S1', generator: 'oral_counting', title: 'Устный счёт 4' },
      });
  });
  it('другие генераторы — «Самостоятельная»; без счётчика максимум не навязывается', () => {
    const p = sheetColumnPreset({ id: 'S2', title: '  ', generator: 'linear_equations' });
    expect(p).toMatchObject({ title: 'Лист генератора', category: 'Самостоятельная' });
    expect(p.max_score).toBeUndefined();
    expect(sheetColumnPreset(null)).toBe(null);
  });
  it('колонка листа находится по ссылке, из БД ссылка доезжает до колонки', () => {
    const cols = mergeColumns([
      { id: 'c1', title: 'Опрос' },
      { id: 'c2', title: 'Устный счёт 4', ref: { type: 'sheet', id: 'S1', generator: 'oral_counting' } },
    ]);
    expect(findSheetColumn(cols, 'S1')?.id).toBe('c2');
    expect(findSheetColumn(cols, 'S9')).toBe(null);
    expect(cols.find((c) => c.id === 'c1').ref).toBe(null);
  });
});

// ── Интенсив (v3.9.241) ─────────────────────────────────────────────────────

const grade = { scale: 'grade' };

describe('оценки с плюсами, вейтинг и «не писал»', () => {
  it('«4+», «4 -», «4−», «3=» — оценка с модификатором, хранится канонично', () => {
    expect(parseCellInput('4+', grade)).toEqual({ ok: true, stored: '4+' });
    expect(parseCellInput('4 -', grade)).toEqual({ ok: true, stored: '4-' });
    expect(parseCellInput('4−', grade)).toEqual({ ok: true, stored: '4-' });
    expect(parseCellInput('3=', grade)).toEqual({ ok: true, stored: '3=' });
    expect(parseCellInput('6+', grade).ok).toBe(false);
    expect(parseCellInput('4+', pts()).ok).toBe(false); // в баллах плюсов нет
  });
  it('«w» и «ц» (w в русской раскладке) — вейтинг в любой шкале', () => {
    for (const col of [grade, pts(), { scale: 'pass' }, { scale: 'percent' }]) {
      expect(parseCellInput('w', col)).toEqual({ ok: true, stored: WAIT });
      expect(parseCellInput('Ц', col)).toEqual({ ok: true, stored: WAIT });
    }
  });
  it('«—» и «-» — не писал; в шкале зачёта дефис остаётся незачётом', () => {
    expect(parseCellInput('—', grade)).toEqual({ ok: true, stored: SKIP });
    expect(parseCellInput('-', pts())).toEqual({ ok: true, stored: SKIP });
    expect(parseCellInput('-', { scale: 'pass' })).toEqual({ ok: true, stored: '0' });
    expect(parseCellInput('осв', { scale: 'pass' })).toEqual({ ok: true, stored: SKIP });
  });
  it('разбор и показ: в средний идёт цифра, на экране — с минусом', () => {
    expect(decodeValue('4-')).toEqual({ value: 4, absent: false, mod: '-' });
    expect(decodeValue(WAIT)).toMatchObject({ value: null, wait: true });
    expect(editText(grade, '4-')).toBe('4-');
    expect(editText(grade, WAIT)).toBe('w');
    expect(formatGrade(4, '-')).toBe('4−');
    const cell = resolveCell(grade, { value: '4-' });
    expect(cell).toMatchObject({ kind: 'manual', value: 4, grade: 4, text: '4−', tone: 'blue' });
    expect(resolveCell(grade, { value: '3=' }, undefined, { mode: 'grade' }).text).toBe('3=');
  });
  it('w — долг и не в среднем; «—» — ни то, ни другое', () => {
    const cols = [{ ...grade, key: 'a' }, { ...grade, key: 'b' }, { ...grade, key: 'c' }];
    const cells = [resolveCell(cols[0], { value: '4' }), resolveCell(cols[1], { value: WAIT }), resolveCell(cols[2], { value: SKIP })];
    expect(cells[1]).toMatchObject({ wait: true, grade: null, text: 'w', textTone: 'wait' });
    expect(cells[2]).toMatchObject({ skip: true, grade: null, text: '—' });
    expect(summarizeRow(cols, cells)).toMatchObject({ avg: 4, waits: 1, debts: 1, absences: 0 });
    // Обе отметки считаются внесёнными.
    expect(summarizeColumn([cells[1], cells[2]]).filled).toBe(2);
  });
});

const block = {
  id: 'B1', title: 'Производная', date_from: '2026-09-18 12:00:00.000Z', date_to: '2026-09-22 12:00:00.000Z', final_share: 40,
};
const d = (day) => `2026-09-${day} 12:00:00.000Z`;
// Интенсив: 18.09 — две работы и «за день», 19.09 — две работы и «за день»,
// зачёт из 20 и итог; вокруг — обычные колонки.
const intensiveStored = [
  { id: 'o1', title: 'Опрос', date: d(17), scale: 'grade', created: '1' },
  { id: 'tot', title: 'Итог', date: d(22), scale: 'grade', block: 'B1', role: 'total', created: '2' },
  { id: 'fin', title: 'Зачёт', date: d(22), scale: 'points', max_score: 20, block: 'B1', role: 'final', created: '3' },
  { id: 'd18', title: 'За день', date: d(18), scale: 'grade', block: 'B1', role: 'day', created: '4' },
  { id: 'd19', title: 'За день', date: d(19), scale: 'grade', block: 'B1', role: 'day', created: '5' },
  { id: 'w18a', title: 'У/с', date: d(18), scale: 'points', max_score: 20, block: 'B1', role: 'work', created: '6' },
  { id: 'w18b', title: 'Д/з', date: d(18), scale: 'points', max_score: 25, block: 'B1', created: '7' },
  { id: 'w19a', title: 'У/с', date: d(19), scale: 'points', max_score: 20, block: 'B1', role: 'work', created: '8' },
  { id: 'w19b', title: 'Ф-ч', date: d(19), scale: 'points', max_score: 10, block: 'B1', role: 'work', created: '9' },
  { id: 'o2', title: 'Самостоятельная', date: d(20), scale: 'points', max_score: 10, created: '10' },
];

describe('интенсив: колонки, шапка, дни', () => {
  it('колонки интенсива идут одним куском: по дням (работы, потом «за день»), зачёт и итог в конце', () => {
    const cols = mergeColumns(intensiveStored, new Map(), { blocks: [block] });
    expect(cols.map((c) => c.id)).toEqual(['o1', 'w18a', 'w18b', 'd18', 'w19a', 'w19b', 'd19', 'fin', 'tot', 'o2']);
    // Колонка интенсива без роли — работа дня.
    expect(cols.find((c) => c.id === 'w18b')).toMatchObject({ blockId: 'B1', role: 'work' });
    // Интенсив, которого нет (удалили), колонку не держит.
    const orphan = mergeColumns([{ id: 'x', title: 'x', block: 'B9', role: 'day' }], new Map(), { blocks: [block] });
    expect(orphan[0]).toMatchObject({ blockId: '', role: '' });
  });
  it('шапка: месяц над обычными колонками, название и даты — над интенсивом; границы дней', () => {
    const cols = mergeColumns(intensiveStored, new Map(), { blocks: [block] });
    const spans = headerSpans(cols, new Map([['B1', block]]));
    expect(spans.map((s) => [s.label, s.span])).toEqual([
      ['Сентябрь', 1], ['Интенсив · Производная · 18–22.09', 8], ['Сентябрь', 1],
    ]);
    expect(spans[1].blockId).toBe('B1');
    const sections = cols.map((_, i) => startsBlockSection(cols, i));
    // новый день (w19a) и хвост (fin) — границы; начало интенсива — не «день», а край блока
    expect(cols.filter((_, i) => sections[i]).map((c) => c.id)).toEqual(['w19a', 'fin']);
  });
  it('даты интенсива подписываются коротко', () => {
    expect(rangeLabel(d(18), d(22))).toBe('18–22.09');
    expect(rangeLabel('2026-09-29', '2026-10-02')).toBe('29.09–02.10');
    expect(rangeLabel(d(18), d(18))).toBe('18.09');
  });
  it('дни интенсива: по урокам класса; без уроков — все, кроме воскресенья', () => {
    const lessons = [
      { id: 'L1', date_plan: '2026-09-18 06:15:00.000Z', time_slot: '1-4' },
      { id: 'L2', date_plan: '2026-09-21 06:15:00.000Z', time_slot: '1-4' },
      { id: 'L3', date_plan: '2026-09-21 12:00:00.000Z', time_slot: '5' },
      { id: 'L4', date_plan: '2026-09-22 06:15:00.000Z', status: 'cancelled' },
      { id: 'L5', date_plan: '2026-09-25 06:15:00.000Z' },
    ];
    expect(intensiveDays(d(18), d(22), lessons).map((x) => [x.day, x.lesson?.id || null])).toEqual([
      ['2026-09-18', 'L1'],
      ['2026-09-21', null], // два урока в день — не угадываем
    ]);
    expect(intensiveDays(d(18), d(22), []).map((x) => x.day))
      .toEqual(['2026-09-18', '2026-09-19', '2026-09-21', '2026-09-22']);
    expect(intensiveDays(d(22), d(18), [])).toEqual([]);
  });
  it('доля зачёта: из интенсива, с пределами, пусто — 40 %', () => {
    expect(finalShareOf(block)).toBe(40);
    expect(finalShareOf({ final_share: 0 })).toBe(0);
    expect(finalShareOf({ final_share: 120 })).toBe(90);
    expect(finalShareOf({})).toBe(40);
  });
});

describe('интенсив: подсказки «за день» и «итог»', () => {
  const marks = [
    // Алексеева: 18.09 «за день» — «5−» от учителя; 19.09 работы 18/20 (→5) и 5/10 (→3), дня нет;
    // зачёт 12/20 (60 % → 3). Дни: 5 и 4 → 4,5; итог = 4,5·0,6 + 3·0,4 = 3,9.
    { col: 'd18', student: 's1', value: '5-' },
    { col: 'w18a', student: 's1', value: '10' },
    { col: 'w19a', student: 's1', value: '18' },
    { col: 'w19b', student: 's1', value: '5' },
    { col: 'fin', student: 's1', value: '12' },
    // Борисов: болел 19.09 («w» за день), зачёт — вейтинг.
    { col: 'w18a', student: 's2', value: '20' },
    { col: 'd19', student: 's2', value: 'w' },
    { col: 'fin', student: 's2', value: 'w' },
  ];
  const students = [{ id: 's1', name: 'Алексеева' }, { id: 's2', name: 'Борисов' }];
  const all = mergeColumns(intensiveStored, new Map(), { blocks: [block] });

  it('картина ученика: день — оценка учителя, иначе средняя по работам; итог с весом зачёта', () => {
    const entries = all.filter((c) => c.blockId).map((col) => ({
      col, cell: resolveCell(col, marks.find((m) => m.col === col.id && m.student === 's1')),
    }));
    const sum = intensiveSummary(block, entries);
    expect(sum.days.map((x) => [x.day, x.value, x.source])).toEqual([
      ['2026-09-18', 5, 'teacher'],
      ['2026-09-19', 4, 'works'],
    ]);
    expect(sum.final.grade).toBe(3);
    expect(sum.value).toBeCloseTo(3.9, 5);
    expect(sum.pending).toBe(false);
  });

  it('пустые «за день» и «итог» показывают подсказку; она не отметка', () => {
    const grid = buildGrid(students, all, indexMarks(marks), new Map(), { blocks: [block] });
    const at = (r, id) => grid.rows[r].cells[all.findIndex((c) => c.id === id)];
    expect(at(0, 'd18')).toMatchObject({ kind: 'manual', text: '5−' });
    expect(at(0, 'd19')).toMatchObject({ kind: 'hint', text: '≈4,0', textTone: 'hint' });
    expect(at(0, 'tot')).toMatchObject({ kind: 'hint', text: '≈3,9' });
    expect(at(0, 'tot').tip).toMatch(/Дни 60 % \+ зачёт 40 % = 3,9/);
    // Подсказка не «внесена» и не в среднем.
    const totIdx = all.findIndex((c) => c.id === 'tot');
    expect(grid.colStats[totIdx].filled).toBe(0);
    // В средний за год интенсив идёт только итогом: у Алексеевой итога нет —
    // в среднем только обычные колонки (их у неё нет).
    expect(grid.rows[0].summary.avg).toBe(null);
  });

  it('зачёт — вейтинг: итог «w?» (ждём пересдачи), вейтинги — в долгах', () => {
    const grid = buildGrid(students, all, indexMarks(marks), new Map(), { blocks: [block] });
    const tot = grid.rows[1].cells[all.findIndex((c) => c.id === 'tot')];
    expect(tot).toMatchObject({ kind: 'hint', text: 'w?' });
    expect(grid.rows[1].summary.waits).toBe(2);
    expect(grid.rows[1].summary.debts).toBe(2);
  });

  it('итог, поставленный учителем, идёт в средний за год; работы интенсива — нет', () => {
    const withTotal = [...marks, { col: 'tot', student: 's1', value: '4-' }, { col: 'o1', student: 's1', value: '5' }];
    const grid = buildGrid(students, all, indexMarks(withTotal), new Map(), { blocks: [block] });
    expect(grid.rows[0].cells[all.findIndex((c) => c.id === 'tot')].text).toBe('4−');
    expect(grid.rows[0].summary.avg).toBe(4.5); // «5» за опрос и «4−» итог
  });

  it('свёрнутый интенсив: работ в сетке нет, а подсказки считаются по ним же', () => {
    const visible = all.filter((c) => !(c.blockId && c.role === 'work'));
    const grid = buildGrid(students, visible, indexMarks(marks), new Map(), { blocks: [block], blockColumns: all.filter((c) => c.blockId) });
    const at = (id) => grid.rows[0].cells[visible.findIndex((c) => c.id === id)];
    expect(at('d19').text).toBe('≈4,0');
    expect(at('tot').text).toBe('≈3,9');
  });

  it('подсказки в выгрузку не попадают', () => {
    const grid = buildGrid(students, all, indexMarks(marks), new Map(), { blocks: [block] });
    const table = journalTable(grid, all);
    const totIdx = all.findIndex((c) => c.id === 'tot') + 1;
    expect(table[1][totIdx]).toBe('');
    expect(table[2][totIdx]).toBe('');
  });
});

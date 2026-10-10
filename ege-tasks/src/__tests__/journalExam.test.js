import { describe, it, expect } from 'vitest';
import {
  blockKind, blockKindLabel, buildGrid, examSummary, headerSpans, indexMarks, isExamBlock,
  mergeColumns, roleLabel, startsBlockSection, summarizeRow, EXAM_PART_PRESETS,
} from '../utils/classJournal';
import {
  buildBlockFeedbackData, buildExamFeedbackData, buildFeedbackData, genderOf,
} from '../utils/intensiveFeedback';
import {
  buildFeedbackMessages, EXAM_FEEDBACK_RULES, FEEDBACK_RULES, isExamData,
} from '../../../pocketbase/feedback-prompt.mjs';

// Зачёт для 8 класса (решение пользователя 10.10.2026): устный счёт, работа
// на остаточные знания за 7 класс, пять задач на параллелограмм, билет
// (определение + доказательство свойства или признака).
const d = '2026-10-09 12:00:00.000Z';
const block = { id: 'Z1', kind: 'credit', title: 'Параллелограмм', date_from: d, date_to: d };
const inZ = (extra) => ({ group: 'g1', source: 'manual', block: 'Z1', date: d, category: 'Зачёт', ...extra });
const stored = [
  inZ({ id: 'p1', title: 'Устный счёт', role: 'work', format: 'written', scale: 'points', max_score: 10, created: '1' }),
  inZ({ id: 'p2', title: 'Остаточные знания за 7 класс', role: 'work', format: 'written', scale: 'points', max_score: 10, created: '2' }),
  inZ({ id: 'p3', title: 'Задачи', role: 'work', format: 'written', scale: 'points', max_score: 5, note: 'Задачи на параллелограмм', created: '3' }),
  inZ({ id: 'p4', title: 'Билет', role: 'work', format: 'oral', scale: 'grade', weight: 2, created: '4' }),
  inZ({ id: 'tot', title: 'Итог', role: 'total', scale: 'grade', created: '5' }),
];
const students = [
  { id: 's1', name: 'Дрибинская Ксения' },
  { id: 's2', name: 'Куприн Леонид' },
  { id: 's3', name: 'Ли Никита' },
];
const marks = [
  // s1: 9/10 → 5, 7/10 → 4, 5/5 → 5, билет 5 (вес 2) → (5+4+5+10)/5 = 4,8
  { col: 'p1', student: 's1', value: '9' }, { col: 'p2', student: 's1', value: '7' },
  { col: 'p3', student: 's1', value: '5' }, { col: 'p4', student: 's1', value: '5' },
  // s2: билет — вейтинг (болел), итог ждёт
  { col: 'p1', student: 's2', value: '6' }, { col: 'p2', student: 's2', value: '5' },
  { col: 'p3', student: 's2', value: '2' }, { col: 'p4', student: 's2', value: 'w' },
  // s3: итог выставлен учителем
  { col: 'p1', student: 's3', value: '4' }, { col: 'p2', student: 's3', value: '3' },
  { col: 'p3', student: 's3', value: '1' }, { col: 'p4', student: 's3', value: '3' },
  { col: 'tot', student: 's3', value: '3' },
];
const columns = mergeColumns(stored, new Map(), { blocks: [block] });
const grid = buildGrid(students, columns, indexMarks(marks), new Map(), { blocks: [block] });
const totalAt = columns.findIndex((c) => c.role === 'total');

describe('вид блока', () => {
  it('зачёт и экзамен — по kind, пустое и старое — интенсив', () => {
    expect(blockKind({ kind: 'credit' })).toBe('credit');
    expect(blockKind({ kind: 'exam' })).toBe('exam');
    expect(blockKind({ kind: 'intensive' })).toBe('intensive');
    expect(blockKind({ kind: '' })).toBe('intensive');
    expect(blockKind(null)).toBe('intensive');
    expect(isExamBlock(block)).toBe(true);
    expect(isExamBlock({ kind: 'intensive' })).toBe(false);
    expect(blockKindLabel({ kind: 'exam' })).toBe('Экзамен');
  });

  it('подписи ролей: «Часть зачёта», «Итог экзамена»; у интенсива — прежние', () => {
    expect(roleLabel(block, 'work')).toBe('Часть зачёта');
    expect(roleLabel({ kind: 'exam' }, 'total')).toBe('Итог экзамена');
    expect(roleLabel({ kind: 'intensive' }, 'day')).toBe('Оценка за день');
  });

  it('заготовки частей: у баллов есть максимум, формат задан', () => {
    for (const p of EXAM_PART_PRESETS) {
      expect(['written', 'oral']).toContain(p.format);
      if (p.scale === 'points') expect(p.max_score).toBeGreaterThan(0);
    }
  });
});

describe('колонки зачёта в журнале', () => {
  it('части по порядку создания, итог в конце, письменно/устно — из format', () => {
    expect(columns.map((c) => c.title)).toEqual([
      'Устный счёт', 'Остаточные знания за 7 класс', 'Задачи', 'Билет', 'Итог',
    ]);
    expect(columns.map((c) => c.format)).toEqual(['written', 'written', 'written', 'oral', '']);
    // Граница перед итогом, частям одного дня — нет.
    expect(startsBlockSection(columns, 1)).toBe(false);
    expect(startsBlockSection(columns, totalAt)).toBe(true);
  });

  it('шапка — «Зачёт · тема · дата»', () => {
    const spans = headerSpans(columns, new Map([[block.id, block]]));
    expect(spans).toEqual([{ key: 'b:Z1', span: 5, blockId: 'Z1', label: 'Зачёт · Параллелограмм · 09.10' }]);
  });

  it('в средний за год зачёт идёт только итогом', () => {
    const row = grid.rows[2];
    expect(summarizeRow(columns, row.cells).avg).toBe(3);
    // Без итога части в средний не идут вовсе.
    expect(summarizeRow(columns, grid.rows[0].cells).avg).toBeNull();
  });
});

describe('подсказка итога по частям', () => {
  it('средняя оценок частей с весами колонок', () => {
    const cell = grid.rows[0].cells[totalAt];
    expect(cell.kind).toBe('hint');
    expect(cell.text).toBe('≈4,8');
    expect(cell.tip).toMatch(/Билет \(устно\): 5, вес ×2/);
    expect(cell.tip).toMatch(/итог ставит учитель/);
  });

  it('вейтинг или «н» в части — «w?», итог после пересдачи', () => {
    const cell = grid.rows[1].cells[totalAt];
    expect(cell.text).toBe('w?');
    expect(cell.pending).toBe(true);
    expect(cell.tip).toMatch(/Билет \(устно\): w — ждём пересдачи/);
  });

  it('выставленный итог подсказкой не перекрывается', () => {
    const cell = grid.rows[2].cells[totalAt];
    expect(cell.kind).toBe('manual');
    expect(cell.text).toBe('3');
  });

  it('итог «зачёт/незачёт»: «зач?» когда всё сдано, «н/з?» при двойке или незачёте части', () => {
    const passStored = stored.map((c) => (c.id === 'tot' ? { ...c, scale: 'pass' } : c))
      .concat(inZ({ id: 'p5', title: 'Теория: определения', role: 'work', format: 'oral', scale: 'pass', created: '4b' }));
    const cols = mergeColumns(passStored, new Map(), { blocks: [block] });
    const t = cols.findIndex((c) => c.role === 'total');
    const m = [
      ...marks.filter((x) => x.student === 's1'),
      { col: 'p5', student: 's1', value: '1' },
      ...marks.filter((x) => x.student === 's3' && x.col !== 'tot'),
      { col: 'p5', student: 's3', value: '0' },
    ];
    const g = buildGrid(students, cols, indexMarks(m), new Map(), { blocks: [block] });
    expect(g.rows[0].cells[t].text).toBe('зач?');
    expect(g.rows[2].cells[t].text).toBe('н/з?');
    expect(g.rows[2].cells[t].tip).toMatch(/Не сдано: «Устный счёт», .*«Задачи», «Теория: определения»$/);
    // Ничего не внесено — подсказки нет.
    expect(g.rows[1].cells[t].kind).toBe('empty');
  });

  it('examSummary: состояния частей', () => {
    const entries = columns.map((col, i) => ({ col, cell: grid.rows[1].cells[i] }));
    const sum = examSummary(block, entries);
    // 6/10 → 4, 5/10 (50 %) → 3, 2/5 (40 %) → 2, билет — вейтинг.
    expect(sum.parts.map((p) => p.state)).toEqual(['done', 'done', 'fail', 'wait']);
    expect(sum.pending).toBe(true);
    expect(sum.failed.map((p) => p.title)).toEqual(['Задачи']);
  });

  it('интенсив считается как раньше — зачёт его не задевает', () => {
    const intensive = { id: 'B1', title: 'Логарифмы', date_from: '2026-09-18 12:00:00.000Z', date_to: '2026-09-18 12:00:00.000Z' };
    const cols = mergeColumns([
      { id: 'w', title: 'У/с', scale: 'points', max_score: 20, block: 'B1', role: 'work', date: '2026-09-18 12:00:00.000Z', created: '1' },
      { id: 't', title: 'Итог', scale: 'grade', block: 'B1', role: 'total', date: '2026-09-18 12:00:00.000Z', created: '2' },
    ], new Map(), { blocks: [intensive] });
    const g = buildGrid([{ id: 's1' }], cols, indexMarks([{ col: 'w', student: 's1', value: '18' }]), new Map(), { blocks: [intensive] });
    expect(g.rows[0].cells[1].text).toBe('≈5,0');
    expect(headerSpans(cols, new Map([['B1', intensive]]))[0].label).toBe('Интенсив · Логарифмы · 18.09');
  });
});

describe('обратная связь по зачёту', () => {
  const data = (id) => buildExamFeedbackData(columns, grid.rows, id, {
    gender: genderOf(students.find((s) => s.id === id)), title: block.title,
  });

  it('🚨 ни фамилий, ни имён — ни у кого из класса', () => {
    for (const s of students) {
      const json = JSON.stringify(data(s.id));
      for (const other of students) {
        for (const word of other.name.split(' ')) expect(json).not.toContain(word);
      }
      expect(json).not.toMatch(/Ксюша|Лёня/);
    }
  });

  it('части: как сдавали, тема — из заметки или понятного названия', () => {
    const x = data('s1');
    expect(x.мероприятие).toBe('зачёт');
    expect(x.тема).toBe('Параллелограмм');
    expect(x.части.map((p) => p.как_сдавали)).toEqual(['письменно', 'письменно', 'письменно', 'устно']);
    expect(x.части.map((p) => p.что_проверяла)).toEqual([
      'Устный счёт', 'Остаточные знания за 7 класс', 'Задачи на параллелограмм', 'Билет',
    ]);
    expect(x.части[0].результат).toBe('90%');
    expect(x.части[3].результат).toBe('5');
    expect(x.пересдача).toBe('нет');
    expect(x.рейтинг).toBe('нет');
    expect(x.сильные_стороны.length).toBeGreaterThan(0);
  });

  it('сокращения учителя модели не уходят', () => {
    const cols = mergeColumns([
      inZ({ id: 'a', title: 'У/с', role: 'work', format: 'written', scale: 'points', max_score: 10 }),
      inZ({ id: 'b', title: 'Экв.', role: 'work', format: 'written', scale: 'points', max_score: 10 }),
      inZ({ id: 'c', title: 'ОЗ', role: 'work', format: 'written', scale: 'points', max_score: 10 }),
    ], new Map(), { blocks: [block] });
    const g = buildGrid(students, cols, indexMarks([]), new Map(), { blocks: [block] });
    const x = buildExamFeedbackData(cols, g.rows, 's1');
    expect(x.части.map((p) => p.что_проверяла)).toEqual(['не описано', 'не описано', 'не описано']);
    expect(JSON.stringify(x)).not.toMatch(/У\/с|Экв|ОЗ/);
  });

  it('вейтинг по части — в слабых местах, итог «w» — пересдача', () => {
    const x = data('s2');
    expect(x.слабые_места.join(' ')).toMatch(/не сдавал: «Билет» \(устно\)/);
    const m = [...marks, { col: 'tot', student: 's2', value: 'w' }];
    const g = buildGrid(students, columns, indexMarks(m), new Map(), { blocks: [block] });
    expect(buildExamFeedbackData(columns, g.rows, 's2').пересдача).toBe('да');
  });

  it('buildBlockFeedbackData выбирает сборщик по виду блока', () => {
    expect(buildBlockFeedbackData(block, columns, grid.rows, 's1').мероприятие).toBe('зачёт');
    expect(buildBlockFeedbackData({ ...block, kind: 'exam' }, columns, grid.rows, 's1').мероприятие).toBe('экзамен');
    const intensive = buildBlockFeedbackData({ id: 'B', kind: 'intensive' }, columns, grid.rows, 's1');
    expect(intensive.мероприятие).toBeUndefined();
    expect(intensive).toEqual(buildFeedbackData(columns, grid.rows, 's1'));
  });

  it('промпт: у зачёта свои правила, у интенсива — прежние', () => {
    const x = data('s1');
    expect(isExamData(x)).toBe(true);
    const [sys, user] = buildFeedbackMessages(x, 'образец');
    expect(sys.content.startsWith(EXAM_FEEDBACK_RULES)).toBe(true);
    expect(sys.content).toMatch(/бери из них только тон/);
    expect(user.content).toMatch(/^Данные ученика по зачёту:/);
    const [sys2, user2] = buildFeedbackMessages({ пол: 'ученик', дни: [] });
    expect(sys2.content).toBe(FEEDBACK_RULES);
    expect(user2.content).toMatch(/^Данные ученика по интенсиву:/);
  });
});

// ── Оценка с точкой — дозачёт (v3.9.335) ───────────────────────────────────
import {
  decodeValue, editText, parseCellInput, resolveCell, retakeHistoryComment, isRetake,
} from '../utils/classJournal';
import { cleanFeedback } from '../../../pocketbase/feedback-prompt.mjs';

describe('оценка с точкой — дозачёт', () => {
  const gradeCol = { scale: 'grade', title: 'Итог' };

  it('ввод: «.4-», «. 4 −», «.3», «.5+» — в шкале оценки; в баллах точка не оценка', () => {
    expect(parseCellInput('.4-', gradeCol)).toEqual({ ok: true, stored: '.4-' });
    expect(parseCellInput('. 4 −', gradeCol)).toEqual({ ok: true, stored: '.4-' });
    expect(parseCellInput('.3', gradeCol)).toEqual({ ok: true, stored: '.3' });
    expect(parseCellInput('.5+', gradeCol)).toEqual({ ok: true, stored: '.5+' });
    expect(parseCellInput('.6', gradeCol).ok).toBe(false);
    expect(parseCellInput('.4', { scale: 'points', max_score: 10 }).ok).toBe(false);
  });

  it('хранение и показ: цифра в средний, «.4−» на экране, правка — как ввели', () => {
    expect(decodeValue('.4-')).toMatchObject({ value: 4, mod: '-', retake: true });
    expect(isRetake('.3')).toBe(true);
    expect(isRetake('4-')).toBe(false);
    expect(editText(gradeCol, '.4-')).toBe('.4-');
    const cell = resolveCell(gradeCol, { value: '.4-' }, undefined, {});
    expect(cell).toMatchObject({ text: '.4−', grade: 4, retake: true, tone: 'blue' });
    expect(cell.tip).toMatch(/^Дозачёт/);
  });

  it('в средний — цифрой, в «Долги» — да', () => {
    const cols = [{ id: 'a', scale: 'grade' }, { id: 'b', scale: 'grade' }];
    const cells = [resolveCell(cols[0], { value: '.4-' }, undefined, {}), resolveCell(cols[1], { value: '5' }, undefined, {})];
    const sum = summarizeRow(cols, cells);
    expect(sum.avg).toBe(4.5);
    expect(sum.retakes).toBe(1);
    expect(sum.debts).toBe(1);
  });

  it('сдал дозачёт — прежняя оценка с точкой уходит в комментарий', () => {
    expect(retakeHistoryComment('.4-', '5', 'Дозачёт по практике')).toBe('до дозачёта: .4−\nДозачёт по практике');
    expect(retakeHistoryComment('.3', '4', '')).toBe('до дозачёта: .3');
    // Повторная правка не дублирует строку; правка с точкой на точку — без истории.
    expect(retakeHistoryComment('.3', '4', 'до дозачёта: .3')).toBe('до дозачёта: .3');
    expect(retakeHistoryComment('.3', '.4', 'x')).toBe('x');
    expect(retakeHistoryComment('4', '5', 'x')).toBe('x');
    expect(retakeHistoryComment('.4', '', 'x')).toBe('x');
  });

  it('точка в части зачёта — итог подсказывается с точкой', () => {
    const m = [
      { col: 'p1', student: 's1', value: '9' }, { col: 'p2', student: 's1', value: '7' },
      { col: 'p3', student: 's1', value: '5' }, { col: 'p4', student: 's1', value: '.4' },
    ];
    const g = buildGrid(students, columns, indexMarks(m), new Map(), { blocks: [block] });
    const cell = g.rows[0].cells[totalAt];
    expect(cell.text).toBe('≈.4,4'); // (5 + 4 + 5 + 4·2) / 5
    expect(cell.tip).toMatch(/Билет \(устно\): \.4, вес ×2/);
    expect(cell.tip).toMatch(/Дозачёт: «Билет» — итог с точкой/);
  });

  it('отзыв: итог или часть с точкой → «дозачёт: да», без точки — «нет» и фраза вырезается', () => {
    const m = [...marks, { col: 'tot', student: 's1', value: '.4-' }];
    const g = buildGrid(students, columns, indexMarks(m), new Map(), { blocks: [block] });
    const x = buildExamFeedbackData(columns, g.rows, 's1');
    expect(x.дозачёт).toBe('да');
    expect(x.пересдача).toBe('нет');
    const m2 = [...marks.filter((k) => !(k.col === 'p3' && k.student === 's1')), { col: 'p3', student: 's1', value: '5' }];
    const m3 = m2.map((k) => (k.col === 'p4' && k.student === 's1' ? { ...k, value: '.4' } : k));
    const g3 = buildGrid(students, columns, indexMarks(m3), new Map(), { blocks: [block] });
    const y = buildExamFeedbackData(columns, g3.rows, 's1');
    expect(y.дозачёт).toBe('да');
    expect(y.дозачёт_по).toEqual(['«Билет» (устно)']);
    const z = buildExamFeedbackData(columns, grid.rows, 's1');
    expect(z.дозачёт).toBe('нет');
    expect(cleanFeedback('{ИМЯ}, молодец. Ждём тебя на дозачёте.', z)).toBe('{ИМЯ}, молодец.');
    expect(cleanFeedback('{ИМЯ}, молодец. Ждём тебя на дозачёте.', x)).toMatch(/дозачёте/);
  });
});

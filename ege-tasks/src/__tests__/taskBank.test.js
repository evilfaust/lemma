import { describe, it, expect } from 'vitest';
import {
  UNSET_DIFFICULTY, THIN_TOPIC,
  countSnapshot, topicRows, subtopicRows, tagRows, sourceRows, difficultyRows, yearRows,
  examMix, countByTopic, usageStats, examCoverage, coverageSummary, hardestTasks, share,
} from '../utils/taskBank';
import { filtersToSearch, parseFiltersFromSearch } from '../utils/taskListLink';

// «Банк задач» (v3.9.387): один подсчёт на обзор и все вкладки.

const TOPICS = [
  { id: 'b1', title: 'Простейшие уравнения', exam_type: 'ege_base', ege_number: 1 },
  { id: 'b2', title: 'Проценты', exam_type: 'ege_base', ege_number: 2 },
  { id: 'b3', title: 'Старая тема', exam_type: 'ege_base', ege_number: 3, archived: true },
  { id: 'p1', title: 'Планиметрия', exam_type: 'ege_profile', ege_number: 1, exam_part: 1 },
  { id: 'p14', title: 'Стереометрия', exam_type: 'ege_profile', ege_number: 14, exam_part: 2 },
  { id: 'x', title: 'Разное', exam_type: 'other' },
];

const SNAPSHOT = [
  { id: 't1', topic: 'b1', subtopic: ['s1'], tags: ['g1', 'g2'], difficulty: '1', source: 'Решу', year: 2025, has_image: true },
  { id: 't2', topic: 'b1', subtopic: 's1', tags: 'g1', difficulty: '2', source: 'Решу', year: 2026 },
  { id: 't3', topic: 'b2', subtopic: [], tags: [], difficulty: '', source: 'ФИПИ' },
  { id: 't4', topic: 'p1', tags: [], difficulty: 0 },
  { id: 't5', topic: '', tags: [], difficulty: '1' },
];

describe('countSnapshot', () => {
  const c = countSnapshot(SNAPSHOT);

  it('считает задачи по темам, подтемам, тегам, источникам и годам', () => {
    expect(c.total).toBe(5);
    expect(c.byTopic.get('b1')).toBe(2);
    expect(c.noTopic).toBe(1);
    expect(c.bySubtopic.get('s1')).toBe(2); // и массив, и строка
    expect(c.byTag.get('g1')).toBe(2);
    expect(c.bySource.get('Решу')).toBe(2);
    expect(c.byYear.get(2026)).toBe(1);
    expect(c.withImage).toBe(1);
  });

  it('пустая сложность — «не указана», ноль остаётся нулём (а не «1»)', () => {
    expect(c.byDifficulty.get(UNSET_DIFFICULTY)).toBe(1);
    expect(c.byDifficulty.get('0')).toBe(1);
    expect(c.byDifficulty.get('1')).toBe(2);
    const rows = difficultyRows(c).map((r) => r.difficulty);
    expect(rows).toEqual(['0', '1', '2', UNSET_DIFFICULTY]);
  });
});

describe('строки вкладок', () => {
  const c = countSnapshot(SNAPSHOT);

  it('темы и теги — по убыванию числа задач, с исходной записью', () => {
    const rows = topicRows(TOPICS, c);
    expect(rows[0]).toMatchObject({ key: 'b1', count: 2 });
    expect(rows.find((r) => r.key === 'p14').count).toBe(0);
    expect(rows[0].raw).toBe(TOPICS[0]);
    expect(tagRows([{ id: 'g1', title: 'A' }, { id: 'g2', title: 'B' }], c)[0].key).toBe('g1');
  });

  it('подтема подписана темой с номером', () => {
    const rows = subtopicRows([{ id: 's1', name: 'Линейные', topic: 'b1' }], TOPICS, c);
    expect(rows[0]).toMatchObject({ title: 'Линейные', topicTitle: '№1 Простейшие уравнения', count: 2 });
  });

  it('источники — из справочника и из задач без повторов', () => {
    const rows = sourceRows(['ФИПИ', 'МЦНМО'], c);
    expect(rows.map((r) => r.source)).toEqual(['Решу', 'ФИПИ', 'МЦНМО']);
    expect(rows.find((r) => r.source === 'МЦНМО').count).toBe(0);
  });

  it('годы — от свежих', () => {
    expect(yearRows(c).map((r) => r.year)).toEqual([2026, 2025]);
  });
});

describe('examMix', () => {
  it('задачи по контексту темы плюс «без темы»', () => {
    const mix = examMix(TOPICS, countSnapshot(SNAPSHOT));
    const byKey = Object.fromEntries(mix.map((m) => [m.key, m.count]));
    expect(byKey).toEqual({ ege_base: 3, ege_profile: 1, notopic: 1 });
    expect(mix.find((m) => m.key === 'notopic').label).toBe('Без темы');
  });
});

describe('usageStats', () => {
  const topicOf = new Map(SNAPSHOT.map((t) => [t.id, t.topic]));

  it('задачи в работах и решаемость по темам', () => {
    const u = usageStats({
      variants: [{ work: 'w1', tasks: ['t1', 't2'] }, { work: 'w1', tasks: ['t1'] }, { work: 'w2', tasks: ['t4'] }],
      statsByTask: { t1: { c: 3, n: 4 }, t2: { c: 1, n: 4 }, t9: { c: 1, n: 1 } },
      topicOf,
    });
    expect(u.usedTasks).toBe(3);
    expect(u.works).toBe(2);
    expect(u.usedByTopic.get('b1')).toBe(2);
    expect(u.solveByTopic.get('b1')).toEqual({ c: 4, n: 8 });
    expect(u.answers).toBe(9);
    expect(u.rate).toBeCloseTo(5 / 9);
  });

  it('без данных — нули и rate = null', () => {
    const u = usageStats({});
    expect(u.usedTasks).toBe(0);
    expect(u.rate).toBeNull();
  });
});

describe('examCoverage', () => {
  const counts = countSnapshot(SNAPSHOT);

  it('строка на задание экзамена по номеру, без архивных тем', () => {
    const rows = examCoverage({ topics: TOPICS, examType: 'ege_base', counts });
    expect(rows.map((r) => r.number)).toEqual([1, 2]);
    expect(rows[0]).toMatchObject({ count: 2, level: 'thin', answerShare: 1 });
  });

  it('доли с ответом/решением по признакам, пустая тема — «empty»', () => {
    const rows = examCoverage({
      topics: TOPICS,
      examType: 'ege_profile',
      counts,
      flags: { noAnswer: countByTopic(['p1']), noSolution: new Map(), review: countByTopic(['p1', 'p1']) },
    });
    expect(rows[0]).toMatchObject({ topicId: 'p1', answerShare: 0, solutionShare: 1, review: 2, part: 1 });
    expect(rows[1]).toMatchObject({ topicId: 'p14', level: 'empty', answerShare: null, part: 2 });
  });

  it('использование: сколько задач темы в работах и как решают', () => {
    const usage = usageStats({
      variants: [{ tasks: ['t1'] }],
      statsByTask: { t1: { c: 1, n: 2 } },
      topicOf: new Map(SNAPSHOT.map((t) => [t.id, t.topic])),
    });
    const [b1, b2] = examCoverage({ topics: TOPICS, examType: 'ege_base', counts, usage });
    expect(b1.used).toBe(1);
    expect(b1.solve).toMatchObject({ c: 1, n: 2, rate: 0.5 });
    expect(b2.used).toBe(0);
    expect(b2.solve).toBeNull();
  });

  it('сводка: пустые, тонкие, ни разу не выдавались', () => {
    const many = Array.from({ length: THIN_TOPIC }, (_, i) => ({ id: `m${i}`, topic: 'b2' }));
    const counts2 = countSnapshot([...SNAPSHOT, ...many]);
    const usage = usageStats({ variants: [], statsByTask: {}, topicOf: new Map() });
    const s = coverageSummary(examCoverage({ topics: TOPICS, examType: 'ege_base', counts: counts2, usage }));
    expect(s).toMatchObject({ topics: 2, empty: 0, thin: 1, unused: 2 });
  });
});

describe('hardestTasks', () => {
  it('от худшей решаемости, только при достаточном числе ответов', () => {
    const byId = new Map(SNAPSHOT.map((t) => [t.id, t]));
    const list = hardestTasks({
      t1: { c: 4, n: 5 }, t2: { c: 1, n: 10 }, t3: { c: 0, n: 2 }, zz: { c: 0, n: 50 },
    }, byId);
    expect(list.map((h) => h.id)).toEqual(['t2', 't1']);
    expect(list[0].rate).toBeCloseTo(0.1);
  });
});

describe('share', () => {
  it('делить не на что — null', () => {
    expect(share(1, 0)).toBeNull();
    expect(share(1, 4)).toBe(0.25);
  });
});

describe('taskListLink — фильтры «Всех задач» в адресе', () => {
  const roundTrip = (f) => parseFiltersFromSearch(new URLSearchParams(filtersToSearch(f).slice(1)));

  it('теги возвращаются массивом (раньше — строкой, и список падал)', () => {
    expect(filtersToSearch({ tags: ['a', 'b'] })).toBe('?tags=a%2Cb');
    expect(roundTrip({ tags: ['a', 'b'] })).toEqual({ tags: ['a', 'b'] });
  });

  it('булевы признаки — булевы: «без ответа» не превращается в «с ответом»', () => {
    expect(roundTrip({ hasAnswer: false, hasImage: true })).toEqual({ hasAnswer: false, hasImage: true });
  });

  it('год — числом, пустые значения выбрасываются', () => {
    expect(roundTrip({ year: 2025, topic: '', source: null, issue: 'latex' })).toEqual({ year: 2025, issue: 'latex' });
    expect(filtersToSearch(null)).toBe('');
    expect(parseFiltersFromSearch(new URLSearchParams(''))).toBeNull();
  });
});

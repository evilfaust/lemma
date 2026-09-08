import { describe, it, expect } from 'vitest';
import {
  academicYearOf, currentAcademicYear, parseAcademicYear, isValidAcademicYear,
  normalizeAcademicYear, nextAcademicYear, prevAcademicYear, compareAcademicYears,
  collectAcademicYears, academicYearStartDate,
} from '../utils/academicYear';
import {
  buildRolloverPlan, summarizeRolloverPlan, validateRolloverPlan,
  suggestNextGroupName, GROUP_ACTIONS, STUDENT_ACTIONS,
} from '../utils/yearRollover';

describe('academicYear', () => {
  it('август и сентябрь — уже новый учебный год', () => {
    expect(academicYearOf(new Date('2026-09-01T10:00:00'))).toBe('2026/2027');
    expect(academicYearOf(new Date('2026-08-15T10:00:00'))).toBe('2026/2027');
  });

  it('январь и май — всё ещё год, начавшийся прошлой осенью', () => {
    expect(academicYearOf(new Date('2026-01-10T10:00:00'))).toBe('2025/2026');
    expect(academicYearOf(new Date('2026-05-30T10:00:00'))).toBe('2025/2026');
  });

  it('currentAcademicYear возвращает канонический формат', () => {
    expect(isValidAcademicYear(currentAcademicYear())).toBe(true);
  });

  it('соседние годы', () => {
    expect(nextAcademicYear('2025/2026')).toBe('2026/2027');
    expect(prevAcademicYear('2025/2026')).toBe('2024/2025');
    expect(nextAcademicYear('чепуха')).toBe('');
  });

  it('нормализация принимает распространённые написания', () => {
    expect(normalizeAcademicYear('2025-2026')).toBe('2025/2026');
    expect(normalizeAcademicYear('2025/26')).toBe('2025/2026');
    expect(normalizeAcademicYear('2025')).toBe('2025/2026');
    expect(normalizeAcademicYear('')).toBe('');
    expect(normalizeAcademicYear('прошлый')).toBe('');
  });

  it('parse и валидация', () => {
    expect(parseAcademicYear('2025/2026')).toBe(2025);
    expect(parseAcademicYear(null)).toBe(null);
    expect(isValidAcademicYear('2025/2026')).toBe(true);
    expect(isValidAcademicYear('2025/26')).toBe(false);
  });

  it('сортировка: новые сверху, мусор в конце', () => {
    const list = ['2024/2025', '2026/2027', 'без года', '2025/2026'];
    expect([...list].sort(compareAcademicYears)).toEqual(
      ['2024/2025', '2025/2026', '2026/2027', 'без года'],
    );
  });

  it('собирает уникальные годы групп, новые сверху', () => {
    const groups = [
      { year: '2025/2026' }, { year: '2026/2027' }, { year: '2025/2026' }, { year: '' },
    ];
    expect(collectAcademicYears(groups)).toEqual(['2026/2027', '2025/2026']);
  });

  it('дата зачисления — 1 сентября года начала', () => {
    expect(academicYearStartDate('2025/2026')).toBe('2025-09-01 00:00:00.000Z');
    expect(academicYearStartDate('нет')).toBe('');
  });
});

describe('suggestNextGroupName', () => {
  it('повышает число класса в названии', () => {
    expect(suggestNextGroupName('10 кл', 10)).toBe('11 кл');
    expect(suggestNextGroupName('9А', 9)).toBe('10А');
    expect(suggestNextGroupName('7 кл', 7)).toBe('8 кл');
  });

  it('не трогает числа, не равные классу', () => {
    expect(suggestNextGroupName('Группа 2110', 10)).toBe('Группа 2110');
    expect(suggestNextGroupName('12У', 0)).toBe('12У');
    expect(suggestNextGroupName('Кружок', 8)).toBe('Кружок');
  });
});

describe('buildRolloverPlan', () => {
  const groups = [
    { id: 'g10', name: '10 кл', grade: 10 },
    { id: 'g11', name: '11 кл', grade: 11 },
    { id: 'gc', name: 'Летний интенсив', grade: 10, kind: 'course' },
    { id: 'gx', name: '12У', grade: 0 },
  ];
  const rosters = {
    g10: [{ id: 's1', name: 'Иванов' }],
    g11: [{ id: 's2', name: 'Петров' }, { id: 's3', name: 'Сидорова' }],
    gc: [{ id: 's4', name: 'Кузнецов' }],
    gx: [{ id: 's5', name: 'Морозова' }],
  };
  const plan = buildRolloverPlan({ groups, rosters, fromYear: '2025/2026' });

  it('целевой год по умолчанию — следующий', () => {
    expect(plan.toYear).toBe('2026/2027');
  });

  it('обычный класс продолжается с повышением', () => {
    const g = plan.groups.find((x) => x.sourceId === 'g10');
    expect(g.action).toBe(GROUP_ACTIONS.CONTINUE);
    expect(g.newName).toBe('11 кл');
    expect(g.newGrade).toBe(11);
    expect(g.archiveSource).toBe(true);
  });

  it('выпускной класс не продолжается, ученики выпускаются', () => {
    const g = plan.groups.find((x) => x.sourceId === 'g11');
    expect(g.action).toBe(GROUP_ACTIONS.GRADUATE);
    expect(g.newName).toBe('');
    const students = plan.students.filter((s) => s.sourceGroupId === 'g11');
    expect(students).toHaveLength(2);
    expect(students.every((s) => s.action === STUDENT_ACTIONS.GRADUATE)).toBe(true);
  });

  it('курс пропускается и не архивируется', () => {
    const g = plan.groups.find((x) => x.sourceId === 'gc');
    expect(g.action).toBe(GROUP_ACTIONS.SKIP);
    expect(g.archiveSource).toBe(false);
    const s = plan.students.find((x) => x.sourceGroupId === 'gc');
    expect(s.action).toBe(STUDENT_ACTIONS.STAY);
  });

  it('группа без класса продолжается под тем же именем', () => {
    const g = plan.groups.find((x) => x.sourceId === 'gx');
    expect(g.action).toBe(GROUP_ACTIONS.CONTINUE);
    expect(g.newName).toBe('12У');
    expect(g.newGrade).toBe(null);
  });

  it('сводка считает создания, переводы и выпуски', () => {
    expect(summarizeRolloverPlan(plan)).toMatchObject({
      groupsToCreate: 2, groupsToArchive: 3, groupsSkipped: 1,
      transferred: 2, graduated: 2, left: 0, stayed: 1,
    });
  });

  it('готовый план проходит валидацию', () => {
    expect(validateRolloverPlan(plan)).toEqual([]);
  });
});

describe('validateRolloverPlan', () => {
  const base = () => buildRolloverPlan({
    fromYear: '2025/2026',
    groups: [{ id: 'a', name: '9А', grade: 9 }, { id: 'b', name: '9Б', grade: 9 }],
    rosters: { a: [{ id: 's1', name: 'Иванов' }], b: [] },
  });

  it('ловит пустое имя новой группы', () => {
    const plan = base();
    plan.groups[0].newName = '  ';
    expect(validateRolloverPlan(plan)).toContain('Не задано название новой группы для «9А»');
  });

  it('ловит одинаковые имена новых групп', () => {
    const plan = base();
    plan.groups[1].newName = plan.groups[0].newName;
    expect(validateRolloverPlan(plan).some((p) => p.includes('одинаковым названием'))).toBe(true);
  });

  it('ловит перевод в группу, которую не создают', () => {
    const plan = base();
    plan.groups[0].action = GROUP_ACTIONS.SKIP;
    expect(validateRolloverPlan(plan)).toContain('Для ученика «Иванов» не выбрана группа перевода');
  });

  it('ловит неразобранный целевой год', () => {
    const plan = base();
    plan.toYear = '';
    expect(validateRolloverPlan(plan)).toContain('Не указан целевой учебный год');
  });
});

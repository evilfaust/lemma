import { describe, it, expect } from 'vitest';
import { searchCaseVariants, MIN_SEARCH_LENGTH } from '../shared/utils/searchVariants';
import { tasksApi } from '../shared/services/pb/tasks';

describe('searchCaseVariants', () => {
  it('перебирает регистр для кириллицы', () => {
    expect(searchCaseVariants('Треугольник')).toEqual(['Треугольник', 'треугольник']);
    expect(searchCaseVariants('треугольник')).toEqual(['треугольник', 'Треугольник']);
    expect(searchCaseVariants('ТРЕУГОЛЬНИК')).toEqual(['ТРЕУГОЛЬНИК', 'треугольник', 'Треугольник']);
  });

  it('не плодит варианты для латиницы и цифр — там LIKE и так без регистра', () => {
    expect(searchCaseVariants('14-001')).toEqual(['14-001']);
    expect(searchCaseVariants('ABCD')).toEqual(['ABCD']);
  });

  it('учитывает «ё» и фразы из нескольких слов', () => {
    expect(searchCaseVariants('Ёмкость сосуда')).toEqual(['Ёмкость сосуда', 'ёмкость сосуда']);
  });

  it('на пустом запросе не даёт вариантов', () => {
    expect(searchCaseVariants('')).toEqual([]);
    expect(searchCaseVariants('   ')).toEqual([]);
  });
});

describe('_buildTasksFilter — поиск', () => {
  it('ищет по коду и тексту во всех написаниях', () => {
    const f = tasksApi._buildTasksFilter({ search: 'Треугольник' });
    expect(f).toBe(
      '(code ~ "Треугольник" || statement_md ~ "Треугольник" || ' +
      'code ~ "треугольник" || statement_md ~ "треугольник" || ' +
      'old_codes ~ "Треугольник")'
    );
  });

  it('игнорирует запрос короче минимума', () => {
    expect(tasksApi._buildTasksFilter({ search: 'т' })).toBe('');
    expect(tasksApi._buildTasksFilter({ search: '  ' })).toBe('');
    expect(tasksApi._buildTasksFilter({ search: 'тр' })).toContain('statement_md ~ "тр"');
    expect(MIN_SEARCH_LENGTH).toBe(2);
  });

  it('экранирует кавычки в запросе', () => {
    expect(tasksApi._buildTasksFilter({ search: 'a"b' })).toContain('code ~ "a\\"b"');
  });

  it('соединяется с остальными фильтрами через &&', () => {
    const f = tasksApi._buildTasksFilter({ search: 'куб', topic: 'top1', difficulty: '2' });
    expect(f).toContain('&& topic = "top1"');
    expect(f).toContain('&& difficulty = "2"');
  });
});

describe('_buildTasksFilter — коды задач (v3.9.397)', () => {
  it('код, набранный как попало, ищется ещё и в каноническом виде', () => {
    const f = tasksApi._buildTasksFilter({ search: 'п12 34' });
    expect(f).toContain('code ~ "П12-034"');
    expect(f).toContain('old_codes ~ "п12 34"');
  });

  it('старый код с распечатки ищется в прежних кодах', () => {
    expect(tasksApi._buildTasksFilter({ search: '12-034' })).toContain('old_codes ~ "12-034"');
  });

  it('в теме сортировка по номеру, без темы — строкой', () => {
    expect(tasksApi._buildTasksSort('code', { topic: 't1' })).toBe('code_seq,code');
    expect(tasksApi._buildTasksSort('code', {})).toBe('code');
    expect(tasksApi._buildTasksSort('difficulty', { topic: 't1' })).toBe('difficulty,code_seq,code');
  });
});

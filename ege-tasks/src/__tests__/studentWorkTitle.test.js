import { describe, it, expect } from 'vitest';
import { studentWorkTitle, isGenericTitle } from '../utils/studentWorkTitle';
import { recentResults } from '../utils/studentHome';

const sess = (student_title, work, mc) => ({
  student_title,
  expand: { ...(work ? { work: { title: work } } : {}), ...(mc ? { mc_test: { title: mc } } : {}) },
});

describe('studentWorkTitle — что за работа, а не «Самостоятельная работа»', () => {
  it('заголовок-заглушка уступает названию работы', () => {
    expect(studentWorkTitle(sess('Самостоятельная работа', 'Логарифмы, 11 Б'))).toBe('Логарифмы, 11 Б');
    expect(studentWorkTitle(sess('  самостоятельная  работа ', 'Степени'))).toBe('Степени');
    expect(studentWorkTitle(sess('Тест', null, 'Тригонометрия: значения'))).toBe('Тригонометрия: значения');
    expect(studentWorkTitle(sess('', 'Дроби'))).toBe('Дроби');
  });

  it('свой заголовок учителя остаётся', () => {
    expect(studentWorkTitle(sess('Работа над ошибками', 'Дубль 3'))).toBe('Работа над ошибками');
    expect(studentWorkTitle(sess('Входная 10 класс', 'вх-10'))).toBe('Входная 10 класс');
  });

  it('без названия работы — заглушка, без всего — запасное слово', () => {
    expect(studentWorkTitle(sess('Самостоятельная работа'))).toBe('Самостоятельная работа');
    expect(studentWorkTitle(null)).toBe('Тест');
    expect(studentWorkTitle({}, '')).toBe('');
  });

  it('isGenericTitle', () => {
    expect(isGenericTitle('Самостоятельная работа')).toBe(true);
    expect(isGenericTitle('Тест с выбором ответа')).toBe(true);
    expect(isGenericTitle('')).toBe(true);
    expect(isGenericTitle('Самостоятельная работа №3')).toBe(false);
  });

  it('лента «Последние результаты» на главной различает работы', () => {
    const at = (id, title, work) => ({
      id, session: `s-${id}`, status: 'submitted', score: 3, total: 21,
      submitted_at: `2026-10-1${id}T10:00:00Z`,
      expand: { session: sess(title, work) },
    });
    const list = recentResults([at(1, 'Самостоятельная работа', 'Производная'), at(2, 'Самостоятельная работа', 'Логарифмы')]);
    expect(list.map((r) => r.title)).toEqual(['Логарифмы', 'Производная']);
  });
});

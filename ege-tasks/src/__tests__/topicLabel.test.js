import { describe, it, expect } from 'vitest';
import { shortTopicTitle, topicOptionLabel } from '../utils/topicLabel';

describe('подписи тем в списках (v3.9.398)', () => {
  it('убирает повтор «ЕГЭ-База. №5» / «ОГЭ. №6» в начале названия', () => {
    expect(shortTopicTitle('ЕГЭ-База. №5 Начала теории вероятностей')).toBe('Начала теории вероятностей');
    expect(shortTopicTitle('ОГЭ. №12 Расчеты по формулам')).toBe('Расчеты по формулам');
    expect(shortTopicTitle('ЕГЭ-Профиль. № 7 Простейшие уравнения')).toBe('Простейшие уравнения');
  });

  it('прочие названия не трогает', () => {
    expect(shortTopicTitle('Планиметрия')).toBe('Планиметрия');
    expect(shortTopicTitle('ВПР7У Решение геометрических задач')).toBe('ВПР7У Решение геометрических задач');
    expect(shortTopicTitle('Наибольшее и наименьшее значение функций (до 2027)')).toBe('Наибольшее и наименьшее значение функций (до 2027)');
    expect(shortTopicTitle('ОГЭ. №5')).toBe('ОГЭ. №5'); // кроме повтора ничего нет — оставляем как есть
  });

  it('номер задания — одним «№5 · …»', () => {
    expect(topicOptionLabel({ ege_number: 5, title: 'ЕГЭ-База. №5 Начала теории вероятностей' }))
      .toBe('№5 · Начала теории вероятностей');
    expect(topicOptionLabel({ title: 'Квадратные уравнения' })).toBe('Квадратные уравнения');
    expect(topicOptionLabel(null)).toBe('');
  });
});

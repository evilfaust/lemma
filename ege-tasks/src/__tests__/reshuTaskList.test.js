import { describe, it, expect } from 'vitest';
import {
  extractReshuIds,
  extractVariantUrls,
  detectReshuExam,
  reshuProblemUrl,
  formatReshuList,
  normalizeTypeLabel,
  topicForReshuType,
  pickBankTask,
  mainTopicOf,
  moveItem,
} from '../utils/reshuTaskList';

describe('extractReshuIds', () => {
  it('скопированная страница варианта: «Тип N № id», посторонние числа не берёт', () => {
    const text = `Вариант № 7736500
1. Тип 1 № 27455
Найдите площадь треугольника, если 2026 года… Ответ: 1250
2. Тип\u00A012\u00A0№\u00A0509202
3. Тип Д4 № 26662`;
    const { items } = extractReshuIds(text);
    expect(items.map((i) => i.id)).toEqual(['27455', '509202', '26662']);
    expect(items[0].typeLabel).toBe('1');
    expect(items[1].typeLabel).toBe('12');
    expect(items[2].typeLabel).toBe('Д4');
  });

  it('ссылки problem?id=', () => {
    const text = 'https://ege.sdamgia.ru/problem?id=27455 и https://ege.sdamgia.ru/problem?id=509202';
    expect(extractReshuIds(text).items.map((i) => i.id)).toEqual(['27455', '509202']);
  });

  it('голый список через запятую / по строкам', () => {
    expect(extractReshuIds('27455, 509202;26662\n 311151').items.map((i) => i.id))
      .toEqual(['27455', '509202', '26662', '311151']);
  });

  it('в голом списке порядковые номера и десятичные дроби не считаются', () => {
    expect(extractReshuIds('1) 27455\n2) 509202\n0,125').items.map((i) => i.id))
      .toEqual(['27455', '509202']);
  });

  it('повторы убираются, порядок первого появления, тип подтягивается из повтора', () => {
    const { items, duplicates } = extractReshuIds('problem?id=27455\nТип 5 № 27455\n№ 26662\n№ 26662');
    expect(items).toEqual([
      { id: '27455', typeLabel: '5' },
      { id: '26662', typeLabel: null },
    ]);
    expect(duplicates).toEqual(['27455', '26662']);
  });

  it('ссылка на вариант не превращается в номер задачи', () => {
    expect(extractReshuIds('https://ege.sdamgia.ru/test?id=77365000').items).toEqual([]);
  });

  it('пустой ввод', () => {
    expect(extractReshuIds('').items).toEqual([]);
    expect(extractReshuIds(null).items).toEqual([]);
  });
});

describe('ссылки и экзамен', () => {
  it('extractVariantUrls', () => {
    expect(extractVariantUrls('см. https://ege.sdamgia.ru/test?id=77365000 и https://ege.sdamgia.ru/test?id=77365000'))
      .toEqual(['https://ege.sdamgia.ru/test?id=77365000']);
  });

  it('detectReshuExam по домену', () => {
    expect(detectReshuExam('https://ege.sdamgia.ru/problem?id=1')).toBe('ege_profile');
    expect(detectReshuExam('https://math-ege.sdamgia.ru/problem?id=1')).toBe('ege_profile');
    expect(detectReshuExam('https://mathb-ege.sdamgia.ru/problem?id=1')).toBe('ege_base');
    expect(detectReshuExam('https://math-oge.sdamgia.ru/problem?id=1')).toBe('oge');
    expect(detectReshuExam('27455')).toBe(null);
  });

  it('reshuProblemUrl', () => {
    expect(reshuProblemUrl('27455')).toBe('https://ege.sdamgia.ru/problem?id=27455');
    expect(reshuProblemUrl('27455', 'ege_base')).toBe('https://mathb-ege.sdamgia.ru/problem?id=27455');
  });

  it('normalizeTypeLabel: ответ модели «Тип 19» → «19»', () => {
    expect(normalizeTypeLabel('Тип 19')).toBe('19');
    expect(normalizeTypeLabel('задание 12')).toBe('12');
    expect(normalizeTypeLabel('Д4')).toBe('Д4');
    expect(normalizeTypeLabel('null')).toBe(null);
    expect(normalizeTypeLabel(null)).toBe(null);
    expect(formatReshuList([{ id: '547769', typeLabel: 'Тип 19' }])).toBe('Тип 19 № 547769');
  });

  it('formatReshuList → extractReshuIds обратимы', () => {
    const items = [{ id: '27455', typeLabel: '7' }, { id: '26662', typeLabel: null }];
    expect(extractReshuIds(formatReshuList(items)).items).toEqual(items);
  });
});

describe('темы и выбор задачи', () => {
  const topics = [
    { id: 'p7', exam_type: 'ege_profile', ege_number: 7 },
    { id: 'p12old', exam_type: 'ege_profile', ege_number: 12, archived: true },
    { id: 'p12', exam_type: 'ege_profile', ege_number: 12 },
    { id: 'b7', exam_type: 'ege_base', ege_number: 7 },
  ];

  it('topicForReshuType: номер задания → действующая тема экзамена', () => {
    expect(topicForReshuType(topics, 'ege_profile', '7').id).toBe('p7');
    expect(topicForReshuType(topics, 'ege_profile', '12').id).toBe('p12');
    expect(topicForReshuType(topics, 'ege_base', '7').id).toBe('b7');
    expect(topicForReshuType(topics, 'ege_profile', 'Д4')).toBe(null);
    expect(topicForReshuType(topics, 'ege_profile', null)).toBe(null);
    expect(topicForReshuType(topics, 'ege_profile', '19')).toBe(null);
  });

  it('pickBankTask: предпочитает экзамен и действующую тему', () => {
    const byId = new Map(topics.map((t) => [t.id, t]));
    const cands = [
      { id: 'a', topic: 'b7' },
      { id: 'b', topic: 'p12old' },
      { id: 'c', topic: 'p12' },
    ];
    expect(pickBankTask(cands, 'ege_profile', byId).id).toBe('c');
    expect(pickBankTask(cands, 'ege_base', byId).id).toBe('a');
    expect(pickBankTask([], 'ege_profile', byId)).toBe(null);
  });

  it('mainTopicOf', () => {
    expect(mainTopicOf(['a', 'b', 'b', null])).toBe('b');
    expect(mainTopicOf([])).toBe(null);
  });

  it('moveItem', () => {
    expect(moveItem([1, 2, 3], 0, 1)).toEqual([2, 1, 3]);
    expect(moveItem([1, 2, 3], 0, -1)).toEqual([1, 2, 3]);
    expect(moveItem([1, 2, 3], 2, -1)).toEqual([1, 3, 2]);
  });
});

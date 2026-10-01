import { describe, it, expect } from 'vitest';
import { suggestFacets, splitFacets, joinFacets } from '../utils/geometryFacets';

const tagById = new Map([
  ['cube', { kind: 'object', name: 'Куб' }],
  ['pyr', { kind: 'object', name: 'Пирамида' }],
  ['sec', { kind: 'object', name: 'Сечение многогранника' }],
  ['tr', { kind: 'method', name: 'Метод следов' }],
  ['th3', { kind: 'fact', name: 'Теорема о трёх перпендикулярах' }],
  ['nm', { kind: 'named', name: 'Задача Эйлера' }],
]);

describe('подсказка фасетов по соседям', () => {
  const neighbors = [
    { pct: 90, tags: ['cube', 'sec', 'tr'] },
    { pct: 80, tags: ['cube', 'sec'] },
    { pct: 60, tags: ['pyr', 'sec', 'nm'] },
    { pct: 40, tags: ['cube', 'th3'] },
  ];

  it('голос весит похожесть; уверенные отмечены', () => {
    const s = suggestFacets(neighbors, tagById);
    expect(s.object.map((x) => x.id)).toEqual(['sec', 'cube', 'pyr']);
    expect(s.object[0]).toMatchObject({ votes: 3, score: 2.3, preselect: true });
    expect(s.object.find((x) => x.id === 'pyr').preselect).toBe(false); // один голос
    expect(s.method).toEqual([expect.objectContaining({ id: 'tr', votes: 1, preselect: false })]);
    expect(s.fact.map((x) => x.id)).toEqual(['th3']);
  });

  it('не предлагает то, что уже есть, и «имена»/«источники»', () => {
    const s = suggestFacets(neighbors, tagById, { have: ['sec'] });
    expect(s.object.map((x) => x.id)).toEqual(['cube', 'pyr']);
    expect([...s.object, ...s.method, ...s.fact].some((x) => x.id === 'nm')).toBe(false);
  });

  it('без соседей — пусто', () => {
    expect(suggestFacets([], tagById)).toEqual({ object: [], method: [], fact: [] });
  });
});

describe('фасеты задачи по видам и обратно', () => {
  it('другие виды тегов сохраняются', () => {
    const parts = splitFacets(['cube', 'nm', 'tr', 'gone'], tagById);
    expect(parts).toEqual({ object: ['cube'], method: ['tr'], fact: [], other: ['nm', 'gone'] });
    expect(joinFacets({ ...parts, object: ['pyr', 'cube'], fact: ['th3'] })).toEqual(['pyr', 'cube', 'tr', 'th3', 'nm', 'gone']);
  });
});

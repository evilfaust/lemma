import { describe, it, expect } from 'vitest';
import {
  getRandomAchievement,
  checkUnlockedAchievements,
  drawAchievement,
  isDrawAchievement,
  getPreviouslyUnlockedIds,
  getPreviouslyEarnedBadgeIds,
} from '../utils/achievementEngine';

const ACHIEVEMENTS = [
  { id: 'l1', type: 'random', rarity: 'legendary', code: 'LEGEND_1' },
  { id: 'l2', type: 'random', rarity: 'legendary', code: 'LEGEND_2' },
  { id: 'r1', type: 'random', rarity: 'rare',      code: 'RARE_1' },
  { id: 'r2', type: 'random', rarity: 'rare',      code: 'RARE_2' },
  { id: 'c1', type: 'random', rarity: 'common',    code: 'COMMON_1' },
  { id: 'c2', type: 'random', rarity: 'common',    code: 'COMMON_2' },
  { id: 'cond1', type: 'condition', rarity: 'rare', code: 'SPEED' },
];

describe('getRandomAchievement', () => {
  it('возвращает legendary при ≥90%', () => {
    const result = getRandomAchievement(ACHIEVEMENTS, 90, []);
    expect(['legendary', 'rare', 'common']).toContain(result.rarity);
    // При 90% должна быть попытка получить legendary первой
    // Проверяем, что в 100 прогонах хоть раз выпадает legendary
    const results = Array.from({ length: 100 }, () =>
      getRandomAchievement(ACHIEVEMENTS, 95, [])
    );
    expect(results.some(r => r.rarity === 'legendary')).toBe(true);
  });

  it('возвращает rare или common при 70-89%', () => {
    const result = getRandomAchievement(ACHIEVEMENTS, 75, []);
    expect(result).not.toBeNull();
    expect(['rare', 'common']).toContain(result.rarity);
    // legendary никогда не выдаётся при 75%
    const results = Array.from({ length: 50 }, () =>
      getRandomAchievement(ACHIEVEMENTS, 75, [])
    );
    expect(results.every(r => r.rarity !== 'legendary')).toBe(true);
  });

  it('возвращает только common при 40-69%', () => {
    const result = getRandomAchievement(ACHIEVEMENTS, 50, []);
    expect(result).not.toBeNull();
    expect(result.rarity).toBe('common');
  });

  it('возвращает null при < 40%', () => {
    expect(getRandomAchievement(ACHIEVEMENTS, 39, [])).toBeNull();
    expect(getRandomAchievement(ACHIEVEMENTS, 0, [])).toBeNull();
  });

  it('не выдаёт уже исключённые значки', () => {
    // Исключаем все legendary и rare
    const excluded = ['l1', 'l2', 'r1', 'r2'];
    const result = getRandomAchievement(ACHIEVEMENTS, 95, excluded);
    // fallback на common
    expect(result).not.toBeNull();
    expect(result.rarity).toBe('common');
  });

  it('возвращает null если все значки цепочки получены (95%, всё исключено)', () => {
    const excluded = ['l1', 'l2', 'r1', 'r2', 'c1', 'c2'];
    expect(getRandomAchievement(ACHIEVEMENTS, 95, excluded)).toBeNull();
  });

  it('не выдаёт достижения типа condition', () => {
    // При 75% — rare: cond1 тоже rare, но type=condition → не должен попасть в пул
    const results = Array.from({ length: 50 }, () =>
      getRandomAchievement(ACHIEVEMENTS, 75, [])
    );
    expect(results.every(r => r.type === 'random')).toBe(true);
  });
});

describe('getPreviouslyUnlockedIds', () => {
  it('собирает ID из unlocked_achievements всех попыток', () => {
    const attempts = [
      { unlocked_achievements: ['a1', 'a2'] },
      { unlocked_achievements: ['a3'] },
      { unlocked_achievements: [] },
    ];
    const ids = getPreviouslyUnlockedIds(attempts);
    expect(ids).toContain('a1');
    expect(ids).toContain('a2');
    expect(ids).toContain('a3');
    expect(ids).toHaveLength(3);
  });

  it('дедуплицирует повторяющиеся ID', () => {
    const attempts = [
      { unlocked_achievements: ['a1', 'a2'] },
      { unlocked_achievements: ['a1'] },
    ];
    const ids = getPreviouslyUnlockedIds(attempts);
    expect(ids).toHaveLength(2);
  });

  it('игнорирует попытки без поля unlocked_achievements', () => {
    const attempts = [{ achievement: 'r1' }, { unlocked_achievements: ['a1'] }];
    const ids = getPreviouslyUnlockedIds(attempts);
    expect(ids).toEqual(['a1']);
  });

  it('возвращает [] для пустого массива попыток', () => {
    expect(getPreviouslyUnlockedIds([])).toEqual([]);
  });
});

describe('getPreviouslyEarnedBadgeIds', () => {
  it('собирает ID случайных значков (achievement поле)', () => {
    const attempts = [
      { achievement: 'r1' },
      { achievement: 'c1' },
      { achievement: null },
      {},
    ];
    const ids = getPreviouslyEarnedBadgeIds(attempts);
    expect(ids).toContain('r1');
    expect(ids).toContain('c1');
    expect(ids).toHaveLength(2);
  });

  it('возвращает [] для пустого массива попыток', () => {
    expect(getPreviouslyEarnedBadgeIds([])).toEqual([]);
  });
});

describe('условные ачивки за процент: «ровно» и розыгрыш', () => {
  const score = (id, cv, rarity = 'common') => ({
    id, code: id, type: 'condition', rarity, condition_type: 'score', condition_value: cv,
  });
  const check = (list, percentage, prev = [], random) =>
    checkUnlockedAchievements(list, { percentage }, [{ id: 'a' }], prev, random).map((a) => a.id);

  it('exact сравнивает округлённый процент: 2 из 3 = 67%', () => {
    const list = [score('six7', { exact: 67 })];
    expect(check(list, (2 / 3) * 100)).toEqual(['six7']);
    expect(check(list, 66.4)).toEqual([]);
    expect(check(list, 67.5)).toEqual([]);
  });

  it('exact главнее min/max', () => {
    const list = [score('x', { exact: 52, min: 90 })];
    expect(check(list, 52)).toEqual(['x']);
  });

  it('isDrawAchievement — только условные с pick: true', () => {
    expect(isDrawAchievement(score('a', { min: 0, max: 40, pick: true }))).toBe(true);
    expect(isDrawAchievement(score('b', { min: 0, max: 40 }))).toBe(false);
    expect(isDrawAchievement({ id: 'c', type: 'random', condition_value: { pick: true } })).toBe(false);
  });

  it('из подошедших ачивок розыгрыша выпадает ровно одна', () => {
    const list = [
      score('p1', { min: 0, max: 40, pick: true }),
      score('p2', { min: 0, max: 50, pick: true }),
      score('p3', { min: 10, max: 50, pick: true }, 'legendary'),
      score('far', { min: 90, max: 100, pick: true }),
    ];
    for (const r of [0, 0.3, 0.6, 0.99]) {
      const got = check(list, 30, [], () => r);
      expect(got).toHaveLength(1);
      expect(['p1', 'p2', 'p3']).toContain(got[0]);
    }
  });

  it('обычные условные открываются как раньше, рядом с розыгрышем', () => {
    const list = [
      score('plain', { min: 0, max: 40 }),
      score('p1', { min: 0, max: 40, pick: true }),
      score('p2', { min: 0, max: 40, pick: true }),
    ];
    const got = check(list, 20, [], () => 0);
    expect(got).toContain('plain');
    expect(got.filter((id) => id.startsWith('p') && id !== 'plain')).toHaveLength(1);
  });

  it('полученные в розыгрыш не выпадают снова; все собраны — ничего', () => {
    const list = [
      score('p1', { min: 0, max: 40, pick: true }),
      score('p2', { min: 0, max: 40, pick: true }),
    ];
    expect(check(list, 20, ['p1'], () => 0)).toEqual(['p2']);
    expect(check(list, 20, ['p1', 'p2'], () => 0)).toEqual([]);
  });

  it('вес по редкости: обычная выпадает чаще легендарной', () => {
    const pool = [
      { id: 'c', rarity: 'common' },
      { id: 'l', rarity: 'legendary' },
    ];
    // веса 6 и 1: [0; 6/7) — обычная, [6/7; 1) — легендарная
    expect(drawAchievement(pool, () => 0.85).id).toBe('c');
    expect(drawAchievement(pool, () => 0.9).id).toBe('l');
    expect(drawAchievement([], () => 0.5)).toBeNull();
  });
});

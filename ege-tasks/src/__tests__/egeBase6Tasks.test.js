import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateEgeBase6Task, generateTableChoiceVariants } from '../utils/egeBase6Tasks';

function readRows(statement) {
  return statement.split('\n')
    .filter(line => line.startsWith('|'))
    .slice(2)
    .map(line => line.split('|').slice(1, -1).map(cell => cell.trim()));
}

function seededRandom(seed) {
  let state = seed;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

afterEach(() => vi.restoreAllMocks());

describe('ЕГЭ база №6 · проверка по условию', () => {
  it('считает доставку по напечатанным ценам, включая заказ точно на пороге', () => {
    vi.spyOn(Math, 'random').mockImplementation(seededRandom(6));
    const used = new Set();
    const winners = new Set();
    let onThreshold = false;
    for (let i = 0; i < 200; i++) {
      const { statement_md, answer } = generateEgeBase6Task('delivery', used);
      const quantity = Number(statement_md.match(/купить (\d+) настольных/)[1]);
      const offers = readRows(statement_md).map(([, price, shipping, rule]) => {
        const subtotal = quantity * Number(price);
        const threshold = Number(rule.match(/\d+/)?.[0] ?? Infinity);
        if (subtotal === threshold) onThreshold = true;
        return { total: subtotal + (subtotal > threshold ? 0 : Number(shipping)), free: subtotal > threshold };
      });
      expect(offers.filter(offer => offer.free)).toHaveLength(1);
      expect(new Set(offers.map(offer => offer.total)).size).toBe(3);
      const [winner] = offers.sort((a, b) => a.total - b.total);
      expect(Number(answer)).toBe(winner.total);
      winners.add(winner.free);
    }
    expect(onThreshold).toBe(true);
    expect(winners.size).toBe(2);
  });

  it('учитывает абонентскую плату, лимит и минуты сверх пакета', () => {
    vi.spyOn(Math, 'random').mockImplementation(seededRandom(16));
    const used = new Set();
    const winningPlans = new Set();
    for (let i = 0; i < 160; i++) {
      const { statement_md, answer } = generateEgeBase6Task('tariffs', used);
      const minutes = Number(statement_md.match(/телефону (\d+) минут/)[1]);
      const plans = readRows(statement_md).map(([, fee, included, rate]) => ({
        included,
        cost: Number(fee) + (rate === '—' ? 0 : Number(rate) * Math.max(minutes - Number(included), 0)),
      }));
      expect(new Set(plans.map(plan => plan.cost)).size).toBe(3);
      const [winner] = plans.sort((a, b) => a.cost - b.cost);
      expect(Number(answer)).toBe(winner.cost);
      winningPlans.add(winner.included === 'Без ограничений' ? 'безлимитный' : Number(winner.included) > 0 ? 'пакет' : 'поминутный');
    }
    expect(winningPlans.size).toBe(3);
  });

  it('проверяет все четыре ограничения ручной клади и включает граничные значения', () => {
    vi.spyOn(Math, 'random').mockImplementation(seededRandom(26));
    const used = new Set();
    let onLimit = false;
    for (let i = 0; i < 160; i++) {
      const { statement_md, answer } = generateEgeBase6Task('luggage', used);
      const asNumber = value => Number(value.replace(',', '.'));
      const limits = [...statement_md.matchAll(/не более (\d+(?:,\d+)?)/g)].map(match => asNumber(match[1]));
      const failures = readRows(statement_md).map(([id, ...dimensions]) => ({
        id,
        exceeds: dimensions.map((value, index) => asNumber(value) - limits[index]),
      }));
      const accepted = failures.filter(bag => bag.exceeds.every(difference => difference <= 0));
      expect(accepted).toHaveLength(2);
      expect(answer).toBe(accepted.map(bag => bag.id).join(''));
      if (accepted.some(bag => bag.exceeds.includes(0))) onLimit = true;
      const rejected = failures.filter(bag => bag.exceeds.some(difference => difference > 0));
      expect(rejected.map(bag => bag.exceeds.map((difference, index) => difference > 0 ? index : null)
        .filter(index => index !== null)).sort()).toEqual([[0], [1], [2], [3]]);
    }
    expect(onLimit).toBe(true);
  });

  it('отбрасывает те же данные доставки после перестановки строк', () => {
    const used = new Set();
    const samples = [];
    const random = seededRandom(17);
    const mock = vi.spyOn(Math, 'random').mockImplementation(() => {
      const value = random();
      samples.push(value);
      return value;
    });
    const original = generateEgeBase6Task('delivery', used);
    const reordered = [...samples.slice(0, -2), 0.99, 0.99];
    let index = 0;
    mock.mockImplementation(() => reordered[index++]);
    const sameData = generateEgeBase6Task('delivery', new Set());
    expect(sameData.statement_md).not.toBe(original.statement_md);
    expect(sameData.answer).toBe(original.answer);

    index = 0;
    mock.mockImplementation(() => reordered[index++] ?? random());
    const next = generateEgeBase6Task('delivery', used);
    expect(next.statement_md).not.toBe(sameData.statement_md);
    expect(used.size).toBe(2);
  });

  it('даёт один порядок выбранных типов во всех тренировочных вариантах', () => {
    const variants = generateTableChoiceVariants({
      categories: { delivery: true, tariffs: false, luggage: true },
      categoryCounts: { delivery: 2 },
      questionsCount: 3,
      variantsCount: 2,
    });
    expect(variants.map(tasks => tasks.map(task => task.cat))).toEqual([
      ['delivery', 'luggage', 'delivery'],
      ['delivery', 'luggage', 'delivery'],
    ]);
    expect(new Set(variants.flat().map(task => task.statement_md)).size).toBe(6);
  });
});

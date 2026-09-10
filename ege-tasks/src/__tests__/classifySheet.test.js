import { describe, it, expect } from 'vitest';
import {
  QUAD_BUCKET_PRESET, OTHER_BUCKET_ID, DEFAULT_CLASSIFY_SETTINGS,
  bucketsFromPreset, createItem, sheetStats, slotsForBucket,
  paginateBuckets, bucketHeightMm, shuffleItems, classifyWarnings,
  printableBuckets, bankPageHeightMm, PAGE_LIMIT_MM,
} from '../utils/classifySheet';
import { parseBulkEquations } from '../components/classify/BulkAddModal';
import {
  bucketForCategory, generateItemsForClassify, presetKeysForCategories,
  QUAD_IMPORT_GROUPS,
} from '../utils/classifyQuadImport';

const SETTINGS = { ...DEFAULT_CLASSIFY_SETTINGS };

function sheet() {
  const buckets = bucketsFromPreset(['noC', 'noB', 'vieta', 'full']);
  const [noC, noB, vieta, full] = buckets;
  const items = [
    createItem({ latex: 'x^2 - 5x = 0', bucketId: noC.id }),
    createItem({ latex: '3x^2 - 27 = 0', bucketId: noB.id }),
    createItem({ latex: 'x^2 - 5x + 6 = 0', bucketId: vieta.id }),
    createItem({ latex: '2x^2 - 7x + 3 = 0', bucketId: full.id }),
    createItem({ latex: 'x^2 + x - 12 = 0', bucketId: vieta.id }),
    createItem({ latex: 'x^4 = 1', bucketId: null }),
  ];
  return { buckets, items };
}

describe('разметка листа-классификатора', () => {
  it('нумерует уравнения по месту в банке и считает контрольные суммы', () => {
    const { buckets, items } = sheet();
    const stats = sheetStats(buckets, items, SETTINGS);

    const vieta = stats.buckets.find(s => s.bucket.presetKey === 'vieta');
    expect(vieta.numbers).toEqual([3, 5]);
    expect(vieta.checksum).toBe(8);
    expect(vieta.count).toBe(2);

    const noC = stats.buckets.find(s => s.bucket.presetKey === 'noC');
    expect(noC.checksum).toBe(1);
  });

  it('уравнение без типа не попадает ни в один карман', () => {
    const { buckets, items } = sheet();
    const stats = sheetStats(buckets, items, SETTINGS);
    expect(stats.unassigned.map(u => u.number)).toEqual([6]);
    expect(stats.buckets.reduce((s, b) => s + b.count, 0)).toBe(5);
  });

  it('перестановка уравнения меняет суммы — номер это место в банке', () => {
    const { buckets, items } = sheet();
    const moved = [items[2], ...items.filter((_, i) => i !== 2)];
    const stats = sheetStats(buckets, moved, SETTINGS);
    const vieta = stats.buckets.find(s => s.bucket.presetKey === 'vieta');
    expect(vieta.numbers).toEqual([1, 5]);
    expect(vieta.checksum).toBe(6);
  });

  it('карман «Другое» печатается только по флажку', () => {
    const { buckets } = sheet();
    expect(printableBuckets(buckets, { showOther: true }).some(b => b.id === OTHER_BUCKET_ID)).toBe(true);
    expect(printableBuckets(buckets, { showOther: false }).some(b => b.id === OTHER_BUCKET_ID)).toBe(false);
  });

  it('считает баллы по цене типа', () => {
    const buckets = bucketsFromPreset(['vieta', 'full']).map(b => ({ ...b, points: 2 }));
    const items = [
      createItem({ bucketId: buckets[0].id }),
      createItem({ bucketId: buckets[0].id }),
      createItem({ bucketId: buckets[1].id }),
    ];
    const stats = sheetStats(buckets, items, SETTINGS);
    expect(stats.totalPoints).toBe(6);
  });
});

describe('места в кармане', () => {
  it('«поровну» не выдаёт, сколько уравнений в каком типе', () => {
    const { buckets, items } = sheet();
    const stats = sheetStats(buckets, items, SETTINGS);
    const slots = stats.buckets.map(s => slotsForBucket(s, stats, { slotMode: 'uniform', slotsPerBucket: 0 }));
    expect(new Set(slots).size).toBe(1);
    expect(slots[0]).toBe(stats.maxCount);
  });

  it('«по разметке» даёт мест по числу уравнений, но не меньше одного', () => {
    const { buckets, items } = sheet();
    const stats = sheetStats(buckets, items, SETTINGS);
    const vieta = stats.buckets.find(s => s.bucket.presetKey === 'vieta');
    const other = stats.buckets.find(s => s.bucket.id === OTHER_BUCKET_ID);
    expect(slotsForBucket(vieta, stats, { slotMode: 'auto' })).toBe(2);
    expect(slotsForBucket(other, stats, { slotMode: 'auto' })).toBe(1);
  });

  it('заданное число мест перекрывает автоматическое', () => {
    const { buckets, items } = sheet();
    const stats = sheetStats(buckets, items, SETTINGS);
    const slots = slotsForBucket(stats.buckets[0], stats, { slotMode: 'uniform', slotsPerBucket: 4 });
    expect(slots).toBe(4);
  });
});

describe('раскладка страниц решения', () => {
  it('карман не разрывается между страницами и не теряется', () => {
    const buckets = bucketsFromPreset();       // все типы библиотеки
    const items = buckets.map(b => createItem({ bucketId: b.id }));
    const stats = sheetStats(buckets, items, SETTINGS);
    const pages = paginateBuckets(stats, SETTINGS);

    const placed = pages.flat().map(p => p.bucket.id);
    expect(placed).toEqual(stats.buckets.map(s => s.bucket.id));
    expect(pages.length).toBeGreaterThan(1);
  });

  it('страница не переполняется по высоте', () => {
    const buckets = bucketsFromPreset();
    const items = buckets.flatMap(b => [createItem({ bucketId: b.id }), createItem({ bucketId: b.id })]);
    const stats = sheetStats(buckets, items, SETTINGS);
    const pages = paginateBuckets(stats, SETTINGS);

    pages.forEach((page) => {
      const height = page.reduce((s, p) => s + p.height, 0);
      // Переполнение допускается только когда карман один и он сам выше листа
      if (page.length > 1) expect(height).toBeLessThanOrEqual(297 - 24);
    });
  });

  it('карман выше листа занимает свою страницу целиком', () => {
    const buckets = bucketsFromPreset(['vieta', 'full']);
    const items = Array.from({ length: 12 }, () => createItem({ bucketId: buckets[0].id }));
    const settings = { ...SETTINGS, slotMode: 'auto', solveLines: 8 };
    const stats = sheetStats(buckets, items, settings);
    const pages = paginateBuckets(stats, settings);

    expect(bucketHeightMm(12, settings)).toBeGreaterThan(297);
    expect(pages[0]).toHaveLength(1);
    expect(pages[0][0].bucket.presetKey).toBe('vieta');
  });

  it('больше линеек — больше страниц', () => {
    const buckets = bucketsFromPreset(['noC', 'noB', 'vieta', 'full']);
    const items = buckets.map(b => createItem({ bucketId: b.id }));
    const short = paginateBuckets(sheetStats(buckets, items, SETTINGS), { ...SETTINGS, solveLines: 1 });
    const long = paginateBuckets(sheetStats(buckets, items, SETTINGS), { ...SETTINGS, solveLines: 8 });
    expect(long.length).toBeGreaterThan(short.length);
  });
});

describe('банк уравнений', () => {
  it('перемешивание сохраняет состав', () => {
    const { items } = sheet();
    const mixed = shuffleItems(items);
    expect(mixed).toHaveLength(items.length);
    expect(new Set(mixed.map(i => i.id))).toEqual(new Set(items.map(i => i.id)));
  });

  it('разбирает список: одно уравнение в строке, ответ после «|»', () => {
    const rows = parseBulkEquations('x^2 - 5x = 0\n\n3x^2 - 27 = 0 | -3; 3\n   \n(2x-1)^2 = -1 | корней нет');
    expect(rows).toEqual([
      { latex: 'x^2 - 5x = 0', answerLatex: '' },
      { latex: '3x^2 - 27 = 0', answerLatex: '-3; 3' },
      { latex: '(2x-1)^2 = -1', answerLatex: 'корней нет' },
    ]);
  });

  it('предупреждает о пустом банке, уравнениях без типа и пустых типах', () => {
    expect(classifyWarnings([], [], SETTINGS)).toContain('Банк уравнений пуст');

    const { buckets, items } = sheet();
    const warnings = classifyWarnings(buckets, items, SETTINGS);
    expect(warnings.some(w => w.startsWith('Без типа: 1'))).toBe(true);
    expect(warnings.some(w => w.startsWith('Пустых типов'))).toBe(false);
    expect(warnings.some(w => w.startsWith('Первая страница'))).toBe(false);
  });

  it('ловит переполнение первой страницы — она одна и не разбивается', () => {
    const buckets = bucketsFromPreset();
    const many = Array.from({ length: 60 }, () => createItem({ latex: 'x^2 = 1' }));
    expect(bankPageHeightMm(many, buckets.length + 1, SETTINGS)).toBeGreaterThan(PAGE_LIMIT_MM);
    expect(classifyWarnings(buckets, many, SETTINGS)
      .some(w => w.startsWith('Первая страница переполнена'))).toBe(true);

    // без таблицы классификации тот же банк на страницу помещается
    const noTable = { ...SETTINGS, showTable: false, bankColumns: 2 };
    expect(bankPageHeightMm(many.slice(0, 40), buckets.length + 1, noTable))
      .toBeLessThan(PAGE_LIMIT_MM);
  });
});

describe('добор из генератора квадратных уравнений', () => {
  it('в библиотеке типов нет повторов ключей', () => {
    const keys = QUAD_BUCKET_PRESET.map(p => p.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('повторный пресет не добавляет уже имеющийся тип', () => {
    const buckets = bucketsFromPreset(['vieta', 'vieta']);
    expect(buckets).toHaveLength(1);
  });

  it('категория генератора знает свой карман', () => {
    const buckets = bucketsFromPreset(['vieta', 'full', 'noC']);
    const vieta = buckets.find(b => b.presetKey === 'vieta');
    const full = buckets.find(b => b.presetKey === 'full');

    const mapped = bucketForCategory('vietaPositive', buckets);
    expect(mapped.bucketId).toBe(vieta.id);
    // приведённое честно решается и через дискриминант — это засчитывается
    expect(mapped.alsoFits).toContain(full.id);

    // кармана нет на листе → уравнение приедет без типа, а не в чужой
    expect(bucketForCategory('biquadratic', buckets).bucketId).toBeNull();
    expect(bucketForCategory('нет-такой-категории', buckets).bucketId).toBeNull();
  });

  it('перечисляет типы, которых не хватает под выбранные категории', () => {
    expect(presetKeysForCategories({ vietaPositive: 2, noC: 1, zeroRoot: 0 }).sort())
      .toEqual(['noC', 'vieta']);
  });

  it('генерирует уравнения с уже проставленным типом', () => {
    const buckets = bucketsFromPreset(['vieta', 'noC', 'full']);
    const items = generateItemsForClassify({ vietaPositive: 3, noC: 2 }, buckets);

    expect(items).toHaveLength(5);
    items.forEach((item) => {
      expect(item.latex).toBeTruthy();
      expect(item.bucketId).toBeTruthy();
      expect(buckets.some(b => b.id === item.bucketId)).toBe(true);
    });
    const vieta = buckets.find(b => b.presetKey === 'vieta');
    expect(items.filter(i => i.bucketId === vieta.id)).toHaveLength(3);
  });

  it('в окно добора не попадают задания «найдите x₁ + x₂»', () => {
    const keys = QUAD_IMPORT_GROUPS.flatMap(g => g.keys);
    expect(keys).not.toContain('askSum');
    expect(keys).not.toContain('buildByRoots');
    expect(keys).toContain('perfectSquare');
  });
});

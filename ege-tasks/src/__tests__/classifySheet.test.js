import { describe, it, expect } from 'vitest';
import {
  QUAD_BUCKET_PRESET, OTHER_BUCKET_ID, DEFAULT_CLASSIFY_SETTINGS,
  bucketsFromPreset, createItem, sheetStats, slotsForBucket,
  paginateBuckets, bucketHeightMm, shuffleItems, classifyWarnings,
  printableBuckets, bankPageHeightMm, PAGE_LIMIT_MM,
  normalizeClassifySettings, isClassifyOnly, planSheet, stretchPage,
  solveHeightMm, solveWidthMm, contentWidthMm,
  PAGE_MM, CELL_MM,
} from '../utils/classifySheet';
import { fillLineCounts } from '../components/shared/PrintFill';
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
    const settings = { ...SETTINGS, bucketColumns: 1 };
    const buckets = bucketsFromPreset();       // все типы библиотеки
    const items = buckets.flatMap(b => [createItem({ bucketId: b.id }), createItem({ bucketId: b.id })]);
    const stats = sheetStats(buckets, items, settings);
    const pages = paginateBuckets(stats, settings);

    const placed = pages.flat().map(p => p.bucket.id);
    expect(placed).toEqual(stats.buckets.map(s => s.bucket.id));
    expect(pages.length).toBeGreaterThan(1);
  });

  it('страница не переполняется по высоте', () => {
    const settings = { ...SETTINGS, bucketColumns: 1 };
    const buckets = bucketsFromPreset();
    const items = buckets.flatMap(b => [createItem({ bucketId: b.id }), createItem({ bucketId: b.id })]);
    const pages = paginateBuckets(sheetStats(buckets, items, settings), settings);

    pages.forEach((page) => {
      const height = page.reduce((s, p) => s + p.height, 0);
      // Переполнение допускается только когда карман один и он сам выше листа
      if (page.length > 1) expect(height).toBeLessThanOrEqual(PAGE_LIMIT_MM);
    });
  });

  it('карман выше листа занимает свою страницу целиком', () => {
    const buckets = bucketsFromPreset(['vieta', 'full']);
    const items = Array.from({ length: 12 }, () => createItem({ bucketId: buckets[0].id }));
    const settings = { ...SETTINGS, slotMode: 'auto', solveCells: 8, bucketColumns: 1 };
    const stats = sheetStats(buckets, items, settings);
    const pages = paginateBuckets(stats, settings);

    expect(bucketHeightMm(12, settings)).toBeGreaterThan(PAGE_MM.height);
    expect(pages[0]).toHaveLength(1);
    expect(pages[0][0].bucket.presetKey).toBe('vieta');
  });

  it('два типа в ряд экономят бумагу, но карманы не теряются', () => {
    const buckets = bucketsFromPreset();
    const items = buckets.flatMap(b => [createItem({ bucketId: b.id }), createItem({ bucketId: b.id })]);
    const one = { ...SETTINGS, bucketColumns: 1 };
    const two = { ...SETTINGS, bucketColumns: 2 };

    const pagesOne = paginateBuckets(sheetStats(buckets, items, one), one);
    const pagesTwo = paginateBuckets(sheetStats(buckets, items, two), two);

    expect(pagesTwo.length).toBeLessThan(pagesOne.length);
    expect(pagesTwo.flat()).toHaveLength(pagesOne.flat().length);
  });

  it('в два ряда строка стоит столько, сколько высокий карман в ней', () => {
    const buckets = bucketsFromPreset(['vieta', 'full', 'noC', 'noB']);
    // у первого кармана мест втрое больше — строка выйдет по нему
    const items = [
      ...Array.from({ length: 3 }, () => createItem({ bucketId: buckets[0].id })),
      createItem({ bucketId: buckets[1].id }),
      createItem({ bucketId: buckets[2].id }),
      createItem({ bucketId: buckets[3].id }),
    ];
    const settings = { ...SETTINGS, bucketColumns: 2, slotMode: 'auto', solveCells: 12 };
    const pages = paginateBuckets(sheetStats(buckets, items, settings), settings);

    pages.forEach((page) => {
      let used = 0;
      for (let i = 0; i < page.length; i += 2) {
        used += Math.max(...page.slice(i, i + 2).map(b => b.height));
      }
      if (page.length > 2) expect(used).toBeLessThanOrEqual(PAGE_LIMIT_MM);
    });
  });

  it('выше место для решения — больше страниц', () => {
    const buckets = bucketsFromPreset(['noC', 'noB', 'vieta', 'full']);
    const items = buckets.map(b => createItem({ bucketId: b.id }));
    const stats = sheetStats(buckets, items, SETTINGS);
    const short = paginateBuckets(stats, { ...SETTINGS, bucketColumns: 1, solveCells: 2 });
    const long = paginateBuckets(stats, { ...SETTINGS, bucketColumns: 1, solveCells: 20 });
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
    const many = Array.from({ length: 70 }, () => createItem({ latex: 'x^2 = 1' }));
    expect(bankPageHeightMm(many, buckets.length + 1, SETTINGS)).toBeGreaterThan(PAGE_LIMIT_MM);
    expect(classifyWarnings(buckets, many, SETTINGS)
      .some(w => w.startsWith('Первая страница переполнена'))).toBe(true);

    // в режиме «только классификация» страницу занимает ещё и таблица типов
    const classifyOnly = { ...SETTINGS, mode: 'classify' };
    expect(bankPageHeightMm(many.slice(0, 20), buckets.length + 1, classifyOnly))
      .toBeGreaterThan(bankPageHeightMm(many.slice(0, 20), buckets.length + 1, SETTINGS));
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

describe('карманы на первой странице', () => {
  const sheetOf = (n, bucketCount = 6) => {
    const buckets = bucketsFromPreset(
      ['noC', 'noB', 'vieta', 'binomSquare', 'perfectSquare', 'full'].slice(0, bucketCount),
    );
    const items = Array.from({ length: n }, (_, i) => createItem({
      latex: 'x^2 = 1', bucketId: buckets[i % buckets.length].id,
    }));
    return { buckets, items };
  };

  it('короткий банк — карманы начинаются под ним, а не с новой страницы', () => {
    const { buckets, items } = sheetOf(14);
    const plan = planSheet(sheetStats(buckets, items, SETTINGS), SETTINGS, items);

    expect(plan.firstBuckets.length).toBeGreaterThanOrEqual(2);
    expect(plan.pageCount).toBeLessThan(4);
  });

  it('длинный банк — первая страница остаётся под банк', () => {
    const { buckets, items } = sheetOf(40);
    const plan = planSheet(sheetStats(buckets, items, SETTINGS), SETTINGS, items);
    expect(plan.firstBuckets).toEqual([]);
  });

  it('ни один карман не теряется и не печатается дважды', () => {
    [10, 14, 22, 40].forEach((n) => {
      const { buckets, items } = sheetOf(n);
      const stats = sheetStats(buckets, items, SETTINGS);
      const plan = planSheet(stats, SETTINGS, items);

      const placed = [...plan.firstBuckets, ...plan.pages.flat()].map(b => b.bucket.id);
      expect(placed).toEqual(stats.buckets.map(s => s.bucket.id));
      expect(new Set(placed).size).toBe(placed.length);
    });
  });

  it('карманы первой страницы влезают в остаток под банком', () => {
    const { buckets, items } = sheetOf(14);
    const plan = planSheet(sheetStats(buckets, items, SETTINGS), SETTINGS, items);

    let used = 0;
    for (let i = 0; i < plan.firstBuckets.length; i += 2) {
      used += Math.max(...plan.firstBuckets.slice(i, i + 2).map(b => b.height));
    }
    expect(used).toBeLessThanOrEqual(plan.freeFirstMm);
  });

  it('в режиме «только типы» карманов на первой странице нет', () => {
    const { buckets, items } = sheetOf(14);
    const settings = { ...SETTINGS, mode: 'classify' };
    const plan = planSheet(sheetStats(buckets, items, settings), settings, items);

    expect(plan.firstBuckets).toEqual([]);
    expect(plan.pages).toEqual([]);
    expect(plan.pageCount).toBe(1);
  });
});

describe('режим «только классификация»', () => {
  it('страниц с карманами не печатает вовсе — лист остаётся одностраничным', () => {
    const buckets = bucketsFromPreset();
    const items = buckets.map(b => createItem({ bucketId: b.id }));
    const settings = { ...SETTINGS, mode: 'classify' };

    expect(isClassifyOnly(settings)).toBe(true);
    expect(paginateBuckets(sheetStats(buckets, items, settings), settings)).toEqual([]);
    // а в обычном режиме карманы на месте
    expect(paginateBuckets(sheetStats(buckets, items, SETTINGS), SETTINGS).length)
      .toBeGreaterThan(0);
  });

  it('суммы всё равно считаются — их печатает таблица', () => {
    const buckets = bucketsFromPreset(['vieta', 'full']);
    const items = [
      createItem({ bucketId: buckets[0].id }),
      createItem({ bucketId: buckets[1].id }),
      createItem({ bucketId: buckets[0].id }),
    ];
    const stats = sheetStats(buckets, items, { ...SETTINGS, mode: 'classify' });
    expect(stats.buckets.find(s => s.bucket.presetKey === 'vieta').checksum).toBe(4);
  });

  it('лист, сохранённый до режимов, открывается полным', () => {
    expect(normalizeClassifySettings({ showTable: true }).mode).toBe('full');
    expect(normalizeClassifySettings({ mode: 'classify' }).mode).toBe('classify');
  });
});

describe('клетка и поля листа', () => {
  it('поле кармана — сплошная клетка, высота по числу уравнений в нём', () => {
    // мест под отдельные уравнения нет: высота просто кратна клетке
    expect(solveHeightMm(1, { solveCells: 4 })).toBe(4 * CELL_MM);
    expect(solveHeightMm(3, { solveCells: 4 })).toBe(12 * CELL_MM);
    // пустой карман всё равно получает поле — иначе в него нечего вписать
    expect(solveHeightMm(0, { solveCells: 4 })).toBe(4 * CELL_MM);
  });

  it('клеточное поле уже колонки страницы — рамка кармана съедает своё', () => {
    expect(solveWidthMm()).toBeLessThan(contentWidthMm());
    expect(contentWidthMm()).toBe(PAGE_MM.width - PAGE_MM.left - PAGE_MM.right);
    // в два ряда поле примерно вдвое уже, но всё ещё шире 80 мм — решение влезает
    expect(solveWidthMm(2)).toBeLessThan(solveWidthMm(1) / 2 + 5);
    expect(solveWidthMm(2)).toBeGreaterThan(80);
  });

  it('линии клетки не выходят за поле — иначе Chrome ужимает лист', () => {
    const heightMm = 20;
    const widthMm = solveWidthMm();
    const { h, v } = fillLineCounts({ fill: 'grid', heightMm, widthMm, cellMm: CELL_MM });

    // последняя линия строго внутри блока
    expect(h * CELL_MM).toBeLessThan(heightMm);
    expect(v * CELL_MM).toBeLessThan(widthMm);
    // и при этом клетка действительно расчерчена, а не одна линия
    expect(h).toBe(3);
    expect(v).toBeGreaterThan(30);
  });

  it('линейка рисует только горизонтали, «пусто» — ничего', () => {
    expect(fillLineCounts({ fill: 'lines', heightMm: 24, widthMm: 100 })).toEqual({ h: 2, v: 0 });
    expect(fillLineCounts({ fill: 'blank', heightMm: 24, widthMm: 100 })).toEqual({ h: 0, v: 0 });
    expect(fillLineCounts({ fill: 'grid', heightMm: 0, widthMm: 100 })).toEqual({ h: 0, v: 0 });
  });

  it('лист прошлой версии переезжает с линеек на клетку без потери высоты', () => {
    const legacy = normalizeClassifySettings({ solveLines: 3, bankColumns: 1 });
    expect(legacy.solveCells).toBe(5);        // 3 линейки по 8 мм ≈ 5 клеток
    expect(legacy.fill).toBe('lines');        // разлиновку сохранённого листа не меняем
    expect(legacy.bankColumns).toBe(1);       // прочие настройки целы

    const fresh = normalizeClassifySettings({});
    expect(fresh.fill).toBe('grid');
    expect(fresh.solveCells).toBe(4);
  });
});

describe('карманы растягиваются до низа страницы', () => {
  const build = (nItems, keys) => {
    const buckets = bucketsFromPreset(keys);
    const items = Array.from({ length: nItems }, (_, i) => createItem({
      latex: 'x^2 = 1', bucketId: buckets[i % buckets.length].id,
    }));
    return { buckets, items };
  };

  // высота страницы = сумма строк, строка стоит по самому высокому карману
  const pageHeight = (page) => {
    let used = 0;
    for (let i = 0; i < page.length; i += 2) {
      used += Math.max(...page.slice(i, i + 2).map(b => b.height));
    }
    return used;
  };

  it('не оставляет внизу страницы пустого места больше клетки', () => {
    [[12, 6], [14, 6], [24, 8], [18, 5]].forEach(([n, typeCount]) => {
      const keys = ['noC', 'noB', 'vieta', 'binomSquare', 'perfectSquare', 'full', 'noRoots', 'productZero']
        .slice(0, typeCount);
      const { buckets, items } = build(n, keys);
      const plan = planSheet(sheetStats(buckets, items, SETTINGS), SETTINGS, items);

      if (plan.firstBuckets.length) {
        const left = plan.freeFirstMm - pageHeight(plan.firstBuckets);
        expect(left, `первая страница, ${n} уравнений`).toBeLessThan(CELL_MM * 2);
        expect(left).toBeGreaterThanOrEqual(0);
      }
      plan.pages.forEach((page, i) => {
        const left = PAGE_LIMIT_MM - pageHeight(page);
        expect(left, `страница ${i + 2}, ${n} уравнений`).toBeLessThan(CELL_MM * 3);
        expect(left).toBeGreaterThanOrEqual(0);
      });
    });
  });

  it('высота поля кратна клетке — иначе нижний ряд обрезан', () => {
    const { buckets, items } = build(14, ['noC', 'noB', 'vieta', 'binomSquare', 'perfectSquare', 'full']);
    const plan = planSheet(sheetStats(buckets, items, SETTINGS), SETTINGS, items);

    [...plan.firstBuckets, ...plan.pages.flat()].forEach((b) => {
      expect(b.fieldMm % CELL_MM).toBe(0);
      expect(b.fieldMm).toBeGreaterThanOrEqual(solveHeightMm(b.slots, SETTINGS));
    });
  });

  it('карманы одной строки одинаковой высоты — иначе под коротким дыра', () => {
    const { buckets, items } = build(14, ['noC', 'noB', 'vieta', 'binomSquare', 'perfectSquare', 'full']);
    const plan = planSheet(sheetStats(buckets, items, SETTINGS), SETTINGS, items);

    [plan.firstBuckets, ...plan.pages].forEach((page) => {
      for (let i = 0; i + 1 < page.length; i += 2) {
        expect(page[i].fieldMm).toBe(page[i + 1].fieldMm);
      }
    });
  });

  it('не оставляет последнюю страницу с одиноким карманом', () => {
    // жадная раскладка складывала всё наверх, а последний тип уезжал один
    const { buckets, items } = build(12, ['noC', 'noB', 'vieta', 'binomSquare', 'perfectSquare', 'full']);
    const plan = planSheet(sheetStats(buckets, items, SETTINGS), SETTINGS, items);
    const last = plan.pages[plan.pages.length - 1];

    expect(plan.pages.length).toBeGreaterThan(0);
    expect(last.length).toBeGreaterThan(1);
  });

  it('одинокая строка не раздувается во весь лист', () => {
    const page = [{
      bucket: { id: 'b1' }, slots: 1, fieldMm: 20, chromeMm: 18, height: 38,
    }];
    const [stretched] = stretchPage(page, PAGE_LIMIT_MM, 1);
    expect(stretched.fieldMm).toBeLessThanOrEqual(20 * 3);
    expect(stretched.fieldMm).toBeGreaterThan(20);
  });

  it('когда место уже занято, ничего не растягивает', () => {
    const page = [{ bucket: { id: 'b1' }, slots: 3, fieldMm: 200, chromeMm: 18, height: 218 }];
    const [same] = stretchPage(page, 210, 1);
    expect(same.fieldMm).toBe(200);
  });
});

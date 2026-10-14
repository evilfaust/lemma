import { describe, it, expect } from 'vitest';
import {
  TDF_SHEET_DEFAULTS, PAGE, PAD, NUM_COL_TOTAL_MM,
  normalizeTdfSheetSettings, contentWidthMm, contentHeightMm,
  columnPercents, columnWidthMm, drawingHeightMm,
  paginateRows, planBlankPages, parseFormulas, pluralRu,
} from '../utils/tdfSheet';

const S = (patch = {}) => normalizeTdfSheetSettings({ ...TDF_SHEET_DEFAULTS, ...patch });

describe('normalizeTdfSheetSettings', () => {
  it('подставляет дефолты вместо мусора', () => {
    const s = normalizeTdfSheetSettings({ orientation: 'diagonal', drawingSize: 'xxl', fill: 'dots', pages: 5 });
    expect(s.orientation).toBe('landscape');
    expect(s.drawingSize).toBe('m');
    expect(s.fill).toBe('grid');
    expect(s.pages).toBe(1);
  });

  it('пустой объект даёт полный набор настроек', () => {
    expect(normalizeTdfSheetSettings()).toEqual(TDF_SHEET_DEFAULTS);
  });

  it('возвращает формулировку, если учитель выключил все колонки', () => {
    const s = normalizeTdfSheetSettings({ showFormulation: false, showDrawing: false, showNotation: false });
    expect(s.showFormulation).toBe(true);
  });

  it('сохраняет осознанно выключенные колонки, пока хоть одна включена', () => {
    const s = S({ showFormulation: false, showDrawing: true, showNotation: false });
    expect(s.showFormulation).toBe(false);
    expect(s.showDrawing).toBe(true);
  });
});

describe('геометрия листа', () => {
  it('полоса набора = лист минус поля', () => {
    expect(contentWidthMm(S())).toBe(PAGE.landscape.wMm - 2 * PAD.x);
    expect(contentHeightMm(S())).toBe(PAGE.landscape.hMm - PAD.top - PAD.bottom);
    expect(contentWidthMm(S({ orientation: 'portrait' }))).toBe(PAGE.portrait.wMm - 2 * PAD.x);
  });

  it('высота печатного листа на миллиметр меньше номинала A4', () => {
    expect(PAGE.landscape.hMm).toBe(209);
    expect(PAGE.portrait.hMm).toBe(296);
  });
});

describe('columnPercents', () => {
  it('доли включённых колонок дают ровно 100%', () => {
    const p = columnPercents(S());
    expect(p.formulation + p.drawing + p.notation).toBeCloseTo(100, 6);
  });

  it('выключенная колонка получает ноль, её место уходит остальным', () => {
    const withDrawing = columnPercents(S());
    const without = columnPercents(S({ showDrawing: false }));
    expect(without.drawing).toBe(0);
    expect(without.formulation).toBeGreaterThan(withDrawing.formulation);
    expect(without.formulation + without.notation).toBeCloseTo(100, 6);
  });

  it('крупный чертёж забирает больше ширины', () => {
    expect(columnPercents(S({ drawingSize: 'xl' })).drawing)
      .toBeGreaterThan(columnPercents(S({ drawingSize: 's' })).drawing);
  });

  it('единственная включённая колонка занимает всю ширину', () => {
    const p = columnPercents(S({ showDrawing: false, showNotation: false }));
    expect(p.formulation).toBe(100);
  });
});

describe('columnWidthMm', () => {
  it('сумма колонок = полоса набора минус колонка номера', () => {
    const s = S();
    const sum = columnWidthMm(s, 'formulation') + columnWidthMm(s, 'drawing') + columnWidthMm(s, 'notation');
    expect(sum).toBeCloseTo(contentWidthMm(s) - NUM_COL_TOTAL_MM, 6);
  });
});

describe('drawingHeightMm', () => {
  it('в книжной ориентации чертёж ниже, чем в альбомной', () => {
    expect(drawingHeightMm(S({ orientation: 'portrait' })))
      .toBeLessThan(drawingHeightMm(S({ orientation: 'landscape' })));
  });
});

describe('paginateRows', () => {
  const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
  const heights = { a: 100, b: 100, c: 100, d: 100 };

  it('первая страница ниже на высоту шапки', () => {
    const pages = paginateRows(items, heights, 250, 400);
    expect(pages[0].map(i => i.id)).toEqual(['a', 'b']);
    expect(pages[1].map(i => i.id)).toEqual(['c', 'd']);
  });

  it('строка выше страницы всё равно попадает на лист, а не теряется', () => {
    const pages = paginateRows([{ id: 'big' }], { big: 9999 }, 200, 400);
    expect(pages).toEqual([[{ id: 'big' }]]);
  });

  it('пустой список даёт одну пустую страницу', () => {
    expect(paginateRows([], {}, 100, 100)).toEqual([[]]);
  });

  it('неизмеренная строка считается по умолчанию, а не нулём', () => {
    const pages = paginateRows(items, {}, 100, 100);
    expect(pages.length).toBeGreaterThan(1);
  });
});

describe('planBlankPages', () => {
  const items = (n, headers = []) => Array.from({ length: n }, (_, i) => ({
    id: String(i), is_section_header: headers.includes(i),
  }));
  const base = (list, h) => Object.fromEntries(list.map(it => [it.id, h]));
  const opts = (p = {}) => ({ pageCount: 1, firstCapPx: 400, restCapPx: 500, writeMinPx: 20, safetyPx: 0, ...p });
  const sumPage = (plan, idx) => plan.pages[idx].reduce((s, it) => s + plan.rowHeights[it.id], 0);

  it('влезает на один лист — свободное место раздаётся пунктам поровну', () => {
    const list = items(4);
    const plan = planBlankPages(list, base(list, 50), opts());
    expect(plan.pages).toHaveLength(1);
    expect(plan.grew).toBe(false);
    list.forEach(it => expect(plan.rowHeights[it.id]).toBe(100));
    expect(sumPage(plan, 0)).toBeLessThanOrEqual(400);
  });

  it('заголовок раздела остаётся своей высоты, место получают только пункты', () => {
    const list = items(4, [0]);
    const plan = planBlankPages(list, base(list, 40), opts());
    expect(plan.rowHeights['0']).toBe(40);
    expect(plan.rowHeights['1']).toBe(Math.floor(40 + (400 - 160) / 3));
  });

  it('не влезает на 1 лист — сам уходит на 2, и каждый лист в своей ёмкости', () => {
    const list = items(12);
    const plan = planBlankPages(list, base(list, 40), opts());
    expect(plan.grew).toBe(true);
    expect(plan.pages).toHaveLength(2);
    expect(sumPage(plan, 0)).toBeLessThanOrEqual(400);
    expect(sumPage(plan, 1)).toBeLessThanOrEqual(500);
    expect(plan.tight).toBe(false);
  });

  it('два листа делятся по нагрузке: второй (без шапки) берёт больше', () => {
    const list = items(10);
    const plan = planBlankPages(list, base(list, 30), opts({ pageCount: 2 }));
    expect(plan.pages[1].length).toBeGreaterThan(plan.pages[0].length);
  });

  it('лист не кончается заголовком раздела', () => {
    const list = items(9, [4]);
    const plan = planBlankPages(list, base(list, 40), opts({ pageCount: 2, firstCapPx: 450, restCapPx: 450 }));
    expect(plan.pages[0].at(-1).is_section_header).toBe(false);
  });

  it('тесно даже на двух — строки сжимаются до своей высоты, флаги честные', () => {
    const list = items(20);
    const plan = planBlankPages(list, base(list, 40), opts());
    expect(plan.pages).toHaveLength(2);
    expect(plan.tight).toBe(true);
    expect(plan.overflow).toBe(false);
    expect(sumPage(plan, 0)).toBeLessThanOrEqual(400);
  });

  it('названия не влезают совсем — overflow', () => {
    const list = items(30);
    expect(planBlankPages(list, base(list, 40), opts()).overflow).toBe(true);
  });

  it('запас на печать вычитается из ёмкости', () => {
    const list = items(2);
    const plan = planBlankPages(list, base(list, 50), opts({ safetyPx: 8 }));
    expect(sumPage(plan, 0)).toBeLessThanOrEqual(392);
  });
});

describe('parseFormulas', () => {
  it('каждая строка — своя формула, левая часть отделяется', () => {
    const out = parseFormulas('$S = a b$\n$S = \\frac{d_1 d_2}{2}$');
    expect(out).toHaveLength(2);
    expect(out[0].lhs).toBe('$S =$');
    expect(out[1].full).toContain('d_1');
  });

  it('пустая краткая запись даёт одну заготовку «S =»', () => {
    expect(parseFormulas('')).toEqual([{ full: '', lhs: '$S =$' }]);
    expect(parseFormulas(null)).toEqual([{ full: '', lhs: '$S =$' }]);
  });

  it('формула без знака равенства получает подпись по умолчанию', () => {
    expect(parseFormulas('$a^2 + b^2$')[0].lhs).toBe('$S =$');
  });

  it('левая часть берётся до ПЕРВОГО знака равенства', () => {
    expect(parseFormulas('$V = S h = a b c$')[0].lhs).toBe('$V =$');
  });
});

describe('pluralRu', () => {
  it('склоняет по русским правилам', () => {
    const f = ['формула', 'формулы', 'формул'];
    expect(pluralRu(1, f)).toBe('формула');
    expect(pluralRu(3, f)).toBe('формулы');
    expect(pluralRu(11, f)).toBe('формул');
    expect(pluralRu(21, f)).toBe('формула');
  });
});

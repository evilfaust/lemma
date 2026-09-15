import { describe, it, expect } from 'vitest';
import {
  TDF_SHEET_DEFAULTS, PAGE, PAD, NUM_COL_TOTAL_MM,
  normalizeTdfSheetSettings, contentWidthMm, contentHeightMm,
  columnPercents, columnWidthMm, drawingHeightMm,
  paginateRows, splitIntoPages, stretchRowHeights, parseFormulas, pluralRu,
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

describe('splitIntoPages', () => {
  it('делит состав пополам при двух листах', () => {
    const items = [1, 2, 3, 4, 5].map(n => ({ id: String(n) }));
    const pages = splitIntoPages(items, 2);
    expect(pages.map(p => p.length)).toEqual([3, 2]);
  });

  it('один лист — всё на нём', () => {
    const items = [{ id: 'a' }, { id: 'b' }];
    expect(splitIntoPages(items, 1)).toEqual([items]);
  });
});

describe('stretchRowHeights', () => {
  it('строки делят страницу поровну и оставляют запас на печать', () => {
    const pages = [[{}, {}], [{}]];
    const [first, second] = stretchRowHeights(pages, 400, 500, 4);
    expect(first).toBe(Math.floor((400 - 8) / 2));
    expect(second).toBe(500 - 8);
  });

  it('пустая страница не делит на ноль', () => {
    expect(stretchRowHeights([[]], 300, 300, 4)[0]).toBe(292);
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

import { describe, it, expect } from 'vitest';
import {
  COPY_COUNTS, COPY_GAP_MM, COPY_GRIDS, FS_DEFAULTS, FS_PAD, FS_PAGE, TEXT_PRESET,
  applyCopies, columnWidthMm, copyFormatLabel, copySizeMm, countFormulas,
  flattenSections, layoutCopy, normalizeFormulaSheetSettings, pagesForMode, stretchExtraPx,
} from '../utils/formulaSheet';

const S = (patch = {}) => normalizeFormulaSheetSettings({ ...FS_DEFAULTS, ...patch });

const sections = [
  { id: 'a', title: 'Основные формулы', formulas: [
    { id: 'f1', left: '\\sin^2 x + \\cos^2 x', right: '1' },
    { id: 'f2', left: '1 - \\sin^2 x', right: '\\cos^2 x' },
  ] },
  { id: 'b', title: 'Двойной аргумент', formulas: [
    { id: 'f3', left: '\\sin 2x', right: '2\\sin x\\cos x' },
  ] },
];

describe('normalizeFormulaSheetSettings', () => {
  it('неизвестные значения откатываются к дефолтам', () => {
    const s = normalizeFormulaSheetSettings({ copies: 3, printMode: 'магия', font: 'готика', columns: 7 });
    expect(s.copies).toBe(FS_DEFAULTS.copies);
    expect(s.printMode).toBe('both');
    expect(s.font).toBe(FS_DEFAULTS.font);
    expect(s.columns).toBe(1);
  });

  it('кегль вне шкалы заменяется пресетом плотности', () => {
    expect(normalizeFormulaSheetSettings({ copies: 4, textSize: 40 }).textSize).toBe(TEXT_PRESET[4]);
  });

  it('свой кегль в разумных пределах сохраняется', () => {
    expect(normalizeFormulaSheetSettings({ copies: 2, textSize: 9 }).textSize).toBe(9);
  });
});

describe('applyCopies', () => {
  it('смена плотности тянет кегль пресета', () => {
    const s = applyCopies(S({ copies: 1, textSize: 12 }), 4);
    expect(s.copies).toBe(4);
    expect(s.textSize).toBe(TEXT_PRESET[4]);
  });
});

describe('copySizeMm', () => {
  it('копии со всеми полосами реза укладываются в лист', () => {
    for (const copies of COPY_COUNTS) {
      const { wMm, hMm, cols, rows } = copySizeMm(copies);
      const totalW = wMm * cols + COPY_GAP_MM * (cols - 1) + 2 * FS_PAD.x;
      const totalH = hMm * rows + COPY_GAP_MM * (rows - 1) + FS_PAD.top + FS_PAD.bottom;
      expect(totalW).toBeCloseTo(FS_PAGE.w, 6);
      expect(totalH).toBeCloseTo(FS_PAGE.h, 6);
    }
  });

  it('четыре копии — это сетка 2×2', () => {
    expect(COPY_GRIDS[4]).toEqual({ cols: 2, rows: 2 });
    expect(copySizeMm(4).hMm).toBeLessThan(copySizeMm(2).hMm);
  });

  it('подпись формата — размер копии в миллиметрах', () => {
    expect(copyFormatLabel(2)).toMatch(/^\d+ × \d+ мм$/);
  });
});

describe('columnWidthMm', () => {
  it('две колонки внутри копии уже одной', () => {
    expect(columnWidthMm(S({ columns: 2 }))).toBeLessThan(columnWidthMm(S({ columns: 1 })));
  });

  it('без нумерации колонка шире ровно на колонку номера', () => {
    expect(columnWidthMm(S({ showNumbers: false })) - columnWidthMm(S({ showNumbers: true })))
      .toBeCloseTo(6, 6);
  });
});

describe('flattenSections', () => {
  it('нумерация сквозная через секции, заголовки не нумеруются', () => {
    const items = flattenSections(sections);
    expect(items.map(i => i.kind)).toEqual(['section', 'formula', 'formula', 'section', 'formula']);
    expect(items.filter(i => i.kind === 'formula').map(i => i.num)).toEqual([1, 2, 3]);
  });

  it('пустые формулы отбрасываются', () => {
    const items = flattenSections([{ id: 'x', title: '', formulas: [{ id: '1', left: '  ', right: '' }] }]);
    expect(items).toEqual([]);
  });

  it('секция без заголовка не даёт пустой строки', () => {
    const items = flattenSections([{ id: 'x', title: '', formulas: [{ id: '1', left: 'a', right: 'b' }] }]);
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe('formula');
  });

  it('countFormulas считает только формулы', () => {
    expect(countFormulas(flattenSections(sections))).toBe(3);
  });
});

describe('layoutCopy', () => {
  const items = [
    { kind: 'section', id: 's1' },
    { kind: 'formula', id: 'f1' },
    { kind: 'formula', id: 'f2' },
    { kind: 'formula', id: 'f3' },
    { kind: 'formula', id: 'f4' },
  ];
  const heights = { s1: 20, f1: 40, f2: 40, f3: 40, f4: 40 };

  it('колонка набивается до ёмкости включительно, остальное — overflow', () => {
    const { columns, overflow } = layoutCopy(items, heights, 1, 100);
    expect(columns).toHaveLength(1);
    expect(columns[0].map(i => i.id)).toEqual(['s1', 'f1', 'f2']);
    expect(overflow.map(i => i.id)).toEqual(['f3', 'f4']);
  });

  it('две колонки набираются по очереди', () => {
    const { columns, overflow } = layoutCopy(items, heights, 2, 100);
    expect(columns[0].map(i => i.id)).toEqual(['s1', 'f1', 'f2']);
    expect(columns[1].map(i => i.id)).toEqual(['f3', 'f4']);
    expect(overflow).toEqual([]);
  });

  it('когда колонки кончились, хвост уходит в overflow', () => {
    const { columns, overflow } = layoutCopy(items, heights, 2, 60);
    expect(columns[0].map(i => i.id)).toEqual(['s1', 'f1']);
    expect(columns[1].map(i => i.id)).toEqual(['f2']);
    expect(overflow.map(i => i.id)).toEqual(['f3', 'f4']);
  });

  it('всё влезло — overflow пуст, лишние колонки остаются пустыми', () => {
    const { columns, overflow } = layoutCopy(items, heights, 2, 1000);
    expect(overflow).toEqual([]);
    expect(columns[0]).toHaveLength(5);
    expect(columns[1]).toEqual([]);
  });

  it('заголовок секции не остаётся последним в колонке', () => {
    const withTail = [
      { kind: 'formula', id: 'f1' },
      { kind: 'section', id: 's2' },
      { kind: 'formula', id: 'f2' },
    ];
    const h = { f1: 60, s2: 30, f2: 60 };
    const { columns } = layoutCopy(withTail, h, 2, 100);
    expect(columns[0].map(i => i.id)).toEqual(['f1']);
    expect(columns[1].map(i => i.id)).toEqual(['s2', 'f2']);
  });

  it('пустой поток не роняет раскладку', () => {
    const { columns, overflow } = layoutCopy([], {}, 2, 100);
    expect(columns).toEqual([[], []]);
    expect(overflow).toEqual([]);
  });

  it('строка выше колонки всё равно попадает в неё, а не теряется', () => {
    const { columns, overflow } = layoutCopy([{ kind: 'formula', id: 'big' }], { big: 500 }, 1, 100);
    expect(columns[0]).toHaveLength(1);
    expect(overflow).toEqual([]);
  });
});

describe('stretchExtraPx', () => {
  it('свободное место делится между формулами колонки', () => {
    const columns = [[{ kind: 'section', id: 's1' }, { kind: 'formula', id: 'f1' }, { kind: 'formula', id: 'f2' }]];
    const heights = { s1: 20, f1: 40, f2: 40 };
    const [extra] = stretchExtraPx(columns, heights, 300, 4, 100);
    expect(extra).toBeCloseTo((300 - 8 - 100) / 2, 6);
  });

  it('прирост строки ограничен потолком', () => {
    const columns = [[{ kind: 'formula', id: 'f1' }]];
    const extra = stretchExtraPx(columns, { f1: 10 }, 10000, 4, 6);
    expect(extra[0]).toBe(6 * 4);
  });

  it('переполненная колонка ничего не растягивает', () => {
    const columns = [[{ kind: 'formula', id: 'f1' }]];
    expect(stretchExtraPx(columns, { f1: 400 }, 300, 4)[0]).toBe(0);
  });

  it('пустая колонка не делит на ноль', () => {
    expect(stretchExtraPx([[]], {}, 300, 4)[0]).toBe(0);
  });
});

describe('pagesForMode', () => {
  it('режим определяет, какие страницы печатаются', () => {
    expect(pagesForMode('etalon')).toEqual(['etalon']);
    expect(pagesForMode('blank')).toEqual(['blank']);
    expect(pagesForMode('both')).toEqual(['etalon', 'blank']);
  });
});

import { describe, it, expect } from 'vitest';
import {
  CARD_COUNTS, CARD_GAP, CARD_GRIDS, CARD_PAD, CARD_PAGE, CARD_TEXT_PRESET,
  TDF_CARDS_DEFAULTS, applyCardCount, cardContentMm, cardFormatLabel, cardSizeMm,
  fillPage, normalizeCardSettings, paginateCards,
} from '../utils/tdfCards';

describe('normalizeCardSettings', () => {
  it('неизвестная плотность и режим откатываются к дефолтам', () => {
    const s = normalizeCardSettings({ count: 7, mode: 'магия' });
    expect(s.count).toBe(TDF_CARDS_DEFAULTS.count);
    expect(s.mode).toBe('question');
  });

  it('кегль вне шкалы заменяется пресетом плотности', () => {
    expect(normalizeCardSettings({ count: 9, textSize: 99 }).textSize).toBe(CARD_TEXT_PRESET[9]);
  });

  it('свой кегль в разумных пределах сохраняется', () => {
    expect(normalizeCardSettings({ count: 6, textSize: 12 }).textSize).toBe(12);
  });
});

describe('applyCardCount', () => {
  it('смена плотности тянет кегль пресета', () => {
    const s = applyCardCount(normalizeCardSettings({ count: 2, textSize: 16 }), 9);
    expect(s.count).toBe(9);
    expect(s.textSize).toBe(CARD_TEXT_PRESET[9]);
  });
});

describe('cardSizeMm', () => {
  it('карточки со всеми зазорами укладываются в лист', () => {
    for (const count of CARD_COUNTS) {
      const { wMm, hMm, cols, rows } = cardSizeMm(count);
      const totalW = wMm * cols + CARD_GAP * (cols - 1) + 2 * CARD_PAD;
      const totalH = hMm * rows + CARD_GAP * (rows - 1) + 2 * CARD_PAD;
      expect(totalW).toBeCloseTo(CARD_PAGE.w, 6);
      expect(totalH).toBeCloseTo(CARD_PAGE.h, 6);
    }
  });

  it('чем плотнее лист, тем мельче карточка', () => {
    expect(cardSizeMm(9).hMm).toBeLessThan(cardSizeMm(4).hMm);
  });

  it('сетка 4 карточек — это половинки листа по обеим сторонам', () => {
    expect(cardSizeMm(4)).toMatchObject({ cols: 2, rows: 2 });
  });
});

describe('cardContentMm', () => {
  it('зона содержимого меньше карточки на шапку и поля', () => {
    const size = cardSizeMm(6);
    const content = cardContentMm(6);
    expect(content.hMm).toBeLessThan(size.hMm);
    expect(content.wMm).toBeLessThan(size.wMm);
    expect(content.hMm).toBeGreaterThan(0);
  });
});

describe('paginateCards / fillPage', () => {
  const items = Array.from({ length: 7 }, (_, i) => ({ id: String(i) }));

  it('режет набор по плотности листа', () => {
    const pages = paginateCards(items, 4);
    expect(pages.map(p => p.length)).toEqual([4, 3]);
  });

  it('пустой набор не даёт пустых листов', () => {
    expect(paginateCards([], 6)).toEqual([]);
  });

  it('последний лист добивается пустыми местами — сетка не разъезжается', () => {
    const last = fillPage(paginateCards(items, 4)[1], 4);
    expect(last).toHaveLength(4);
    expect(last[3]).toBeNull();
  });
});

describe('cardFormatLabel', () => {
  it('показывает размер карточки в миллиметрах', () => {
    expect(cardFormatLabel(4)).toMatch(/^\d+ × \d+ мм$/);
  });
});

describe('CARD_GRIDS', () => {
  it('у каждой плотности сетка даёт ровно столько мест', () => {
    for (const count of CARD_COUNTS) {
      expect(CARD_GRIDS[count].cols * CARD_GRIDS[count].rows).toBe(count);
    }
  });
});

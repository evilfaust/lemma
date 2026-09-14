import { describe, it, expect } from 'vitest';
import {
  CARD_COUNTS, CARD_GAP_MM, CARD_SHEET_H_MM, CARD_TEXT_PRESET,
  applyCardCount, cardContentMm, cardFormatLabel, cardGrid, cardOverflows,
  cardSizeMm, fitFontPt, normalizeMarathonCardSettings,
} from '../utils/marathonCards';
import { PAGE_MM } from '../utils/marathonWorksheet';

describe('геометрия листа карточек', () => {
  it('карточки с зазорами укладываются в лист без остатка', () => {
    CARD_COUNTS.forEach((n) => {
      const { cols, rows } = cardGrid(n);
      const { wMm, hMm } = cardSizeMm(n);
      const usedW = wMm * cols + CARD_GAP_MM * (cols - 1) + 2 * PAGE_MM.pad;
      const usedH = hMm * rows + CARD_GAP_MM * (rows - 1) + 2 * PAGE_MM.pad;
      expect(usedW).toBeCloseTo(PAGE_MM.w, 6);
      expect(usedH).toBeCloseTo(CARD_SHEET_H_MM, 6);
    });
  });

  it('чем плотнее лист, тем меньше карточка', () => {
    const area = n => cardSizeMm(n).wMm * cardSizeMm(n).hMm;
    for (let i = 1; i < CARD_COUNTS.length; i++) {
      expect(area(CARD_COUNTS[i])).toBeLessThan(area(CARD_COUNTS[i - 1]));
    }
  });

  it('зона условия не вылезает за карточку', () => {
    CARD_COUNTS.forEach((n) => {
      const card = cardSizeMm(n);
      const content = cardContentMm(n, { showHead: true, showAnswer: true, showCode: true });
      expect(content.hMm).toBeGreaterThan(0);
      expect(content.hMm).toBeLessThan(card.hMm);
      expect(content.wMm).toBeLessThan(card.wMm);
    });
  });

  it('поле «Ответ» и код отъедают место у условия', () => {
    const bare = cardContentMm(6, {});
    const withAnswer = cardContentMm(6, { showAnswer: true });
    const withCode = cardContentMm(6, { showCode: true });
    expect(withAnswer.hMm).toBeLessThan(bare.hMm);
    expect(withCode.hMm).toBeLessThan(bare.hMm);
  });

  it('ответ и код в одной строке подвала — высоты не складываются', () => {
    const answerOnly = cardContentMm(6, { showAnswer: true });
    const both = cardContentMm(6, { showAnswer: true, showCode: true });
    expect(both.hMm).toBe(answerOnly.hMm);
  });

  it('на самой плотной раскладке карточка всё ещё вмещает условие', () => {
    const content = cardContentMm(12, { showHead: true });
    expect(content.hMm).toBeGreaterThan(10);
  });

  it('подпись плотности называет ходовой формат', () => {
    expect(cardFormatLabel(4)).toMatch(/^A6 · /);
    expect(cardFormatLabel(6)).toMatch(/^2 × 3 · /);
  });
});

describe('подгонка кегля под карточку', () => {
  it('влезающее условие печатается заданным кеглем', () => {
    expect(fitFontPt(10, { measuredMm: 20, availMm: 30 })).toBe(10);
  });

  it('длинное условие ужимается, но не бесконечно', () => {
    const fitted = fitFontPt(10, { measuredMm: 60, availMm: 30 });
    expect(fitted).toBeLessThan(10);
    expect(fitted).toBeGreaterThanOrEqual(10 * 0.68);
  });

  it('без замера кегль не трогаем', () => {
    expect(fitFontPt(12, { measuredMm: null, availMm: 40 })).toBe(12);
  });

  it('совсем не влезающее условие помечается, а слегка длинное — нет', () => {
    expect(cardOverflows({ measuredMm: 200, availMm: 20, basePt: 10 })).toBe(true);
    expect(cardOverflows({ measuredMm: 34, availMm: 30, basePt: 10 })).toBe(false);
    expect(cardOverflows({ measuredMm: null, availMm: 30, basePt: 10 })).toBe(false);
  });
});

describe('настройки листа карточек', () => {
  it('чужая плотность и кегль не роняют лист', () => {
    const s = normalizeMarathonCardSettings({ count: 7, textSize: 13, fontFamily: 'gothic' });
    expect(CARD_COUNTS).toContain(s.count);
    expect(s.textSize).toBe(12);     // ближайшее значение шкалы
    expect(s.fontFamily).toBe('serif');
  });

  it('смена плотности тянет кегль пресета', () => {
    const dense = applyCardCount({ ...normalizeMarathonCardSettings({}), textSize: 14 }, 12);
    expect(dense.count).toBe(12);
    expect(dense.textSize).toBe(CARD_TEXT_PRESET[12]);
  });

  it('число копий держится в разумных пределах', () => {
    expect(normalizeMarathonCardSettings({ copies: 0 }).copies).toBeGreaterThan(0);
    expect(normalizeMarathonCardSettings({ copies: 5000 }).copies).toBeLessThanOrEqual(200);
  });
});

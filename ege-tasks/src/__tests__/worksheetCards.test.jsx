import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { App } from 'antd';
import WorksheetCards from '../components/worksheet/cards/WorksheetCards';
import {
  CARD_LAYOUTS, CARD_LAYOUT_KEYS, CARD_PAD_MM, SHEET_H_MM, SHEET_PAD_MM, SHEET_W_MM,
  DEFAULT_CARD_SETTINGS, MAX_SHEETS, answerWidthMm, applyLayout, canSplitColumns, cardInnerMm,
  cardSizeMm, cardSlots, cardsSummary, cardsTotal, cutLines, minFitPt, nextFitPt,
  normalizeCardSettings, normalizeLayout, paginateCards, sheetsWord, variantVisible,
} from '../utils/worksheetCards';

const wrapper = ({ children }) => <App>{children}</App>;

const task = (n) => ({
  id: `t${n}`,
  code: `EGE-${n}`,
  statement_md: `Вычислите $${n} + ${n}$`,
  answer: String(n * 2),
});
const variant = (number, tasks) => ({ number, tasks });

describe('геометрия листа', () => {
  it('карточки заполняют лист без остатка', () => {
    CARD_LAYOUT_KEYS.forEach((key) => {
      const { cols, rows } = CARD_LAYOUTS[key];
      const { wMm, hMm } = cardSizeMm(key);
      expect(wMm * cols + 2 * SHEET_PAD_MM).toBeCloseTo(SHEET_W_MM, 6);
      expect(hMm * rows + 2 * SHEET_PAD_MM).toBeCloseTo(SHEET_H_MM, 6);
    });
  });

  it('A6 — четвертинка листа, A7 — восьмушка', () => {
    expect(cardSizeMm('4')).toEqual({ wMm: 100, hMm: 143 });
    expect(cardSizeMm('8')).toEqual({ wMm: 100, hMm: 71.5 });
  });

  it('полоса набора = карточка минус внутренние отступы', () => {
    const { wMm, hMm } = cardSizeMm('6');
    expect(cardInnerMm('6')).toEqual({ wMm: wMm - 2 * CARD_PAD_MM, hMm: hMm - 2 * CARD_PAD_MM });
  });

  it('линии реза — ровно по границам карточек, одна на стык', () => {
    expect(cutLines('1')).toEqual({ vertical: [], horizontal: [] });
    expect(cutLines('4')).toEqual({ vertical: [105], horizontal: [148] });
    const eight = cutLines('8');
    expect(eight.vertical).toEqual([105]);
    expect(eight.horizontal).toEqual([76.5, 148, 219.5]);
  });

  it('две колонки задач — только на широкой карточке', () => {
    expect(canSplitColumns('1')).toBe(true);
    expect(canSplitColumns('2')).toBe(true);
    expect(canSplitColumns('3')).toBe(true);
    expect(canSplitColumns('4')).toBe(false);
    expect(canSplitColumns('2v')).toBe(false);
  });

  it('поле ответа — в пределах 14–30 мм', () => {
    CARD_LAYOUT_KEYS.forEach((key) => {
      [1, 2].forEach((c) => {
        const w = answerWidthMm(key, c);
        expect(w).toBeGreaterThanOrEqual(14);
        expect(w).toBeLessThanOrEqual(30);
      });
    });
  });

  it('старые форматы режима открываются новой раскладкой', () => {
    expect(normalizeLayout('А6')).toBe('4');
    expect(normalizeLayout('А5')).toBe('2');
    expect(normalizeLayout('А4')).toBe('1');
    expect(normalizeLayout('А4-2V')).toBe('2v');
    expect(normalizeLayout('мусор')).toBe('4');
    expect(normalizeLayout(8)).toBe('8');
  });
});

describe('тираж', () => {
  it('«добить лист»: один вариант на A6 — четыре копии, а не одна и три пустых места', () => {
    expect(cardsTotal({ variantsCount: 1, perSheet: 4, fill: 'sheet' })).toBe(4);
    expect(cardsTotal({ variantsCount: 1, perSheet: 4, fill: 'none' })).toBe(1);
    expect(cardsTotal({ variantsCount: 5, perSheet: 4, fill: 'sheet' })).toBe(8);
  });

  it('«на класс»: округление вверх до целого листа', () => {
    expect(cardsTotal({ variantsCount: 2, perSheet: 4, fill: 'count', copies: 27 })).toBe(28);
    // Меньше, чем вариантов, не бывает: каждый вариант хотя бы один раз.
    expect(cardsTotal({ variantsCount: 6, perSheet: 4, fill: 'count', copies: 2 })).toBe(8);
  });

  it('потолок листов — опечатка не вешает вкладку', () => {
    expect(cardsTotal({ variantsCount: 1, perSheet: 1, fill: 'count', copies: 500 })).toBe(MAX_SHEETS);
  });

  it('варианты чередуются по кругу, первая карточка варианта помечена', () => {
    const slots = cardSlots({ variantsCount: 3, perSheet: 4, fill: 'sheet' });
    expect(slots.map(s => s.variantIndex)).toEqual([0, 1, 2, 0]);
    expect(slots.map(s => s.first)).toEqual([true, true, true, false]);
    expect(new Set(slots.map(s => s.key)).size).toBe(slots.length);
  });

  it('раскладка по листам', () => {
    const slots = cardSlots({ variantsCount: 2, perSheet: 4, fill: 'count', copies: 10 });
    expect(paginateCards(slots, 4).map(s => s.length)).toEqual([4, 4, 4]);
  });

  it('сводка считает запасные и экземпляры на вариант', () => {
    const s = cardsSummary({ variantsCount: 3, layout: '4', fill: 'count', copies: 25 });
    expect(s).toMatchObject({ perSheet: 4, cards: 28, sheets: 7, spare: 3, emptySlots: 0 });
    expect(s.perVariantMin).toBe(9);
    expect(s.perVariantMax).toBe(10);
    expect(cardsSummary({ variantsCount: 3, layout: '4', fill: 'none' }).emptySlots).toBe(1);
  });

  it('склонение «лист»', () => {
    expect([1, 2, 5, 11, 21, 22, 25].map(sheetsWord))
      .toEqual(['лист', 'листа', 'листов', 'листов', 'лист', 'листа', 'листов']);
  });
});

describe('подгонка кегля', () => {
  it('влезает — кегль не трогаем', () => {
    expect(nextFitPt(10, 1, 6.5)).toBe(10);
    expect(nextFitPt(10, 0.8, 6.5)).toBe(10);
  });

  it('вчетверо больше — кегль вдвое мельче (высота текста ~ кегль²), но не ниже минимума', () => {
    expect(nextFitPt(12, 4, 5)).toBe(6);
    expect(nextFitPt(12, 4, 7)).toBe(7);
  });

  it('чуть-чуть не влезает — минимум полпункта вниз, иначе подгонка стоит на месте', () => {
    expect(nextFitPt(10, 1.01, 6.5)).toBe(9.5);
  });

  it('минимальный кегль — около двух третей заданного, не мельче 6,5 pt', () => {
    expect(minFitPt(12)).toBe(8);
    expect(minFitPt(8)).toBe(6.5);
  });
});

describe('настройки', () => {
  it('битые значения нормализуются, кегль притягивается к шкале', () => {
    const s = normalizeCardSettings({ layout: 'x', fontPt: 9.6, fill: 'ещё', copies: -3, innerColumns: 2 });
    expect(s.layout).toBe(DEFAULT_CARD_SETTINGS.layout);
    expect(s.fontPt).toBe(10);
    expect(s.fill).toBe('sheet');
    expect(s.copies).toBe(DEFAULT_CARD_SETTINGS.copies);
    // A6 узка для двух колонок — настройка снимается, а не ломает вёрстку.
    expect(s.innerColumns).toBe(1);
  });

  it('смена раскладки тянет кегль пресета', () => {
    expect(applyLayout(DEFAULT_CARD_SETTINGS, '8').fontPt).toBe(8);
    expect(applyLayout(DEFAULT_CARD_SETTINGS, '1').fontPt).toBe(12);
    expect(applyLayout({ ...DEFAULT_CARD_SETTINGS, layout: '1', innerColumns: 2 }, '4').innerColumns).toBe(1);
  });

  it('«Вариант N» — сам при нескольких вариантах, учитель может перебить', () => {
    expect(variantVisible({ showVariant: null }, 1)).toBe(false);
    expect(variantVisible({ showVariant: null }, 2)).toBe(true);
    expect(variantVisible({ showVariant: true }, 1)).toBe(true);
    expect(variantVisible({ showVariant: false }, 3)).toBe(false);
  });
});

describe('WorksheetCards — вёрстка', () => {
  const two = [variant(1, [task(1), task(2), task(3)]), variant(2, [task(4), task(5), task(6)])];
  const draw = (settings = {}, variants = two) => render(
    <WorksheetCards
      variants={variants}
      settings={normalizeCardSettings(settings)}
      title="Самостоятельная"
      variantLabel="Вариант"
    />,
    { wrapper },
  );

  it('лист A6 добивается копиями: 4 карточки на одном листе', () => {
    const { container } = draw({ layout: '4', fill: 'sheet' });
    expect(container.querySelectorAll('.wcd-sheet')).toHaveLength(1);
    expect(container.querySelectorAll('.wcd-card')).toHaveLength(4);
    const labels = [...container.querySelectorAll('.wcd-variant')].map(n => n.textContent);
    expect(labels).toEqual(['Вариант 1', 'Вариант 2', 'Вариант 1', 'Вариант 2']);
  });

  it('на карточке — вся работа: номера, условия, поля ответа, поле ФИ', () => {
    const { container } = draw({ layout: '4', answerStyle: 'line' });
    const card = container.querySelector('.wcd-card');
    expect([...card.querySelectorAll('.wcd-num')].map(n => n.textContent)).toEqual(['1', '2', '3']);
    expect(card.querySelectorAll('.wcd-ans--line')).toHaveLength(3);
    expect(card.querySelector('.wcd-field-label').textContent).toBe('ФИ');
    expect(card.querySelector('.wcd-title').textContent).toBe('Самостоятельная');
  });

  it('таблица ответов внизу вместо полей у задач', () => {
    const { container } = draw({ answerStyle: 'strip' });
    const card = container.querySelector('.wcd-card');
    expect(card.querySelectorAll('.wcd-ans')).toHaveLength(0);
    expect([...card.querySelectorAll('.wcd-strip-num')].map(n => n.textContent)).toEqual(['1', '2', '3']);
  });

  it('линии реза рисуются по раскладке', () => {
    const { container } = draw({ layout: '8' });
    expect(container.querySelectorAll('.wcd-cut--v')).toHaveLength(1);
    expect(container.querySelectorAll('.wcd-cut--h')).toHaveLength(3);
  });

  it('лист ответов — по одному разу на вариант, не на каждую копию', () => {
    const { container } = draw({ layout: '8', showKey: true });
    expect(container.querySelectorAll('.wcd-card')).toHaveLength(8);
    expect(container.querySelectorAll('.wcd-key-block')).toHaveLength(2);
    expect([...container.querySelectorAll('.wcd-key-answer')].map(n => n.textContent.trim()))
      .toEqual(['2', '4', '6', '8', '10', '12']);
  });

  it('без листа ответов — только листы карточек', () => {
    const { container } = draw({ showKey: false });
    expect(container.querySelector('.wcd-key')).toBeNull();
  });

  it('размеры карточки идут в вёрстку из расчёта', () => {
    const { container } = draw({ layout: '6' });
    const { wMm, hMm } = cardSizeMm('6');
    const card = container.querySelector('.wcd-card');
    expect(card.style.width).toBe(`${wMm}mm`);
    expect(card.style.height).toBe(`${hMm}mm`);
  });

  it('один вариант — без надписи «Вариант», ключ без заголовков вариантов', () => {
    const { container } = draw({}, [variant(1, [task(1)])]);
    expect(container.querySelector('.wcd-variant')).toBeNull();
    expect(container.querySelector('.wcd-key-variant')).toBeNull();
  });
});

describe('печатный канон CSS', () => {
  const css = readFileSync(
    resolve(__dirname, '../components/worksheet/cards/worksheetCards.css'),
    'utf8',
  );

  it('scoped-печать без звёздочки', () => {
    expect(css).toMatch(/body:has\(\.wcd-root\)\s*\{\s*visibility:\s*hidden/);
    expect(css).not.toMatch(/body:has\(\.wcd-root\)\s+\*\s*\{/);
  });

  it('жёсткая ширина документа и скрытые порталы Ant', () => {
    expect(css).toMatch(/html:has\(\.wcd-root\),\s*body:has\(\.wcd-root\)\s*\{[^}]*width:\s*210mm/);
    expect(css).toMatch(/\.ant-tooltip/);
    expect(css).toMatch(/display:\s*none\s*!important/);
  });

  it('лист 296 мм и абсолютный корень', () => {
    expect(css).toMatch(/\.wcd-sheet\s*\{\s*height:\s*296mm/);
    expect(css).toMatch(/\.wcd-root\s*\{\s*position:\s*absolute/);
  });

  it('только чёрная краска', () => {
    const tokens = css.match(/--wcd-(ink|rule|hair):\s*#[0-9a-fA-F]+/g) || [];
    expect(tokens.length).toBe(3);
    tokens.forEach(t => expect(t).toMatch(/#000000$/));
  });

  it('правило по svg — только внутри .mr-figure (радикал KaTeX)', () => {
    const svgRules = css.match(/[^{}]*svg[^{}]*\{/g) || [];
    svgRules.forEach(r => expect(r).toMatch(/\.mr-figure/));
  });
});

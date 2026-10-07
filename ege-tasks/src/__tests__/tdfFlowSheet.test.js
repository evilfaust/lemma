import { describe, it, expect } from 'vitest';
import {
  normalizeFlowSettings, FLOW_DEFAULTS, itemView, answerSpaceMm, hasOwnNumber,
  flowSummary, flowContentWidthMm, flowContentHeightMm, SPACE_MIN_MM, SPACE_MAX_MM,
} from '../utils/tdfFlowSheet';

const withGap = { id: 'a', formulation_md: 'число [[неотрицательное]]' };
const plain = { id: 'b', formulation_md: 'просто текст' };
const header = { id: 'h', is_section_header: true, section_title: 'Раздел' };

describe('normalizeFlowSettings', () => {
  it('пустые и мусорные значения → умолчания', () => {
    expect(normalizeFlowSettings({})).toEqual(FLOW_DEFAULTS);
    expect(normalizeFlowSettings({ mode: 'x', textPt: 99, spaceFactor: 7, showFio: 'да' })).toEqual(FLOW_DEFAULTS);
  });

  it('допустимые значения сохраняются', () => {
    const s = normalizeFlowSettings({ mode: 'headers', fill: 'lines', spaceFactor: 2, textPt: 14, drawingSize: 'l', showFio: false });
    expect(s).toMatchObject({ mode: 'headers', fill: 'lines', spaceFactor: 2, textPt: 14, drawingSize: 'l', showFio: false });
  });
});

describe('itemView', () => {
  it('эталон — всё целиком, заголовки — всё местом', () => {
    expect(itemView(withGap, { mode: 'etalon' })).toBe('etalon');
    expect(itemView(plain, { mode: 'headers' })).toBe('header');
  });

  it('бланк: пункт с пропусками — с пропусками, без них — по настройке', () => {
    expect(itemView(withGap, { mode: 'gaps', plainItems: 'full' })).toBe('gaps');
    expect(itemView(plain, { mode: 'gaps', plainItems: 'full' })).toBe('etalon');
    expect(itemView(plain, { mode: 'gaps', plainItems: 'header' })).toBe('header');
  });

  it('пропуск в краткой записи тоже считается', () => {
    expect(itemView({ short_notation_md: '$\\gap{x}$' }, { mode: 'gaps', plainItems: 'header' })).toBe('gaps');
  });
});

describe('answerSpaceMm', () => {
  it('высота эталона × запас, вверх до целой клетки', () => {
    expect(answerSpaceMm(20, 1.5)).toBe(30);
    expect(answerSpaceMm(21, 1)).toBe(25);
    expect(answerSpaceMm(25, 1)).toBe(25);
  });

  it('не меньше минимума и не больше потолка', () => {
    expect(answerSpaceMm(0, 2)).toBe(SPACE_MIN_MM);
    expect(answerSpaceMm(400, 3)).toBe(SPACE_MAX_MM);
  });

  it('результат кратен клетке', () => {
    for (let h = 1; h < 120; h += 3.7) expect(answerSpaceMm(h, 1.5) % 5).toBe(0);
  });
});

describe('hasOwnNumber', () => {
  it('номер в названии', () => {
    expect(hasOwnNumber('1. Определение')).toBe(true);
    expect(hasOwnNumber('12) Свойства')).toBe(true);
    expect(hasOwnNumber('1.2. Тождество')).toBe(true);
    expect(hasOwnNumber('Определение корня')).toBe(false);
    expect(hasOwnNumber('2x + 1')).toBe(false);
    expect(hasOwnNumber('')).toBe(false);
  });
});

describe('flowSummary и размеры', () => {
  it('считает пункты по видам, разделы пропускает', () => {
    expect(flowSummary([withGap, plain, header], { mode: 'gaps', plainItems: 'header' }))
      .toEqual({ etalon: 0, gaps: 1, header: 1 });
  });

  it('полоса набора A4 книжного, колонтитул отъедает высоту', () => {
    expect(flowContentWidthMm()).toBe(194);
    expect(flowContentHeightMm({ showFooter: true })).toBeLessThan(flowContentHeightMm({ showFooter: false }));
  });
});

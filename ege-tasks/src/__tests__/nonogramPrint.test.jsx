import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import NonogramPrintLayout, { nonogramOverflow } from '../components/nonogram/NonogramPrintLayout';
import {
  layoutGrid, blockSizeMm, clueLimits, resolveOrientation, PAGE_MM, MARGIN_MM,
  HEAD_MM, INSTR_MM, FOOT_MM, CUT_MM,
} from '../utils/nonogram/layout';
import {
  NONOGRAM_DEFAULTS, normalizeNonogramSettings, generateNonogramVariants, nonogramKey,
  sheetBlock, analyze,
} from '../utils/nonogram/sheet';
import { cluesOf } from '../utils/nonogram/solver';
import { suggestGivens } from '../utils/nonogram/fix';

const pic = (rows) => rows.map(s => [...s].map(ch => ch === '#'));
const HEART = pic([
  '.##.##.',
  '#######',
  '#######',
  '.#####.',
  '..###..',
  '...#...',
]);

function randomPic(n, seed) {
  let s = seed;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  return Array.from({ length: n }, () => Array.from({ length: n }, () => rnd() < 0.6));
}

describe('раскладка листа', () => {
  it('ориентация: широкие сетки — альбомом', () => {
    expect(resolveOrientation('auto', 10)).toBe('portrait');
    expect(resolveOrientation('auto', 15)).toBe('landscape');
    expect(resolveOrientation('portrait', 15)).toBe('portrait');
  });

  it('место под кроссворд = лист минус поля, шапка, инструкция, подвал', () => {
    const b = blockSizeMm({ orientation: 'portrait', perPage: 1 });
    expect(b.w).toBe(PAGE_MM.portrait.w - 2 * MARGIN_MM);
    expect(b.h).toBeCloseTo(PAGE_MM.portrait.h - 1 - 2 * MARGIN_MM - HEAD_MM.full - INSTR_MM - FOOT_MM);
    const two = blockSizeMm({ orientation: 'portrait', perPage: 2 });
    expect(two.slot * 2 + CUT_MM).toBeCloseTo(PAGE_MM.portrait.h - 1 - 2 * MARGIN_MM);
  });

  it('сетка с примерами помещается в блок', () => {
    for (const n of [5, 10, 15]) {
      const m = randomPic(n, n);
      const s = normalizeNonogramSettings({ cols: n, rows: n, variantsCount: 1 });
      const block = sheetBlock(s, n);
      const { variants } = generateNonogramVariants(m, s);
      const L = layoutGrid(variants[0].rows, variants[0].cols, block);
      expect(L.overflow, `${n}×${n}`).toBe(false);
      expect(L.widthMm).toBeLessThanOrEqual(block.w + 0.01);
      expect(L.heightMm).toBeLessThanOrEqual(block.h + 0.01);
      expect(L.cellMm).toBeGreaterThanOrEqual(5);
    }
  });

  it('пределы примеров: столбец уже строки', () => {
    const clues = cluesOf(randomPic(15, 4));
    const lim = clueLimits(clues, blockSizeMm({ orientation: 'landscape' }));
    expect(lim.col.em).toBeLessThan(lim.row.em);
    expect(lim.col.noTall).toBe(true);
  });
});

describe('лист и ключ', () => {
  const settings = normalizeNonogramSettings({ cols: 7, rows: 6, variantsCount: 2 });
  const { variants } = generateNonogramVariants(HEART, settings);

  it('по странице на вариант + ключ; числа ключа = подсказки картинки', () => {
    const { container } = render(
      <NonogramPrintLayout title="Сердце" settings={settings} matrix={HEART} givens={[]} variants={variants} />,
    );
    const pages = container.querySelectorAll('.nng-page');
    expect(pages).toHaveLength(3);
    const key = container.querySelector('.nng-page--key');
    const nums = [...key.querySelectorAll('.nng-rowclue')].map(el =>
      [...el.querySelectorAll('.nng-q--num')].map(q => Number(q.textContent)));
    expect(nums).toEqual(cluesOf(HEART).rows);
    // картинка ключа залита ровно там, где закрашено
    expect(key.querySelectorAll('.nng-cell--fill')).toHaveLength(HEART.flat().filter(Boolean).length);
    // у ученика ничего не залито (готовых клеток нет)
    expect(pages[0].querySelectorAll('.nng-cell--fill')).toHaveLength(0);
    expect(pages[0].textContent).toContain('Вариант 1');
    expect(pages[0].textContent).toContain(`= ${HEART.flat().filter(Boolean).length}`);
  });

  it('готовые клетки: закрашенная залита, пустая с точкой', () => {
    const givens = [{ r: 1, c: 0, v: 1 }, { r: 0, c: 0, v: 0 }];
    const { container } = render(
      <NonogramPrintLayout title="t" settings={{ ...settings, showKey: false }} matrix={HEART} givens={givens} variants={variants} />,
    );
    const page = container.querySelector('.nng-page');
    expect(page.querySelectorAll('.nng-cell--fill')).toHaveLength(1);
    expect(page.querySelectorAll('.nng-cell--dot')).toHaveLength(1);
    expect(page.textContent).toContain('Клетка с точкой');
  });

  it('два на листе — две одинаковые копии с линией отреза', () => {
    const s2 = { ...settings, perPage: 2, showKey: false, variantsCount: 1 };
    const { container } = render(
      <NonogramPrintLayout title="t" settings={s2} matrix={HEART} givens={[]} variants={variants.slice(0, 1)} />,
    );
    const page = container.querySelector('.nng-page');
    const blocks = page.querySelectorAll('.nng-block');
    expect(blocks).toHaveLength(2);
    expect(page.querySelector('.nng-cut')).not.toBeNull();
    expect(blocks[0].querySelector('.nng-grid').innerHTML).toBe(blocks[1].querySelector('.nng-grid').innerHTML);
  });

  it('пустая линия печатает «0»', () => {
    const m = pic(['#.#', '...', '###']);
    const s = normalizeNonogramSettings({ variantsCount: 1 });
    const { variants: v } = generateNonogramVariants(m, s);
    const { container } = render(
      <NonogramPrintLayout title="t" settings={s} matrix={m} givens={[]} variants={v} only="key" />,
    );
    const rowClues = container.querySelectorAll('.nng-rowclue');
    expect(rowClues[1].textContent).toBe('0');
  });

  it('предупреждение о переполнении — только когда не влезло', () => {
    expect(nonogramOverflow(HEART, variants, settings)).toBe(false);
  });
});

describe('настройки и свежесть', () => {
  it('нормализация: размеры, уровень, варианты в пределах', () => {
    const s = normalizeNonogramSettings({ cols: 99, rows: 1, level: 7, variantsCount: 40, perPage: 3 });
    expect(s.cols).toBe(20);
    expect(s.rows).toBe(5);
    expect(s.level).toBe(1);
    expect(s.variantsCount).toBe(6);
    expect(s.perPage).toBe(1);
    expect(normalizeNonogramSettings({}).categories).toEqual(NONOGRAM_DEFAULTS.categories);
  });

  it('ключ меняется от картинки и уровня, но не от готовых клеток', () => {
    const k = nonogramKey(HEART, NONOGRAM_DEFAULTS);
    expect(nonogramKey(HEART, { ...NONOGRAM_DEFAULTS, level: 2 })).not.toBe(k);
    const other = HEART.map(r => r.slice());
    other[0][0] = true;
    expect(nonogramKey(other, NONOGRAM_DEFAULTS)).not.toBe(k);
    expect(nonogramKey(HEART, { ...NONOGRAM_DEFAULTS, showKey: false })).toBe(k);
  });

  it('анализ с готовыми клетками доводит неоднозначную картинку до конца', () => {
    const m = randomPic(10, 77);
    const { givens } = suggestGivens(m);
    expect(analyze(m, givens).result.status).toBe('unique');
  });
});

describe('печатный CSS (канон)', () => {
  const css = readFileSync(resolve(__dirname, '../components/nonogram/NonogramPrintLayout.css'), 'utf-8');

  it('жёсткая ширина документа по ориентации и порталы Ant скрыты', () => {
    expect(css).toMatch(/body:has\(\.nng-print-root--portrait\)\s*\{\s*width: 210mm/);
    expect(css).toMatch(/body:has\(\.nng-print-root--landscape\)\s*\{\s*width: 297mm/);
    expect(css).toContain('body:has(.nng-print-root) .ant-modal-root');
    expect(css).not.toMatch(/body:has\(\.nng-print-root\)\s*\*/);
  });

  it('лист 296/209 мм, высоты шапки/инструкции/подвала — как в раскладке', () => {
    expect(css).toMatch(/\.nng-page--portrait\s*\{\s*height: 296mm/);
    expect(css).toMatch(/\.nng-page--landscape\s*\{\s*height: 209mm/);
    expect(css).toContain(`height: ${HEAD_MM.full}mm`);
    expect(css).toContain(`height: ${HEAD_MM.compact}mm`);
    expect(css).toContain(`height: ${INSTR_MM}mm`);
    expect(css).toContain(`height: ${FOOT_MM}mm`);
    expect(css).toContain(`height: ${CUT_MM}mm`);
    expect(css).toContain(`padding: ${MARGIN_MM}mm`);
  });

  it('только чёрная краска', () => {
    const colors = css.match(/#[0-9a-fA-F]{3,6}\b/g) || [];
    const ink = colors.filter(c => !['#000', '#fff', '#E9EAEE'].includes(c));
    expect(ink).toEqual([]);
  });
});

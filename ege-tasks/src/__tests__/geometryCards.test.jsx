import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { App } from 'antd';
import fs from 'node:fs';
import path from 'node:path';
import {
  CARD_LAYOUTS, cardLayoutById, cardSizeMm, cardTextMm, cardGridLines, chooseCardPlacement,
  fitByAspect, svgAspect, resolveCardPlace, SHEET_PAD_MM, HEADER_MM, GAP_MM,
} from '../utils/geometryCards';
import { parsePlanimBlock, planimDrawingSvg } from '../utils/planim/dsl';
import GeometryCard, { cardDrawingOf } from '../components/geometry/cards/GeometryCard';
import GeometryCards from '../components/geometry/cards/GeometryCards';

// Текст, который в столбце шириной w мм занимает `chars` знаков по 1,8 мм
// на строку высотой 4 мм — грубая, но монотонная модель переноса.
const textModel = (chars) => (w) => Math.ceil((chars * 1.8) / w) * 4;

describe('cardSizeMm — карточка в миллиметрах', () => {
  it('ячейки делят лист без полей и шапки поровну', () => {
    for (const l of CARD_LAYOUTS) {
      const s = cardSizeMm(l, { header: true, code: true });
      expect(s.cell.w * l.cols + 2 * SHEET_PAD_MM).toBeCloseTo(s.page.w, 6);
      expect(s.cell.h * l.rows + 2 * SHEET_PAD_MM + HEADER_MM).toBeCloseTo(s.page.h, 6);
      expect(s.content.w).toBeLessThan(s.cell.w);
      expect(s.content.h).toBeLessThan(s.cell.h);
    }
  });

  it('без шапки ячейки выше; кегль S/M/L', () => {
    const l = cardLayoutById('a5-6');
    expect(cardSizeMm(l, { header: false }).cell.h).toBeGreaterThan(cardSizeMm(l).cell.h);
    expect(cardTextMm(l, 's')).toBeLessThan(cardTextMm(l, 'm'));
    expect(cardTextMm(l, 'l')).toBeGreaterThan(cardTextMm(l, 'm'));
  });

  it('клетка — линий ровно в ячейку', () => {
    expect(cardGridLines({ w: 69, h: 64 })).toEqual({ v: 13, h: 12 });
    expect(cardGridLines({ w: 70, h: 65 })).toEqual({ v: 13, h: 12 });
  });
});

describe('chooseCardPlacement — текст и чертёж не перекрываются', () => {
  const W = 64;
  const H = 58;

  const check = (r) => {
    // текст и чертёж вместе помещаются в карточку
    if (r.place === 'top') {
      expect(r.textH + GAP_MM + r.box.h).toBeLessThanOrEqual(H + 1e-6);
      expect(r.box.w).toBeCloseTo(W, 6);
    } else {
      expect(r.textW + GAP_MM + r.box.w).toBeCloseTo(W, 6);
      expect(r.textH).toBeLessThanOrEqual(H + 0.3);
    }
    expect(r.fit.w).toBeLessThanOrEqual(r.box.w + 1e-6);
    expect(r.fit.h).toBeLessThanOrEqual(r.box.h + 1e-6);
  };

  it('короткий вопрос к готовому чертежу — сверху, чертёж почти во всю карточку', () => {
    const r = chooseCardPlacement({ W, H, textHeight: textModel(20), fitDrawing: fitByAspect(1.4) });
    expect(r.place).toBe('top');
    expect(r.overflow).toBe(false);
    check(r);
    expect(r.fit.w).toBeGreaterThan(W * 0.85);
  });

  it('длинное условие и высокий чертёж — текст колонкой слева', () => {
    const r = chooseCardPlacement({ W, H, textHeight: textModel(260), fitDrawing: fitByAspect(0.7) });
    expect(r.place).toBe('left');
    check(r);
  });

  it('выбор учителя соблюдается', () => {
    for (const place of ['top', 'left', 'right']) {
      const r = chooseCardPlacement({ W, H, textHeight: textModel(120), fitDrawing: fitByAspect(1.2), place });
      expect(r.place).toBe(place);
      check(r);
    }
  });

  it('без чертежа — текст во всю ширину', () => {
    const r = chooseCardPlacement({ W, H, textHeight: textModel(100), fitDrawing: null });
    expect(r).toMatchObject({ place: 'top', textW: W, box: null, overflow: false });
  });

  it('не влезает никак — подсказка уменьшить кегль, не меньше 0,7', () => {
    const r = chooseCardPlacement({ W, H, textHeight: textModel(1500), fitDrawing: fitByAspect(1) });
    expect(r.overflow).toBe(true);
    expect(r.fontK).toBeLessThan(1);
    expect(r.fontK).toBeGreaterThanOrEqual(0.7);
  });
});

describe('сохранённый выбор и пропорции', () => {
  it('работа главнее задачи; старый свободный макет = авто', () => {
    expect(resolveCardPlace({ place: 'left' }, { card: { place: 'top' } })).toBe('left');
    expect(resolveCardPlace(null, { card: { place: 'top' } })).toBe('top');
    expect(resolveCardPlace(null, JSON.stringify({ card: { place: 'right' } }))).toBe('right');
    expect(resolveCardPlace({ image: { x: 4 }, text: { x: 55 } }, { print: { image: {}, text: {} } })).toBe('auto');
    expect(resolveCardPlace(null, 'не json')).toBe('auto');
  });

  it('svgAspect — по viewBox, иначе по width/height', () => {
    expect(svgAspect('<svg viewBox="0 0 300 150"></svg>')).toBe(2);
    expect(svgAspect('<svg width="200" height="100"></svg>')).toBe(2);
    expect(svgAspect('<svg width="100%"></svg>')).toBeNull();
    expect(fitByAspect(2)(40, 40)).toEqual({ w: 40, h: 20 });
    expect(fitByAspect(0.5)(40, 40)).toEqual({ w: 20, h: 40 });
  });

  it('чертёж задачи: наш — пересобирается, картинка решения — не идёт', () => {
    const { scene } = parsePlanimBlock('треугольник ABC 5 6 7');
    expect(cardDrawingOf({ drawing_view: 'svg', drawing_svg: planimDrawingSvg(scene) }).kind).toBe('planim');
    expect(cardDrawingOf({ drawing_view: 'svg', drawing_svg: '<svg viewBox="0 0 4 3"></svg>' }).kind).toBe('svg');
    expect(cardDrawingOf({ id: 'x', geogebra_image_base64: 'a.png', image_role: 'solution' })).toBeNull();
  });
});

describe('карточка и лист', () => {
  const { scene } = parsePlanimBlock('параллелограмм ABCD 6 4 60\nK на AD 3:1\nотрезок BK');
  const task = {
    id: 't1', code: 'GEO-1', statement_md: 'Найдите периметр $BCDK$.', answer: '20',
    drawing_view: 'svg', drawing_svg: planimDrawingSvg(scene),
  };
  const size = cardSizeMm(cardLayoutById('a5-6'));

  it('планиметрический чертёж — в мм, буквы KaTeX', () => {
    const { container } = render(<GeometryCard task={task} number={3} size={size} textMm={3.1} />);
    const svg = container.querySelector('.gc-drawing-built svg');
    expect(svg).toBeTruthy();
    expect(svg.getAttribute('width')).toMatch(/mm$/);
    expect(svg.outerHTML).toMatch(/KaTeX_Math/);
    expect(container.querySelector('.gc-body .gc-num').textContent).toBe('3');
    expect(container.querySelector('.gc-code').textContent).toBe('GEO-1');
  });

  it('лист: варианты с нового листа, кнопки раскладки только при сохранении', () => {
    const sections = [
      { label: 'Вариант 1', tasks: [task, { ...task, id: 't2' }] },
      { label: 'Вариант 2', tasks: [{ ...task, id: 't3' }] },
    ];
    const { container, rerender } = render(<App><GeometryCards sections={sections} /></App>);
    const sheets = container.querySelectorAll('.gc-sheet');
    expect(sheets).toHaveLength(2);
    expect(sheets[1].querySelector('.gc-body .gc-num').textContent).toBe('1');
    expect(sheets[0].querySelectorAll('.gc-card')).toHaveLength(6);
    expect(container.querySelector('.gc-controls')).toBeNull();
    rerender(<App><GeometryCards sections={sections} onLayoutsSave={async () => {}} /></App>);
    expect(container.querySelectorAll('.gc-controls')).toHaveLength(3);
  });

  it('печатный CSS: только чёрная краска, канон печати', () => {
    const css = fs.readFileSync(path.resolve(__dirname, '../components/geometry/cards/geometryCards.css'), 'utf8');
    const print = css.slice(css.indexOf('@media print'));
    expect(print).toMatch(/body:has\(\.gc-root\) \.ant-tooltip/);
    expect(print).not.toMatch(/body:has\(\.gc-root\) \* \{/);
    // цвета линий и текста — чёрные; серые линии на ч/б принтере пропадают
    const colors = css.match(/#[0-9a-f]{3,6}\b/gi) || [];
    expect(colors.filter((c) => !/^#(000|000000|fff|ffffff|faad14)$/i.test(c))).toEqual([]);
  });
});

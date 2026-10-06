import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { App } from 'antd';
import {
  parsePlanimBlock, planimPrintFrame, planimPrintSvgFromSpec, planimDrawingSvg,
} from '../utils/planim/dsl';
import { figureBoxMm, psLetterMm } from '../utils/kimImageSize';
import { parseStereoBlock, stereoPrintFrame, stereoDrawingSvg } from '../utils/stereo/dsl';
import { geometrySheetTask } from '../utils/geometrySheet';
import SheetTask from '../components/print-sheet/SheetTask';

// Чертёж печатается построенным под своё место на бумаге: фигура вписывается
// в место, а буквы — ровно той высоты, что формулы в условии.

const SPEC = [
  'параллелограмм ABCD 6 4 60',
  'K на AD 3:1',
  'отрезок BK',
  'угол ABK 60',
  'длина BK 6',
].join('\n');

const rootTag = (svg) => /<svg\b[^>]*>/.exec(svg)[0];
const attr = (tag, name) => new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];

/** Размер SVG на бумаге и его масштаб: единиц кадра на миллиметр. */
function paper(svg) {
  const tag = rootTag(svg);
  const [, , vbW, vbH] = attr(tag, 'viewBox').split(' ').map(Number);
  const wMm = parseFloat(attr(tag, 'width'));
  const hMm = parseFloat(attr(tag, 'height'));
  return { wMm, hMm, k: vbW / wMm, kH: vbH / hMm };
}

/** Высота буквы точки на бумаге, мм. */
const letterOnPaper = (svg) => {
  const size = Number(/font-family="KaTeX_Math[^"]*" font-style="italic" font-size="([\d.]+)"/.exec(svg)[1]);
  return size / paper(svg).k;
};

describe('planimPrintFrame — чертёж под место на бумаге', () => {
  const { scene } = parsePlanimBlock(SPEC);

  it.each([
    [40, 35, 4.0],
    [87, 35, 4.0],
    [127, 55, 4.0],
    [60, 25, 4.6],
  ])('место %s×%s мм, буква %s мм', (widthMm, heightMm, letterMm) => {
    const { svg } = planimPrintFrame(scene, { widthMm, heightMm, letterMm });
    const p = paper(svg);
    // размер — в миллиметрах, без растяжения по контейнеру
    expect(attr(rootTag(svg), 'width')).toMatch(/mm$/);
    expect(rootTag(svg)).toMatch(/style="width:[\d.]+mm;max-width:100%/);
    expect(p.k).toBeCloseTo(p.kH, 1);
    // влезает в место
    expect(p.wMm).toBeLessThanOrEqual(widthMm + 0.5);
    expect(p.hMm).toBeLessThanOrEqual(heightMm + 0.5);
    // буква — как в условии, при любом размере места
    expect(letterOnPaper(svg)).toBeCloseTo(letterMm, 2);
  });

  it('больше место — больше фигура, а буквы те же', () => {
    const small = planimPrintFrame(scene, { widthMm: 40, heightMm: 35, letterMm: 4 });
    const big = planimPrintFrame(scene, { widthMm: 127, heightMm: 85, letterMm: 4 });
    expect(big.widthMm).toBeGreaterThan(small.widthMm * 1.8);
    expect(letterOnPaper(big.svg)).toBeCloseTo(letterOnPaper(small.svg), 1);
  });

  it('подписи пометок — того же кегля, что буквы; шрифты KaTeX', () => {
    const svg = planimPrintSvgFromSpec(SPEC, { widthMm: 87, heightMm: 35, letterMm: 4 });
    expect(svg).toMatch(/font-family="KaTeX_Main[^"]*" font-size="17"[^>]*>6</);
    expect(svg).toMatch(/font-family="KaTeX_Main[^"]*" font-size="17"[^>]*>60°</);
    expect(svg).toMatch(/font-family="KaTeX_Math, 'Times New Roman', Times, serif" font-style="italic"/);
  });
});

describe('figureBoxMm / psLetterMm — место по шкале S/M/L/XL', () => {
  it('ширина — доля полосы условия, высота — потолок', () => {
    expect(figureBoxMm('m', 100)).toEqual({ widthMm: 48, heightMm: 35 });
    expect(figureBoxMm('xl', 100)).toEqual({ widthMm: 100, heightMm: 85 });
    expect(figureBoxMm('m', 100, { side: true })).toEqual({ widthMm: 40, heightMm: 35 });
    expect(figureBoxMm('нет', 100)).toEqual({ widthMm: 48, heightMm: 35 });
  });

  it('буква = кегль условия × KaTeX', () => {
    expect(psLetterMm(1)).toBeCloseTo(3.9 * 1.04, 5);
    expect(psLetterMm(1.2)).toBeCloseTo(3.9 * 1.2 * 1.04, 5);
  });
});

describe('геометрия в листе: наш чертёж — блоком ```planim', () => {
  const { scene } = parsePlanimBlock(SPEC);
  const planimTask = {
    id: 'g1', statement_md: 'Найдите периметр $BCDK$.', answer: 20,
    drawing_view: 'svg', drawing_svg: planimDrawingSvg(scene),
  };

  it('исходник уходит в условие, картинки нет', () => {
    const t = geometrySheetTask(planimTask, () => 'file.png');
    expect(t.figureUrl).toBe('');
    expect(t.has_image).toBe(false);
    expect(t.statement_md.startsWith('Найдите периметр $BCDK$.\n\n```planim\n')).toBe(true);
    expect(t.statement_md).toMatch(/многоугольник ABCD\nK на AD 3:1/);
    expect(t.statement_md.trimEnd().endsWith('```')).toBe(true);
  });

  it('чужой SVG (GeoGebra) по-прежнему картинкой', () => {
    const t = geometrySheetTask({
      id: 'g2', statement_md: 'x', drawing_view: 'svg',
      drawing_svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0L9 9"/></svg>',
    }, () => '');
    expect(t.figureUrl.startsWith('data:image/svg+xml')).toBe(true);
    expect(t.statement_md).toBe('x');
  });

  const wrapper = ({ children }) => <App>{children}</App>;
  const renderTask = (options) => render(
    <SheetTask task={geometrySheetTask(planimTask, () => '')} number={1} taskIndex={0} options={options} contentWidthMm={182} />,
    { wrapper },
  );

  it('под условием: чертёж под полосу --ps-fig-w, буквы как в условии', () => {
    const { container } = renderTask({ figureSize: 'm', fontScale: 1 });
    const fig = container.querySelector('.drawing-print');
    expect(fig).not.toBeNull();
    const svg = fig.innerHTML;
    // полоса условия = 182 − 10 (номер) → 48 %
    expect(paper(svg).wMm).toBeLessThanOrEqual((172 * 0.48) + 0.5);
    expect(letterOnPaper(svg)).toBeCloseTo(psLetterMm(1), 2);
  });

  it('сбоку: колонка ужимается по чертежу, кегль листа меняет буквы', () => {
    const { container } = renderTask({ figurePlacement: 'left', figureSize: 'l', fontScale: 1.2 });
    const aside = container.querySelector('.ps-task-aside');
    expect(aside.className).toMatch(/ps-task-aside--fit/);
    const svg = aside.querySelector('.drawing-print').innerHTML;
    expect(paper(svg).wMm).toBeLessThanOrEqual((172 * 0.5) + 0.5);
    expect(letterOnPaper(svg)).toBeCloseTo(psLetterMm(1.2), 2);
  });
});

describe('stereoPrintFrame — стереочертёж под место на бумаге', () => {
  const { scene, camera } = parseStereoBlock('куб 4\nM на AA1 1:2\nсечение MBD');

  it.each([
    [40, 35, 3.2],
    [87, 35, 4.0],
    [60, 85, 4.0],
    [127, 55, 3.6],
  ])('место %s×%s мм, буква %s мм', (widthMm, heightMm, letterMm) => {
    const { svg } = stereoPrintFrame(scene, camera, { widthMm, heightMm, letterMm });
    const p = paper(svg);
    expect(p.wMm).toBeLessThanOrEqual(widthMm + 0.5);
    expect(p.hMm).toBeLessThanOrEqual(heightMm + 0.5);
    expect(letterOnPaper(svg)).toBeCloseTo(letterMm, 2);
    // тело занимает место: хотя бы по одной стороне — почти целиком
    expect(Math.max(p.wMm / widthMm, p.hMm / heightMm)).toBeGreaterThan(0.9);
  });

  it('больше место — больше тело, буквы те же', () => {
    const small = stereoPrintFrame(scene, camera, { widthMm: 40, heightMm: 35, letterMm: 4 });
    const big = stereoPrintFrame(scene, camera, { widthMm: 120, heightMm: 100, letterMm: 4 });
    expect(big.widthMm).toBeGreaterThan(small.widthMm * 2);
    expect(letterOnPaper(big.svg)).toBeCloseTo(letterOnPaper(small.svg), 1);
  });

  it('геометрия в листе: стереочертёж — блоком ```stereo', () => {
    const t = geometrySheetTask({
      id: 's1', statement_md: 'Постройте сечение.', drawing_view: 'svg', drawing_svg: stereoDrawingSvg(scene, camera),
    }, () => 'file.png');
    expect(t.figureUrl).toBe('');
    expect(t.statement_md).toMatch(/```stereo\nкуб 4/);
  });

  it('лист задач: ```stereo строится под место, буквы как в условии', () => {
    const task = geometrySheetTask({
      id: 's2', statement_md: 'Постройте сечение.', drawing_view: 'svg', drawing_svg: stereoDrawingSvg(scene, camera),
    }, () => '');
    const { container } = render(
      <SheetTask task={task} number={1} taskIndex={0} options={{ figureSize: 'm', fontScale: 1 }} contentWidthMm={182} />,
      { wrapper: ({ children }) => <App>{children}</App> },
    );
    const svg = container.querySelector('.drawing-print').innerHTML;
    expect(letterOnPaper(svg)).toBeCloseTo(psLetterMm(1), 2);
  });
});

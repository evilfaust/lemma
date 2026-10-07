import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import KimTaskContent, { hasBuiltDrawing, kimDrawingPlace } from '../components/worksheet/KimTaskContent';
import VariantRenderer from '../components/worksheet/VariantRenderer';
import { KIM_LETTER_MM, KIM_TEXT_WIDTH_MM } from '../utils/kimImageSize';

// КИМ-буклет (база, профиль, ОГЭ): чертёж наших редакторов строится под место
// S/M/L/XL в миллиметрах, буквы — как формулы условия КИМ, а единственный
// чертёж встаёт справа и обтекается текстом, как картинка задачи.

const PLANIM = '```planim\nтреугольник ABC 5 6 7\nH = высота B AC\n```';
const STEREO = '```stereo\nкуб 4\nM на AA1 1:2\n```';

const rootTag = (svg) => /<svg\b[^>]*>/.exec(svg)[0];
const attr = (tag, name) => new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];
const paperWidthMm = (el) => parseFloat(attr(rootTag(el.innerHTML), 'width'));

/** Высота буквы точки на бумаге, мм. */
function letterOnPaper(svg) {
  const tag = rootTag(svg);
  const vbW = Number(attr(tag, 'viewBox').split(' ')[2]);
  const k = vbW / parseFloat(attr(tag, 'width'));
  const size = Number(/font-family="KaTeX_Math[^"]*" font-style="italic" font-size="([\d.]+)"/.exec(svg)[1]);
  return size / k;
}

describe('KimTaskContent — чертёж редактора в КИМ', () => {
  it('буква КИМ = 12,5 px × 0,97 KaTeX, полоса условия — 128,5 мм', () => {
    expect(KIM_LETTER_MM).toBeCloseTo(3.208, 2);
    expect(KIM_TEXT_WIDTH_MM).toBe(128.5);
    expect(kimDrawingPlace('m').widthMm).toBeCloseTo(128.5 * 0.48, 5);
    expect(kimDrawingPlace('m').heightMm).toBe(35);
  });

  it('```planim: строится под место, встаёт справа, текст обтекает', () => {
    const { container } = render(
      <KimTaskContent task={{ id: 't1', statement_md: `Найдите BH.\n\n${PLANIM}` }} />,
    );
    const aside = container.querySelector('.kim-book-task-drawing');
    expect(aside).not.toBeNull();
    // чертёж — первым, перед текстом: float обтекает только то, что после него
    expect(container.querySelector('.kim-book-task-content').firstElementChild).toBe(aside);
    const fig = aside.querySelector('.drawing-print');
    expect(fig).not.toBeNull();
    expect(paperWidthMm(fig)).toBeLessThanOrEqual(kimDrawingPlace('m').widthMm + 0.5);
    expect(letterOnPaper(fig.innerHTML)).toBeCloseTo(KIM_LETTER_MM, 2);
    // текст остался, а исходник блока в него не попал
    expect(container.textContent).toContain('Найдите BH.');
    expect(container.textContent).not.toContain('треугольник');
  });

  it('```stereo: тоже под место, размер S/M/L/XL меняет фигуру, а не буквы', () => {
    const renderSize = (size) => render(
      <KimTaskContent task={{ id: 't2', statement_md: `Постройте сечение.\n\n${STEREO}`, kimImageSize: size }} />,
    ).container.querySelector('.kim-book-task-drawing .drawing-print');
    const s = renderSize('s');
    const l = renderSize('l');
    expect(paperWidthMm(l)).toBeGreaterThan(paperWidthMm(s));
    expect(letterOnPaper(s.innerHTML)).toBeCloseTo(KIM_LETTER_MM, 2);
    expect(letterOnPaper(l.innerHTML)).toBeCloseTo(KIM_LETTER_MM, 2);
  });

  it('XL — во всю ширину, на своём месте в тексте', () => {
    const { container } = render(
      <KimTaskContent task={{ id: 't3', statement_md: `Найдите BH.\n\n${PLANIM}`, kimImageSize: 'xl' }} />,
    );
    expect(container.querySelector('.kim-book-task-drawing')).toBeNull();
    const fig = container.querySelector('.drawing-print');
    expect(paperWidthMm(fig)).toBeGreaterThan(kimDrawingPlace('l').widthMm);
  });

  it('два чертежа — оба в тексте, оба под место', () => {
    const { container } = render(
      <KimTaskContent task={{ id: 't4', statement_md: `${PLANIM}\n\nи\n\n${STEREO}` }} />,
    );
    expect(container.querySelector('.kim-book-task-drawing')).toBeNull();
    expect(container.querySelectorAll('.drawing-print')).toHaveLength(2);
  });

  it('задача без чертежей печатается как раньше', () => {
    const { container } = render(
      <KimTaskContent task={{ id: 't5', statement_md: 'Вычислите $2+2$.' }} />,
    );
    expect(container.querySelector('.kim-book-task-drawing')).toBeNull();
    expect(container.querySelector('.katex')).not.toBeNull();
  });

  it('hasBuiltDrawing — только блоки planim/stereo', () => {
    expect(hasBuiltDrawing({ statement_md: PLANIM })).toBe(true);
    expect(hasBuiltDrawing({ statement_md: STEREO })).toBe(true);
    expect(hasBuiltDrawing({ statement_md: '```plot\nf x^2\n```' })).toBe(false);
    expect(hasBuiltDrawing({ statement_md: '' })).toBe(false);
  });
});

describe('VariantRenderer в режиме КИМ — размер чертежа редактора', () => {
  const variant = (size) => ({
    number: 1,
    tasks: [{ id: 'v1', code: '1-001', statement_md: `Найдите BH.\n\n${PLANIM}`, kimImageSize: size }],
  });

  it('переключатель S/M/L/XL есть и у задачи с чертежом, чертёж — в размере печати', () => {
    const { container } = render(
      <VariantRenderer variant={variant('s')} variantIndex={0} solutionSpace="none" onSetImageSize={() => {}} />,
    );
    expect(container.querySelector('.ant-segmented')).not.toBeNull();
    const fig = container.querySelector('.drawing-print');
    expect(paperWidthMm(fig)).toBeLessThanOrEqual(kimDrawingPlace('s').widthMm + 0.5);
  });

  it('вне КИМ — прежний экранный чертёж', () => {
    const { container } = render(<VariantRenderer variant={variant('s')} variantIndex={0} solutionSpace="none" />);
    expect(container.querySelector('.ant-segmented')).toBeNull();
    expect(container.querySelector('.drawing-print')).toBeNull();
    expect(container.querySelector('.planim-figure-svg')).not.toBeNull();
  });
});

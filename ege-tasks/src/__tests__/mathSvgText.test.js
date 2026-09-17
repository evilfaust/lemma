import { describe, it, expect } from 'vitest';
import { mathSvgText, measureMathSvg, mathLineMetrics } from '../utils/mathSvgText';

// Разметку разбираем регулярками: верстальщик отдаёт строку SVG-примитивов,
// как её увидит DOMPurify и принтер.
const texts = (svg) => [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);
const attr = (tag, name) => {
  const m = new RegExp(`${name}="([^"]*)"`).exec(tag);
  return m ? m[1] : null;
};
const tags = (svg) => [...svg.matchAll(/<text[^>]*>[^<]*<\/text>/g)].map((m) => m[0]);

describe('mathSvgText', () => {
  it('пустая подпись ничего не рисует', () => {
    expect(mathSvgText('', {})).toBe('');
    expect(mathSvgText(null, {})).toBe('');
  });

  it('латинские буквы — курсивом математическим шрифтом, цифры — прямым', () => {
    const svg = mathSvgText('A2', { size: 12 });
    const [letter, digit] = tags(svg);
    expect(attr(letter, 'font-style')).toBe('italic');
    expect(attr(letter, 'font-family')).toContain('KaTeX_Math');
    expect(attr(digit, 'font-style')).toBe(null);
    expect(attr(digit, 'font-family')).toContain('KaTeX_Main');
  });

  it('кириллица идёт шрифтом документа, без курсива', () => {
    const svg = mathSvgText('Точка', { size: 12 });
    expect(texts(svg)).toEqual(['Точка']);
    expect(attr(tags(svg)[0], 'font-family')).toBe(null);
    expect(attr(tags(svg)[0], 'font-style')).toBe(null);
  });

  it('соседние буквы одного начертания склеиваются в один <text>', () => {
    expect(texts(mathSvgText('abc', { size: 12 }))).toEqual(['abc']);
  });

  it('индекс — мельче и ниже базовой линии, степень — выше', () => {
    const sub = tags(mathSvgText('x_1', { size: 12 }));
    expect(texts(mathSvgText('x_1', { size: 12 }))).toEqual(['x', '1']);
    expect(Number(attr(sub[1], 'font-size'))).toBeLessThan(12);
    expect(Number(attr(sub[1], 'y'))).toBeGreaterThan(0);

    const sup = tags(mathSvgText('y^2', { size: 12 }));
    expect(Number(attr(sup[1], 'y'))).toBeLessThan(0);
  });

  it('фигурные скобки группируют индекс целиком', () => {
    expect(texts(mathSvgText('A_{max}', { size: 12 }))).toEqual(['A', 'max']);
    expect(texts(mathSvgText('A_max', { size: 12 }))).toEqual(['A', 'm', 'ax']);
  });

  it('штрих превращается в верхний prime', () => {
    const svg = mathSvgText("f'(x)", { size: 12 });
    expect(texts(svg)).toContain('′');
  });

  it('дробь: два этажа и черта между ними', () => {
    const svg = mathSvgText('\\frac{\\pi}{2}', { size: 12 });
    expect(texts(svg)).toEqual(['π', '2']);
    expect(svg).toContain('<line');
    const [num, den] = tags(svg);
    expect(Number(attr(num, 'y'))).toBeLessThan(Number(attr(den, 'y')));

    const line = mathLineMetrics(12);
    const m = measureMathSvg('\\frac{\\pi}{2}', { size: 12 });
    expect(m.ascent).toBeGreaterThan(line.ascent);
    expect(m.descent).toBeGreaterThan(line.descent);
  });

  it('корень рисуется путём, а не глифом (печатается вектором)', () => {
    const svg = mathSvgText('\\sqrt{2}', { size: 12 });
    expect(svg).toContain('<path');
    expect(texts(svg)).toEqual(['2']);
    expect(svg).not.toContain('√');
  });

  it('греческие буквы и знаки', () => {
    expect(texts(mathSvgText('\\alpha', {}))).toEqual(['α']);
    expect(texts(mathSvgText('x \\le 2', {}))).toEqual(['x', '≤', '2']);
    expect(texts(mathSvgText('\\varphi \\to \\infty', {}))).toEqual(['φ', '→', '∞']);
  });

  it('минус набирается знаком минуса, а не дефисом', () => {
    expect(texts(mathSvgText('-2', {}))).toEqual(['−2']);
  });

  it('\\text{…} и имена функций — прямым шрифтом', () => {
    expect(attr(tags(mathSvgText('\\text{max}', {}))[0], 'font-style')).toBe(null);
    expect(attr(tags(mathSvgText('\\sin x', {}))[0], 'font-style')).toBe(null);
  });

  it('\\vec рисует стрелку над содержимым', () => {
    const svg = mathSvgText('\\vec{a}', {});
    expect(texts(svg)).toEqual(['a']);
    expect(svg).toContain('<line');
    expect(svg).toContain('<path'); // остриё стрелки
  });

  it('жирный вариант помечает все фрагменты', () => {
    const svg = mathSvgText('x_1', { bold: true });
    tags(svg).forEach((t) => expect(attr(t, 'font-weight')).toBe('bold'));
  });

  it('экранирует разметку в подписи', () => {
    const svg = mathSvgText('<b>&', {});
    expect(svg).not.toContain('<b>');
    expect(svg).toContain('&lt;');
    expect(svg).toContain('&amp;');
  });

  it('незнакомая команда печатается именем, а не рушит подпись', () => {
    const svg = mathSvgText('\\unknowncmd x', {});
    expect(texts(svg)).toEqual(['unknowncmd', 'x']);
  });

  it('anchor двигает подпись целиком', () => {
    const w = measureMathSvg('AB', { size: 12 }).width;
    const x = (anchor) => Number(attr(tags(mathSvgText('AB', { x: 100, size: 12, anchor }))[0], 'x'));
    expect(x('start')).toBe(100);
    expect(x('middle')).toBeCloseTo(100 - w / 2, 1);
    expect(x('end')).toBeCloseTo(100 - w, 1);
  });

  it('измерение: ширина растёт с текстом, пустая строка всё равно строка', () => {
    expect(measureMathSvg('xx', {}).width).toBeGreaterThan(measureMathSvg('x', {}).width);
    expect(measureMathSvg('', {}).ascent).toBe(mathLineMetrics(12).ascent);
  });

  it('доллары вокруг формулы игнорируются', () => {
    expect(texts(mathSvgText('$x_1$', {}))).toEqual(['x', '1']);
  });
});

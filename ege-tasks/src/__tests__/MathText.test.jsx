import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import MathText from '../components/shared/MathText';

const r = (text) => render(<MathText text={text} />).container;

describe('MathText', () => {
  it('пустая строка ничего не рисует', () => {
    expect(r('').firstChild).toBeNull();
    expect(r(null).firstChild).toBeNull();
    expect(r(undefined).firstChild).toBeNull();
  });

  it('текст без формул проходит насквозь', () => {
    const c = r('Неполное: ax² + bx = 0');
    expect(c.textContent).toBe('Неполное: ax² + bx = 0');
    expect(c.querySelector('.katex')).toBeNull();
  });

  it('формула в $…$ рендерится KaTeX, слова остаются словами', () => {
    const c = r('Неполное: $ax^2 + bx = 0$');
    expect(c.querySelectorAll('.katex')).toHaveLength(1);
    expect(c.textContent).toContain('Неполное:');
  });

  it('несколько формул в одной строке', () => {
    const c = r('от $a$ до $b$');
    expect(c.querySelectorAll('.katex')).toHaveLength(2);
  });

  it('$$…$$ в подписи остаётся инлайном, а не отдельной строкой по центру', () => {
    const c = r('Тип: $$x^2=9$$');
    expect(c.querySelectorAll('.katex')).toHaveLength(1);
    expect(c.querySelector('.katex-display')).toBeNull();
  });

  it('🚨 наружу идут только инлайновые узлы — иначе ломается строка вёрстки', () => {
    const c = r('Тип: $x^2$ и текст');
    expect(c.querySelector('p')).toBeNull();
    expect(c.querySelector('div')).toBeNull();
    expect(c.firstChild.tagName).toBe('SPAN');
  });

  it('одинокий доллар — это текст, а не начало формулы', () => {
    expect(r('цена $5 за штуку').textContent).toBe('цена $5 за штуку');
  });

  it('битая формула показывается исходником, а не пустотой', () => {
    const c = r('$\\frac{$');
    expect(c.textContent.length).toBeGreaterThan(0);
  });

  it('className пробрасывается на корень', () => {
    const c = render(<MathText text="x" className="cls-type-label" />).container;
    expect(c.firstChild.className).toBe('cls-type-label');
  });

  it('запятая после формулы не уходит на новую строку — приклеена к формуле', () => {
    const c = r('график $y = f(x)$, определённой на $(-5; 5)$. Найдите');
    const glue = [...c.querySelectorAll('span')].filter((sp) => sp.style.whiteSpace === 'nowrap');
    expect(glue).toHaveLength(2);
    expect(glue[0].querySelector('.katex')).toBeTruthy();
    expect(glue[0].textContent.endsWith(',')).toBe(true);
    expect(glue[1].textContent.endsWith('.')).toBe(true);
    // текст после знака никуда не делся
    expect(c.textContent).toContain(', определённой на ');
    expect(c.textContent).toContain('. Найдите');
  });

  it('тире за формулой держится на её строке неразрывным пробелом', () => {
    const c = r("график $y = f'(x)$ — производной");
    const glue = [...c.querySelectorAll('span')].find((sp) => sp.style.whiteSpace === 'nowrap');
    expect(glue.textContent.endsWith('\u00A0—')).toBe(true);
    expect(c.textContent).toContain('— производной');
  });
});

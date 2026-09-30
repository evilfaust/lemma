import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import MathRenderer from '../shared/components/MathRenderer';
import { splitSideFigure } from '../components/print-sheet/sideFigure';
import { imageSnippetAt, imageSizeToken } from '../utils/imageSnippet';

const URL = 'https://files.l.oipav.ru/api/files/materials/abc/pic.png';
const draw = (md) => render(<MathRenderer text={md} />).container;

describe('размер картинки {S|M|L|XL} в условии', () => {
  it('токен → классы на <img>, из текста уходит', () => {
    const c = draw(`Найдите угол.\n![рис](${URL}){M}\nОтвет дайте в градусах.`);
    const img = c.querySelector('img');
    expect(img.className).toBe('mr-img mr-img--m');
    expect(c.textContent).not.toContain('{M}');
    expect(c.textContent).toContain('Ответ дайте в градусах.');
  });

  it('регистр и пробел перед токеном не мешают', () => {
    expect(draw(`![a](${URL}) {xl}`).querySelector('img').className).toBe('mr-img mr-img--xl');
  });

  it('без токена картинка как была', () => {
    const img = draw(`![a](${URL})`).querySelector('img');
    expect(img.getAttribute('class')).toBeNull();
  });

  it('в ячейке таблицы', () => {
    const c = draw(`| Рисунок | Ответ |\n| --- | --- |\n| ![a](${URL}){S} | 5 |`);
    const img = c.querySelector('td img');
    expect(img.className).toBe('mr-img mr-img--s');
    expect(c.querySelector('td').textContent.trim()).toBe('');
    expect(c.querySelectorAll('td')).toHaveLength(2);
  });

  it('чужие фигурные скобки не трогаем', () => {
    const c = draw(`![a](${URL}){Q} и {M}`);
    expect(c.querySelector('img').getAttribute('class')).toBeNull();
    expect(c.textContent).toContain('{Q} и {M}');
  });

  it('CSS: все четыре размера и перебивка чужих ограничений', () => {
    const css = readFileSync(resolve(__dirname, '../shared/components/imageSize.css'), 'utf8');
    ['s', 'm', 'l', 'xl'].forEach((k) => expect(css).toContain(`.mr-img.mr-img.mr-img--${k}`));
    expect(css).toMatch(/max-height:\s*none/);
  });
});

describe('вставка и печать сбоку', () => {
  it('сниппет несёт токен размера', () => {
    expect(imageSnippetAt('', 0, { url: URL, alt: 'рис', size: 'L' })).toBe(`![рис](${URL}){L}`);
    expect(imageSizeToken('')).toBe('');
    expect(imageSizeToken('xl')).toBe('{XL}');
    expect(imageSizeToken('Q')).toBe('');
  });

  it('сбоку картинка уходит без токена и не оставляет его в тексте', () => {
    const { figure, text } = splitSideFigure(`Найдите x.\n![рис](${URL}){M}`);
    expect(figure).toEqual({ kind: 'image', md: `![рис](${URL})` });
    expect(text).toBe('Найдите x.');
  });

  it('хвост строки после токена остаётся текстом', () => {
    const { figure, text } = splitSideFigure(`![рис](${URL}) {S}На рисунке — лабиринт.`);
    expect(figure.md).toBe(`![рис](${URL})`);
    expect(text).toBe('На рисунке — лабиринт.');
  });
});

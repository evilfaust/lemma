import { describe, it, expect } from 'vitest';
import {
  imageSnippetAt, isTableRowAt, mdImageAlt, mdImageUrl, imageFilesFrom,
} from '../utils/imageSnippet';
import { insertAtCaret } from '../utils/caretInsert';

const URL = 'https://files.l.oipav.ru/api/files/materials/abc/pic_1.png';
const put = (text, pos, img = { url: URL, alt: 'рис' }) =>
  insertAtCaret(text, { start: pos, end: pos }, imageSnippetAt(text, pos, img)).text;

describe('картинка в markdown-поле', () => {
  it('в тексте — отдельной строкой, лишних переводов строк нет', () => {
    expect(put('', 0)).toBe(`![рис](${URL})`);
    expect(put('Найдите x.', 10)).toBe(`Найдите x.\n![рис](${URL})`);
    expect(put('Найдите x.\n', 11)).toBe(`Найдите x.\n![рис](${URL})`);
    expect(put('Дано.\nНайдите.', 6)).toBe(`Дано.\n![рис](${URL})\nНайдите.`);
    expect(put('Дано. Найдите.', 6)).toBe(`Дано. \n![рис](${URL})\nНайдите.`);
  });

  it('в строке таблицы — прямо в ячейку, таблица цела', () => {
    const table = '| Рисунок | Ответ |\n| --- | --- |\n|  | 5 |';
    const pos = table.lastIndexOf('|  |') + 2;
    const out = put(table, pos);
    expect(out.split('\n')).toHaveLength(3);
    expect(out.split('\n')[2]).toBe(`| ![рис](${URL}) | 5 |`);
  });

  it('isTableRowAt смотрит на строку под курсором', () => {
    const text = 'Текст\n| a | b |';
    expect(isTableRowAt(text, 2)).toBe(false);
    expect(isTableRowAt(text, text.length)).toBe(true);
    expect(isTableRowAt(text, 6)).toBe(true);
    expect(isTableRowAt(text, -1)).toBe(false);
  });

  it('без курсора — блоком в конец', () => {
    expect(imageSnippetAt('abc', undefined, { url: URL })).toBe(`\n![рисунок](${URL})\n`);
  });

  it('подпись не ломает разметку ячейки', () => {
    expect(mdImageAlt('a|b [c]\nd')).toBe('a b c d');
    expect(mdImageAlt('')).toBe('рисунок');
    expect(mdImageAlt('x'.repeat(100))).toHaveLength(60);
  });

  it('скобки и пробелы в ссылке экранируются', () => {
    expect(mdImageUrl('https://x/a (1).png')).toBe('https://x/a%20%281%29.png');
  });
});

describe('картинки из буфера / перетаскивания', () => {
  const png = { name: 'image.png', type: 'image/png' };
  const pdf = { name: 'a.pdf', type: 'application/pdf' };
  const dt = (files, text = '') => ({
    files,
    types: text ? ['text/plain', 'Files'] : ['Files'],
    getData: (t) => (t === 'text/plain' ? text : ''),
  });

  it('скриншот — берём', () => {
    expect(imageFilesFrom(dt([png]))).toEqual([png]);
  });
  it('не картинки отсеиваются', () => {
    expect(imageFilesFrom(dt([pdf]))).toEqual([]);
    expect(imageFilesFrom(dt([pdf, png]))).toEqual([png]);
  });
  it('есть текст (копия из Word/Excel) — вставляем текст, а не снимок', () => {
    expect(imageFilesFrom(dt([png], 'x^2 + 1'))).toEqual([]);
  });
  it('пусто и null', () => {
    expect(imageFilesFrom(null)).toEqual([]);
    expect(imageFilesFrom(dt([]))).toEqual([]);
  });
});

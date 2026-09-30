import { describe, it, expect } from 'vitest';
import {
  imageSnippetAt, isTableRowAt, mdImageAlt, mdImageUrl, imageFilesFrom,
  imagesSnippetAt, normalizeBatch, batchLabel,
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

describe('пакетная вставка', () => {
  const ims = [1, 2, 3, 4, 5].map((i) => ({ url: `https://x/${i}.png`, title: `р${i}` }));
  const at = (text, pos, list, opts) =>
    insertAtCaret(text, { start: pos, end: pos }, imagesSnippetAt(text, pos, list, opts)).text;

  it('одна картинка — как обычная вставка', () => {
    expect(imagesSnippetAt('', 0, ims.slice(0, 1), { layout: 'row', labels: 'num', size: 'M' }))
      .toBe('![р1](https://x/1.png){M}');
    expect(imagesSnippetAt('', 0, [], {})).toBe('');
  });

  it('друг под другом — каждая своим абзацем, с размером', () => {
    expect(at('Текст.', 6, ims.slice(0, 2), { size: 'S' })).toBe(
      'Текст.\n\n![р1](https://x/1.png){S}\n\n![р2](https://x/2.png){S}',
    );
  });

  it('в ряд — галерея: разделитель после первого ряда, хвост добит пустыми', () => {
    const out = imagesSnippetAt('', 0, ims, { layout: 'row', perRow: 3, labels: 'num', size: 'M' });
    expect(out.split('\n')).toEqual([
      '{галерея}',
      '| 1) ![р1](https://x/1.png) | 2) ![р2](https://x/2.png) | 3) ![р3](https://x/3.png) |',
      '| --- | --- | --- |',
      '| 4) ![р4](https://x/4.png) | 5) ![р5](https://x/5.png) |   |',
    ]);
    expect(out).not.toContain('{M}'); // в ряду размер задаёт ячейка
  });

  it('картинок меньше, чем мест в ряду — колонок столько, сколько картинок', () => {
    const out = imagesSnippetAt('', 0, ims.slice(0, 2), { layout: 'row', perRow: 4 });
    expect(out.split('\n').slice(1)).toEqual([
      '| ![р1](https://x/1.png) | ![р2](https://x/2.png) |',
      '| --- | --- |',
    ]);
  });

  it('галерея отделяется от текста пустыми строками', () => {
    const out = at('До.После.', 3, ims.slice(0, 2), { layout: 'row', perRow: 2 });
    expect(out.startsWith('До.\n\n{галерея}\n')).toBe(true);
    expect(out.endsWith('| --- | --- |\n\nПосле.')).toBe(true);
    // уже есть пустые строки — лишних не добавляем
    expect(at('До.\n\n\n\nПосле.', 5, ims.slice(0, 2), { layout: 'row', perRow: 2 }))
      .toMatch(/^До\.\n\n\{галерея\}[\s\S]*\| --- \| --- \|\n\nПосле\.$/);
  });

  it('курсор в строке таблицы — все в одну ячейку, раскладка не действует', () => {
    const table = '| Рисунки | Ответ |\n| --- | --- |\n|  | 5 |';
    const pos = table.lastIndexOf('|  |') + 2;
    const out = at(table, pos, ims.slice(0, 2), { layout: 'row', labels: 'ru' });
    expect(out.split('\n')[2]).toBe('| А) ![р1](https://x/1.png) Б) ![р2](https://x/2.png) | 5 |');
    expect(out.split('\n')).toHaveLength(3);
  });

  it('без курсора — блоком в конец', () => {
    expect(imagesSnippetAt('abc', undefined, ims.slice(0, 2), {}))
      .toBe('\n\n![р1](https://x/1.png)\n\n![р2](https://x/2.png)\n');
  });

  it('подписи и настройки', () => {
    expect(batchLabel(0, 'num')).toBe('1) ');
    expect(batchLabel(3, 'ru')).toBe('Г) ');
    expect(batchLabel(40, 'ru')).toBe('41) ');
    expect(batchLabel(0, '')).toBe('');
    expect(normalizeBatch(null)).toEqual({ layout: 'column', perRow: 4, labels: '' });
    expect(normalizeBatch({ layout: 'x', perRow: 99, labels: 'q' })).toEqual({ layout: 'column', perRow: 4, labels: '' });
    expect(normalizeBatch({ layout: 'row', perRow: '3', labels: 'ru' })).toEqual({ layout: 'row', perRow: 3, labels: 'ru' });
  });
});

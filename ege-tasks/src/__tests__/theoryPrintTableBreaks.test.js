// Сторожевой тест по CSS с диска (тот же приём, что у print-sheet и
// graphSheet.test.jsx): расчёт разрывов страниц можно легко сформулировать
// верно и всё равно не попасть в разметку, поэтому проверяем реальные файлы,
// а не поведение изолированной функции.
//
// Баг, который эти тесты ловят (v3.9.214): большая справочная таблица теории
// (10+ строк, в каждой чертёж) при печати форсированно держалась ЦЕЛИКОМ —
// правило `table { break-inside: avoid }` в паре с `break-after: avoid` на
// шапке листа сгоняло всю таблицу на вторую страницу, оставляя первую почти
// пустой (только надзаголовок), а саму таблицу такой большой браузер всё
// равно резал бы как попало, потому что «целиком» физически не влезает ни на
// одну страницу. Правильный рецепт для длинных таблиц — резать ПО СТРОКАМ
// (`tr { break-inside: avoid }`) и повторять шапку (`thead { display:
// table-header-group }`), а не запрещать разрыв таблице целиком.
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const read = (rel) => fs.readFileSync(path.resolve(__dirname, rel), 'utf8');

describe('печать теории — таблица режется по строкам, не целиком', () => {
  const files = [
    ['редактор статьи', '../components/theory/TheoryEditor.css', '.theory-preview-content'],
    ['просмотр статьи', '../components/theory/TheoryArticleView.css', '.theory-article-print-area'],
    ['конструктор конспекта', '../components/theory/TheoryPrintBuilder.css', '.theory-article-print-area'],
  ];

  it.each(files)('%s: нет блокирующего `table { break-inside: avoid }`', (_, rel) => {
    const css = read(rel);
    // Старое правило запрещало разрыв ЦЕЛОЙ таблице — именно оно и есть баг.
    // Ищем табличный селектор, за которым (до следующего `}`) нет никакого
    // другого свойства перед break-inside — то есть правило посвящено ровно
    // "table { break-inside/page-break-inside: avoid }" и ничему больше.
    const tableOnlyBreakRule = /\.theory-(?:preview-content|article-print-area)\s+table\s*\{\s*(?:page-)?break-inside:\s*avoid;\s*\}/;
    expect(css).not.toMatch(tableOnlyBreakRule);
  });

  it.each(files)('%s: строка таблицы неделима, шапка повторяется', (_, rel, sel) => {
    const css = read(rel);
    expect(css).toContain(`${sel} tr {`);
    expect(css).toMatch(/break-inside:\s*avoid/);
    expect(css).toContain(`${sel} thead {`);
    expect(css).toContain('display: table-header-group;');
  });
});

describe('печать теории — шапка темы «Лист» не рвётся между надзаголовком и названием', () => {
  it('.theory-sheet-head неделима', () => {
    const css = read('../components/theory/themeSheet.css');
    const m = /\.theory-preview-content\.theory-sheet \.theory-sheet-head\s*\{([^}]*)\}/.exec(css);
    expect(m).not.toBeNull();
    expect(m[1]).toMatch(/break-inside:\s*avoid/);
    expect(m[1]).toMatch(/page-break-inside:\s*avoid/);
  });
});

import { describe, it, expect } from 'vitest';
import { splitLeadingH1, sheetHeadHtml, withSheetHead } from '../utils/theorySheetHead';
import { printThemeClass, normalizePrintTheme, DEFAULT_SETTINGS } from '../utils/theoryThemes';

describe('theorySheetHead — шапка печатной темы «Лист»', () => {
  it('ведущий <h1> уезжает в название шапки и из текста пропадает', () => {
    const html = '<h1>Производная</h1><p>Определение…</p>';
    const out = withSheetHead(html, { enabled: true, eyebrow: 'Алгебра' });
    expect(out).toContain('theory-sheet-head__title">Производная<');
    expect(out).not.toContain('<h1>');
    expect(out).toContain('<p>Определение…</p>');
  });

  it('формулы в заголовке переживают переезд в шапку', () => {
    const html = '<h1>Функция <span class="katex">y = x^2</span></h1><p>текст</p>';
    const { titleHtml } = splitLeadingH1(html);
    expect(titleHtml).toContain('class="katex"');
  });

  it('в две колонки обёртка .col-section остаётся на месте', () => {
    const html = '<div class="col-section"><h1>Тема</h1><p>текст</p></div>';
    const { titleHtml, rest } = splitLeadingH1(html);
    expect(titleHtml).toBe('Тема');
    expect(rest.startsWith('<div class="col-section">')).toBe(true);
    expect(rest).not.toContain('<h1>');
  });

  it('нет ведущего <h1> — берётся название статьи', () => {
    const out = withSheetHead('<p>Сразу текст</p>', { enabled: true, title: 'Логарифмы' });
    expect(out).toContain('theory-sheet-head__title">Логарифмы<');
    expect(out).toContain('<p>Сразу текст</p>');
  });

  it('absorbH1: false оставляет заголовок в тексте', () => {
    const out = withSheetHead('<h1>Первая статья</h1>', {
      enabled: true, absorbH1: false, title: 'Конспект',
    });
    expect(out).toContain('theory-sheet-head__title">Конспект<');
    expect(out).toContain('<h1>Первая статья</h1>');
  });

  it('метастрока собирается через разделитель, пустые элементы отбрасываются', () => {
    const head = sheetHeadHtml({ title: 'Т', meta: ['10 класс', '', null, '18 сентября'] });
    expect(head).toContain('10 класс');
    expect(head).toContain('theory-sheet-head__sep');
    expect(head.match(/theory-sheet-head__sep/g)).toHaveLength(1);
  });

  it('текст из БД экранируется', () => {
    const head = sheetHeadHtml({ title: '<img src=x onerror=alert(1)>', eyebrow: 'A & B' });
    expect(head).not.toContain('<img');
    expect(head).toContain('&lt;img');
    expect(head).toContain('A &amp; B');
  });

  it('печатать нечего — шапки нет', () => {
    expect(sheetHeadHtml({})).toBe('');
  });

  it('тема «Классика» не трогает HTML', () => {
    const html = '<h1>Заголовок</h1><p>текст</p>';
    expect(withSheetHead(html, { enabled: false, title: 'X' })).toBe(html);
  });
});

describe('theoryThemes — реестр печатных тем', () => {
  it('по умолчанию — «Классика», старые статьи печатаются как печатались', () => {
    expect(DEFAULT_SETTINGS.printTheme).toBe('classic');
    expect(printThemeClass(DEFAULT_SETTINGS.printTheme)).toBe('theory-classic');
  });

  it('«Лист» даёт класс-модификатор печатного корня', () => {
    expect(printThemeClass('sheet')).toBe('theory-sheet');
  });

  it('мусор в настройках статьи откатывается на «Классику»', () => {
    expect(normalizePrintTheme('compact')).toBe('classic');
    expect(normalizePrintTheme(undefined)).toBe('classic');
  });
});

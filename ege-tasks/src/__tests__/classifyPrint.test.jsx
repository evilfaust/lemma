import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ClassifyPrintLayout from '../components/classify/ClassifyPrintLayout';
import {
  bucketsFromPreset, createItem, sheetStats, planSheet,
  DEFAULT_CLASSIFY_SETTINGS,
} from '../utils/classifySheet';

/**
 * Печать листа-классификатора проверяется по отрендеренной разметке, а не по
 * расчётам: раскладка может быть посчитана верно, а блок — не попасть в вёрстку
 * (так уже случалось — карманы первой страницы молча пропадали с листа).
 */

const settingsOf = extra => ({ ...DEFAULT_CLASSIFY_SETTINGS, ...extra });

function sheet(itemCount, bucketKeys = ['noC', 'noB', 'vieta', 'binomSquare', 'perfectSquare', 'full']) {
  const buckets = bucketsFromPreset(bucketKeys);
  const items = Array.from({ length: itemCount }, (_, i) => createItem({
    latex: 'x^2 - 5x = 0',
    answerLatex: '0;\;5',
    bucketId: buckets[i % buckets.length].id,
  }));
  return { buckets, items };
}

const count = (html, needle) => html.split(needle).length - 1;

function render(itemCount, extra = {}) {
  const { buckets, items } = sheet(itemCount);
  const settings = settingsOf(extra);
  const html = renderToStaticMarkup(
    <ClassifyPrintLayout title="Лист" buckets={buckets} items={items} settings={settings} />,
  );
  const stats = sheetStats(buckets, items, settings);
  return { html, stats, plan: planSheet(stats, settings, items) };
}

describe('печать листа-классификатора', () => {
  it('печатает каждый тип ровно один раз — включая те, что ушли на первую страницу', () => {
    [10, 14, 22, 40].forEach((n) => {
      const { html, stats, plan } = render(n);
      expect(count(html, 'cls-bucket-head'), `${n} уравнений`).toBe(stats.buckets.length);
      expect(plan.firstBuckets.length + plan.pages.flat().length).toBe(stats.buckets.length);
    });
  });

  it('под коротким банком карманы стоят на первой же странице', () => {
    const { html, plan } = render(14);
    expect(plan.firstBuckets.length).toBeGreaterThanOrEqual(2);

    const firstPage = html.split('<div class="cls-page')[1];
    expect(count(firstPage, 'cls-bucket-head')).toBe(plan.firstBuckets.length);
    expect(count(firstPage, 'cls-bank-num')).toBe(14);
  });

  it('печатает все уравнения банка и место для решения в клетку', () => {
    const { html } = render(14);
    expect(count(html, 'cls-bank-num')).toBe(14);
    expect(count(html, 'pfill-v')).toBeGreaterThan(0);   // вертикали клетки
    expect(count(html, 'cls-solve')).toBeGreaterThan(0);
  });

  it('режим «только типы»: одна страница с таблицей, без карманов', () => {
    const { html } = render(14, { mode: 'classify' });
    expect(count(html, '<table')).toBe(1);
    expect(count(html, 'cls-bucket-head')).toBe(0);
    expect(count(html, '<div class="cls-page')).toBe(1);
    expect(html).toContain('Решать уравнения не нужно');
  });

  it('в режиме «с решением» таблицы нет, а суммы уходят в заголовки типов', () => {
    const { html } = render(14);
    expect(count(html, '<table')).toBe(0);
    expect(count(html, 'cls-bucket-sum')).toBeGreaterThan(0);
  });

  it('ключ учителя печатается отдельной страницей по флажку', () => {
    const withKey = render(14, { showKey: true });
    const without = render(14);
    expect(count(withKey.html, 'cls-page--key')).toBe(1);
    expect(count(without.html, 'cls-page--key')).toBe(0);
    expect(withKey.html).toContain('Ключ учителя');
  });

  it('поле «Класс» в шапке снимается флажком', () => {
    // проверяем именно метку поля: слово «Класс» есть и в надзаголовке листа
    const label = 'cls-field-label">Класс<';
    expect(render(14).html).toContain(label);
    expect(render(14, { showClassField: false }).html).not.toContain(label);
  });
});

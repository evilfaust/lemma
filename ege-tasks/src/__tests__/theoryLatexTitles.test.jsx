import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderHook, waitFor } from '@testing-library/react';
import { useMarkdownProcessor } from '../hooks/useMarkdownProcessor';
import { headingTocEntry } from '../utils/headingToc';

const render = async (md) => {
  const { result } = renderHook(() => useMarkdownProcessor(md));
  await waitFor(() => expect(result.current).toContain('<'));
  return result.current;
};

const labelOf = (html) => {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.querySelector('.theory-callout__label');
};

describe('теория: LaTeX в заголовке блока', () => {
  it('$…$ в заголовке :::theorem — формула KaTeX, а не текст с долларами', async () => {
    const html = await render(':::theorem $n$ нечётное $(2k+1,\\ k \\in \\mathbb{N})$\n$$\\sqrt[2k+1]{f(x)} = a$$\n:::');
    const label = labelOf(html);
    expect(label).not.toBeNull();
    expect(label.textContent).not.toContain('$');
    expect(label.querySelectorAll('.katex')).toHaveLength(2);
    expect(label.textContent).toContain('нечётное');
    // Тело блока — внутри того же блока, после заголовка.
    expect(label.parentElement.querySelector(':scope > p .katex')).not.toBeNull();
  });

  it('без заголовка — подпись по типу блока', async () => {
    const label = labelOf(await render(':::example\n$x = 1$\n:::'));
    expect(label.textContent).toBe('Пример');
  });

  it('заголовок с «$1» и спецсимволами не ломает замену', async () => {
    const label = labelOf(await render(':::remark Цена $1 < 2$ и <b>\n:::'));
    expect(label.querySelector('.katex')).not.toBeNull();
    expect(label.querySelector('b')).toBeNull();
  });

  it('несколько блоков подряд — у каждого свой заголовок', async () => {
    const html = await render(':::theorem Первая $a$\nx\n:::\n\n:::theorem Вторая $b$\ny\n:::');
    const div = document.createElement('div');
    div.innerHTML = html;
    const labels = [...div.querySelectorAll('.theory-callout__label')].map((l) => l.textContent);
    expect(labels).toHaveLength(2);
    expect(labels[0]).toContain('Первая');
    expect(labels[1]).toContain('Вторая');
  });
});

describe('теория: оглавление с формулами', () => {
  it('текст пункта — исходный LaTeX, html — формула', async () => {
    const html = await render('## I. $\\sqrt[n]{f(x)} = g(x)$, $n \\ge 2$');
    const div = document.createElement('div');
    div.innerHTML = html;
    const entry = headingTocEntry(div.querySelector('h2'));
    expect(entry.text).toBe('I. $\\sqrt[n]{f(x)} = g(x)$, $n \\ge 2$');
    expect(entry.html).toContain('katex');
  });
});

describe('теория: заголовки и блоки без капслока', () => {
  // Капслок меняет смысл формулы (f(x) → F(X), const → CONST) и даёт ученику
  // две разные записи одного и того же. Сторож читает CSS с диска.
  const css = (f) => readFileSync(resolve(__dirname, '../components/theory', f), 'utf8');
  const rule = (text, selector) => {
    const i = text.indexOf(`${selector} {`);
    expect(i, selector).toBeGreaterThanOrEqual(0);
    return text.slice(i, text.indexOf('}', i));
  };

  it.each([
    ['themes.css', '.theory-preview-content h2'],
    ['themes.css', '.theory-preview-content h3'],
    ['themes.css', '.theory-preview-content th'],
    ['themes.css', '.theory-preview-content .theory-callout__label'],
    ['themeSheet.css', '.theory-preview-content.theory-sheet h2'],
    ['themeSheet.css', '.theory-preview-content.theory-sheet th'],
    ['themeSheet.css', '.theory-preview-content.theory-sheet .theory-callout__label'],
  ])('%s: %s — без uppercase', (file, selector) => {
    expect(rule(css(file), selector)).not.toMatch(/text-transform:\s*uppercase/);
  });

  it('формула в теории не наследует регистр и трекинг', () => {
    const r = rule(css('themes.css'), '.theory-preview-content .katex');
    expect(r).toMatch(/text-transform:\s*none/);
    expect(r).toMatch(/letter-spacing:\s*normal/);
  });
});

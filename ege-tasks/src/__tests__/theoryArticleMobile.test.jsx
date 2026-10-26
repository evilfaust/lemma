import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { App } from 'antd';

const ARTICLE = {
  id: 'a1',
  title: 'Неочевидная площадь трапеции',
  content_md: '# Неочевидная площадь трапеции\n\n## Теорема\n\nТекст.\n\n## Доказательство\n\nТекст.\n\n## Следствие\n\nТекст.',
  tags: [],
  updated: '2026-06-11T10:00:00Z',
  owner: 't1',
  theme_settings: { pageSettings: { pageSize: 'A4', orientation: 'portrait', columns: 2, fontSize: 12 } },
};

vi.mock('../services/pocketbase', () => ({
  api: {
    getTheoryArticle: vi.fn(async () => ARTICLE),
    getTags: vi.fn(async () => []),
    getTasks: vi.fn(async () => []),
  },
}));
vi.mock('../contexts/ReferenceDataContext', () => ({
  useReferenceData: () => ({ theoryCategories: [] }),
}));
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ teacher: { id: 't1', role: 'superadmin' } }),
}));
vi.mock('html2pdf.js', () => ({ default: () => ({}) }));

import TheoryArticleView from '../components/TheoryArticleView';

const setPhone = (phone) => {
  window.matchMedia = (query) => ({
    matches: phone && query.includes('max-width: 767'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
  });
};

const renderView = () => render(
  <App><TheoryArticleView articleId="a1" onBack={() => {}} onEdit={() => {}} /></App>,
);

describe('статья теории на телефоне — режим чтения', () => {
  const original = window.matchMedia;
  beforeEach(() => { if (!window.IntersectionObserver) window.IntersectionObserver = class { observe() {} disconnect() {} }; });
  afterEach(() => { window.matchMedia = original; });

  it('на телефоне — текст во всю ширину, без листа A4 и печатных кнопок', async () => {
    setPhone(true);
    const { container } = renderView();
    await screen.findByRole('heading', { level: 1, name: ARTICLE.title });
    const sheet = container.querySelector('.theory-article-print-area');
    expect(sheet.classList.contains('sta-content')).toBe(true);
    expect(sheet.getAttribute('style') || '').not.toContain('mm');
    expect(container.querySelector('.theory-article-view--read')).not.toBeNull();
    expect(container.querySelector('.theory-floating-actions')).toBeNull();
    expect(screen.queryByText('Классика')).toBeNull();
    // Одна колонка: разметка колонок (grid) не включается
    expect(sheet.style.display).not.toBe('grid');
    // Оглавление — сворачиваемым блоком
    await waitFor(() => expect(container.querySelector('.theory-article-toc-mobile')).not.toBeNull());
    expect(container.querySelectorAll('.theory-article-toc-mobile li').length).toBeGreaterThanOrEqual(3);
  });

  it('на компьютере — прежний лист A4', async () => {
    setPhone(false);
    const { container } = renderView();
    await screen.findByRole('heading', { level: 1, name: ARTICLE.title });
    const sheet = container.querySelector('.theory-article-print-area');
    expect(sheet.classList.contains('sta-content')).toBe(false);
    expect(sheet.style.width).toBe('210mm');
    expect(container.querySelector('.theory-floating-actions')).not.toBeNull();
    expect(container.querySelector('.theory-article-toc-mobile')).toBeNull();
  });
});

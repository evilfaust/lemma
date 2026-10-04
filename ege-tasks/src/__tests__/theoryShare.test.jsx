import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render, screen, fireEvent, waitFor, cleanup,
} from '@testing-library/react';
import { App as AntApp } from 'antd';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

// Статья теории по ссылке (v3.9.285): /t/<id> без входа, если статья открыта.

const mockApi = vi.hoisted(() => ({
  getPublicTheoryArticle: vi.fn(),
  setTheoryArticlePublic: vi.fn(),
}));
vi.mock('../shared/services/pocketbase', () => ({ api: mockApi, default: {} }));

const mockPb = vi.hoisted(() => {
  const col = { getOne: vi.fn(), update: vi.fn() };
  return { col, pb: { collection: vi.fn(() => col) }, _logAudit: vi.fn() };
});
vi.mock('../shared/services/pb/client.js', () => mockPb);

// eslint-disable-next-line import/first
import { articleLink, articleIdFromPath } from '../utils/theoryLink';
// eslint-disable-next-line import/first
import StudentTheoryArticle, { tocFromHtml } from '../components/theory/StudentTheoryArticle';
// eslint-disable-next-line import/first
import TheoryShareModal from '../components/theory/TheoryShareModal';
// eslint-disable-next-line import/first
import { theoryApi } from '../shared/services/pb/theory';

const AID = 'abcdefghijklmno';

afterEach(cleanup);
beforeEach(() => {
  Object.values(mockApi).forEach((f) => f.mockReset());
  mockPb.col.getOne.mockReset();
  mockPb.col.update.mockReset();
  mockPb._logAudit.mockReset();
});

describe('ссылка на статью', () => {
  it('articleLink — полная и короткая', () => {
    expect(articleLink(AID)).toEqual({
      full: `https://student.oipav.ru/t/${AID}`,
      short: `student.oipav.ru/t/${AID}`,
    });
    expect(articleLink(AID, 'http://localhost:5173/').full).toBe(`http://localhost:5173/t/${AID}`);
  });

  it('articleIdFromPath — /t/<id> и /student/t/<id>, остальное мимо', () => {
    expect(articleIdFromPath(`/t/${AID}`)).toBe(AID);
    expect(articleIdFromPath(`/student/t/${AID}/`)).toBe(AID);
    expect(articleIdFromPath(`/s/${AID}`)).toBeNull();
    expect(articleIdFromPath('/t/short')).toBeNull();
    expect(articleIdFromPath(`/t/${AID}/edit`)).toBeNull();
    expect(articleIdFromPath('')).toBeNull();
  });
});

describe('api: статья по ссылке', () => {
  it('закрытая статья — null, открытая — запись', async () => {
    mockPb.col.getOne.mockResolvedValueOnce({ id: AID, title: 'X', public: false });
    expect(await theoryApi.getPublicTheoryArticle(AID)).toBeNull();
    mockPb.col.getOne.mockResolvedValueOnce({ id: AID, title: 'X', public: true });
    expect(await theoryApi.getPublicTheoryArticle(AID)).toMatchObject({ id: AID, public: true });
  });

  it('404 / 403 от правил — null (нет статьи и закрыта неразличимы)', async () => {
    mockPb.col.getOne.mockRejectedValueOnce({ status: 404 });
    expect(await theoryApi.getPublicTheoryArticle(AID)).toBeNull();
    mockPb.col.getOne.mockRejectedValueOnce({ status: 403 });
    expect(await theoryApi.getPublicTheoryArticle(AID)).toBeNull();
    mockPb.col.getOne.mockRejectedValueOnce({ status: 0 });
    await expect(theoryApi.getPublicTheoryArticle(AID)).rejects.toMatchObject({ status: 0 });
  });

  it('читатель получает только поля страницы', async () => {
    mockPb.col.getOne.mockResolvedValueOnce({ id: AID, public: true });
    await theoryApi.getPublicTheoryArticle(AID);
    const opts = mockPb.col.getOne.mock.calls[0][1];
    expect(opts.fields).toContain('content_md');
    expect(opts.fields).toContain('expand.category.title');
    expect(opts.expand).toBe('category');
  });

  it('setTheoryArticlePublic пишет флаг и журнал', async () => {
    mockPb.col.update.mockResolvedValueOnce({ id: AID, title: 'Стерео', public: true });
    await theoryApi.setTheoryArticlePublic(AID, 1);
    expect(mockPb.col.update).toHaveBeenCalledWith(AID, { public: true });
    expect(mockPb._logAudit).toHaveBeenCalledWith('update', 'theory_articles', AID, 'Стерео: открыта по ссылке');
  });
});

describe('страница статьи для читателя', () => {
  it('закрытая статья — «Статья недоступна»', async () => {
    mockApi.getPublicTheoryArticle.mockResolvedValue(null);
    render(<StudentTheoryArticle id={AID} />);
    expect(await screen.findByText('Статья недоступна')).toBeTruthy();
    expect(mockApi.getPublicTheoryArticle).toHaveBeenCalledWith(AID);
  });

  it('сбой сети — тоже «недоступна», а не вечная загрузка', async () => {
    mockApi.getPublicTheoryArticle.mockRejectedValue(new Error('net'));
    render(<StudentTheoryArticle id={AID} />);
    expect(await screen.findByText('Статья недоступна')).toBeTruthy();
  });

  it('открытая статья: шапка, текст, оглавление, одна колонка', async () => {
    mockApi.getPublicTheoryArticle.mockResolvedValue({
      id: AID,
      title: 'Стереометрия в Lemma',
      summary: 'Как строить сечения',
      updated: '2026-10-04 10:00:00.000Z',
      expand: { category: { title: 'Инструкции', color: '#4361ee' } },
      content_md: 'Вступление.\n\n:::\n\n## Где найти\n\nТекст.\n\n## Эфир\n\n$$x^2$$\n\n## Библиотека\n\n![Меню](/help/stereo/01-menu.jpg)',
      theme_settings: { pageSettings: { columns: 2 } },
    });
    const { container } = render(<StudentTheoryArticle id={AID} />);
    expect(await screen.findByText('Стереометрия в Lemma')).toBeTruthy();
    expect(screen.getByText('Как строить сечения')).toBeTruthy();
    expect(screen.getByText('Инструкции')).toBeTruthy();
    await waitFor(() => expect(container.querySelector('.sta-content h2')).toBeTruthy());
    // Оглавление: три раздела, ссылки ведут на id заголовков
    const links = [...container.querySelectorAll('.sta-toc a')];
    expect(links.map((a) => a.textContent)).toEqual(['Где найти', 'Эфир', 'Библиотека']);
    await waitFor(() => expect(container.querySelector('#t-sec-1')?.textContent).toBe('Эфир'));
    // Разрыв колонки «:::» на экране не делит статью на колонки
    expect(container.querySelector('.col-section')).toBeNull();
    expect(container.querySelector('.sta-content .katex')).toBeTruthy();
    expect(container.querySelector('.sta-content img').getAttribute('src')).toBe('/help/stereo/01-menu.jpg');
    expect(document.title).toBe('Стереометрия в Lemma — Lemma');
  });

  it('tocFromHtml — только h2/h3, пустые пропускаются', () => {
    expect(tocFromHtml('<h1>A</h1><h2>B</h2><h3>C</h3><h2> </h2>')).toEqual([
      { id: 't-sec-0', text: 'B', level: 2 },
      { id: 't-sec-1', text: 'C', level: 3 },
    ]);
    expect(tocFromHtml('')).toEqual([]);
  });
});

describe('окно «Статья по ссылке»', () => {
  const renderModal = (props) => render(
    <AntApp>
      <TheoryShareModal open articleId={AID} onClose={() => {}} {...props} />
    </AntApp>,
  );

  it('закрытая: ссылка неактивна; переключатель открывает и сообщает наружу', async () => {
    const onChange = vi.fn();
    mockApi.setTheoryArticlePublic.mockResolvedValue({ id: AID, public: true });
    renderModal({ isPublic: false, onChange });
    expect(screen.getByText('Закрыта')).toBeTruthy();
    expect(screen.getByLabelText('Скопировать ссылку').closest('button').disabled).toBe(true);
    fireEvent.click(screen.getByRole('switch', { name: 'Открыта по ссылке' }));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(true));
    expect(mockApi.setTheoryArticlePublic).toHaveBeenCalledWith(AID, true);
    expect(screen.getByText(`student.oipav.ru/t/${AID}`)).toBeTruthy();
  });

  it('ошибка сохранения — переключатель возвращается', async () => {
    mockApi.setTheoryArticlePublic.mockRejectedValue(new Error('403'));
    renderModal({ isPublic: true });
    fireEvent.click(screen.getByRole('switch', { name: 'Открыта по ссылке' }));
    await waitFor(() => expect(screen.getByText('Открыта по ссылке')).toBeTruthy());
  });

  it('несохранённые правки — предупреждение', () => {
    renderModal({ isPublic: true, dirty: true });
    expect(screen.getByText(/последняя сохранённая версия/)).toBeTruthy();
  });
});

describe.each([
  ['stereo', 8],
  ['stereo-gen', 5],
])('статья-инструкция public/help/%s', (topic, minImages) => {
  const dir = resolve(__dirname, `../../public/help/${topic}`);
  const md = readFileSync(resolve(dir, 'article.md'), 'utf8');

  it('каждая картинка статьи лежит в своей папке public/help', () => {
    const srcs = [...md.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)].map((m) => m[1]);
    expect(srcs.length).toBeGreaterThanOrEqual(minImages);
    for (const src of srcs) {
      expect(src.startsWith(`/help/${topic}/`)).toBe(true);
      expect(existsSync(resolve(dir, src.replace(`/help/${topic}/`, '')))).toBe(true);
    }
  });

  it('каллауты закрыты', () => {
    const opens = md.split('\n').filter((l) => /^:::(example|note|remark|definition|theorem)\b/.test(l)).length;
    const closes = md.split('\n').filter((l) => l.trim() === ':::').length;
    expect(closes).toBe(opens);
  });
});

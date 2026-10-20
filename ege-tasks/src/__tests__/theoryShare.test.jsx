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
  const col = { getOne: vi.fn(), update: vi.fn(), create: vi.fn() };
  return {
    col,
    pb: { collection: vi.fn(() => col) },
    _logAudit: vi.fn(),
    withOwner: vi.fn((d) => ({ ...d, owner: 'teacher00000001' })),
  };
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
// eslint-disable-next-line import/first
import { canManageArticle, isColleagueArticle, articleAuthorName } from '../utils/theoryAccess';

const AID = 'abcdefghijklmno';

afterEach(cleanup);
beforeEach(() => {
  Object.values(mockApi).forEach((f) => f.mockReset());
  mockPb.col.getOne.mockReset();
  mockPb.col.update.mockReset();
  mockPb.col.create?.mockReset();
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
    expect(mockPb._logAudit).toHaveBeenCalledWith('update', 'theory_articles', AID, 'Стерео: открыта коллегам и по ссылке');
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
      { id: 't-sec-0', text: 'B', html: 'B', level: 2 },
      { id: 't-sec-1', text: 'C', html: 'C', level: 3 },
    ]);
    expect(tocFromHtml('')).toEqual([]);
  });
});

describe('доступ к статьям: личные, коллегам — только открытые (v3.9.390)', () => {
  const me = { id: 'teacher00000001', role: 'editor' };
  const mine = { id: AID, owner: me.id, public: false };
  const theirs = { id: AID, owner: 'teacher00000002', public: true, expand: { owner: { name: 'Анна Петровна' } } };

  it('новая статья пишется с автором', async () => {
    mockPb.col.create.mockResolvedValueOnce({ id: AID, title: 'Новая' });
    await theoryApi.createTheoryArticle({ title: 'Новая' });
    expect(mockPb.col.create).toHaveBeenCalledWith({ title: 'Новая', owner: me.id });
  });

  it('список просит автора статьи', async () => {
    mockPb.col.getFullList = vi.fn().mockResolvedValueOnce([]);
    await theoryApi.getTheoryArticles();
    const opts = mockPb.col.getFullList.mock.calls[0][0];
    expect(opts.fields).toContain('owner');
    expect(opts.fields).toContain('expand.owner.name');
    expect(opts.expand).toBe('owner');
  });

  it('свою правит автор, открытую коллеги — нет', () => {
    expect(canManageArticle(mine, me)).toBe(true);
    expect(canManageArticle(theirs, me)).toBe(false);
    expect(isColleagueArticle(theirs, me)).toBe(true);
    expect(isColleagueArticle(mine, me)).toBe(false);
    expect(articleAuthorName(theirs)).toBe('Анна Петровна');
  });

  it('superadmin правит всё, viewer — ничего, статья без автора — общая', () => {
    expect(canManageArticle(theirs, { id: 'x', role: 'superadmin' })).toBe(true);
    expect(canManageArticle(mine, { ...me, role: 'viewer' })).toBe(false);
    expect(canManageArticle({ id: AID, owner: '' }, me)).toBe(true);
    expect(isColleagueArticle({ id: AID, owner: '' }, me)).toBe(false);
    expect(canManageArticle(mine, null)).toBe(false);
  });

  it('миграция: чтение «своё или открытое», запись — автору', () => {
    const src = readFileSync(resolve(__dirname, '../../../pocketbase/pb_migrations/1788900000_theory_articles_owner.js'), 'utf8');
    expect(src).toContain('const READ = `public = true || (${T} && ${OWN})`');
    expect(src).toContain('const WRITE = `${T} && ${NV} && ${OWN}`');
    expect(src).toMatch(/col\.listRule = READ/);
    expect(src).toMatch(/col\.updateRule = WRITE/);
    expect(src).toMatch(/col\.deleteRule = WRITE/);
  });
});

describe('окно «Доступ к статье»', () => {
  const renderModal = (props) => render(
    <AntApp>
      <TheoryShareModal open articleId={AID} onClose={() => {}} {...props} />
    </AntApp>,
  );

  it('закрытая: ссылка неактивна; переключатель открывает и сообщает наружу', async () => {
    const onChange = vi.fn();
    mockApi.setTheoryArticlePublic.mockResolvedValue({ id: AID, public: true });
    renderModal({ isPublic: false, onChange });
    expect(screen.getByText('Личная — видите только вы')).toBeTruthy();
    expect(screen.getByLabelText('Скопировать ссылку').closest('button').disabled).toBe(true);
    fireEvent.click(screen.getByRole('switch', { name: 'Открыть статью' }));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(true));
    expect(mockApi.setTheoryArticlePublic).toHaveBeenCalledWith(AID, true);
    expect(screen.getByText(`student.oipav.ru/t/${AID}`)).toBeTruthy();
  });

  it('ошибка сохранения — переключатель возвращается', async () => {
    mockApi.setTheoryArticlePublic.mockRejectedValue(new Error('403'));
    renderModal({ isPublic: true });
    fireEvent.click(screen.getByRole('switch', { name: 'Открыть статью' }));
    await waitFor(() => expect(screen.getByText('Открыта коллегам и по ссылке')).toBeTruthy());
  });

  it('несохранённые правки — предупреждение', () => {
    renderModal({ isPublic: true, dirty: true });
    expect(screen.getByText(/последнюю сохранённую версию/)).toBeTruthy();
  });
});

describe.each([
  ['stereo', 8],
  ['stereo-gen', 5],
  ['work-show', 4],
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

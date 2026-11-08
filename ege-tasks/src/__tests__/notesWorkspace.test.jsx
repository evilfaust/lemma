import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { App } from 'antd';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  api: { getNotes: vi.fn(), getTeachingGroups: vi.fn(), getNoteBacklinks: vi.fn(), updateNote: vi.fn(),
    createNote: vi.fn(), getNoteTemplates: vi.fn(), createNoteTemplate: vi.fn(), deleteNoteTemplate: vi.fn() },
  auth: { teacher: { id: 'teacher1' }, canEdit: true, canDelete: true },
  pdfHtml: vi.fn(),
}));
vi.mock('../shared/services/pocketbase', () => ({ api: mocks.api }));
vi.mock('../shared/services/pb/client', () => ({ currentTeacher: () => mocks.auth.teacher }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => mocks.auth }));
vi.mock('../shared/services/pb/filesClient', () => ({ materialsApi: { isConnected: () => false } }));
vi.mock('../components/workspace/NoteAttachments', () => ({ default: () => null }));
vi.mock('html2pdf.js', () => ({ default: () => ({ set() { return this; }, from(wrap) { mocks.pdfHtml(wrap.innerHTML); return this; }, save: async () => {} }) }));
import NotesWorkspace from '../components/workspace/NotesWorkspace';
import { createNoteDraftStore } from '../components/workspace/notes/noteDrafts';

const body = [{ id: 'p1', type: 'paragraph', content: [{ type: 'text', text: 'При ' },
  { type: 'inlineMath', props: { formula: 'x>0' } }, { type: 'text', text: ' функция возрастает' }] }];
const note = { id: 'n1', title: 'Конспект', type: 'lesson', body, updated: 'server-v1', created: '2026-10-31' };
function mount(initial = '/app/notes') {
  return render(<App><MemoryRouter initialEntries={[initial]}><NotesWorkspace /></MemoryRouter></App>);
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mocks.auth.canEdit = true;
  mocks.auth.canDelete = true;
  mocks.api.getNotes.mockResolvedValue([structuredClone(note), { ...note, id: 'n2', title: 'Вторая заметка' }]);
  mocks.api.getTeachingGroups.mockResolvedValue([]);
  mocks.api.getNoteBacklinks.mockResolvedValue([]);
  mocks.api.getNoteTemplates.mockResolvedValue([]);
  mocks.api.updateNote.mockResolvedValue({ updated: 'server-v2' });
  mocks.api.createNote.mockImplementation(async (data) => ({ ...data, id: 'new-note' }));
  mocks.api.createNoteTemplate.mockResolvedValue({ id: 't1' });
  // Позиционирование меню/курсора ProseMirror, отсутствующее в jsdom.
  Range.prototype.getClientRects ??= () => [];
  Range.prototype.getBoundingClientRect ??= () => ({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 });
});
afterEach(() => cleanup());

describe('Заметки: редактор и черновики', () => {
  it('отображает формулу в строке и сохраняет изменение формулы', async () => {
    const view = mount();
    const formula = await screen.findByRole('button', { name: 'Редактировать формулу x>0' });
    expect(view.container.querySelector('.bn-inline-math .katex')).not.toBeNull();
    fireEvent.click(formula);
    const dialog = await screen.findByRole('dialog', { name: 'Формула в строке' });
    fireEvent.change(within(dialog).getByLabelText('Формула LaTeX'), { target: { value: 'x^2+1' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Вставить' }));
    await screen.findByRole('button', { name: 'Редактировать формулу x^2+1' });
    await waitFor(() => expect(mocks.api.updateNote).toHaveBeenCalledWith('n1', expect.objectContaining({
      body: expect.arrayContaining([expect.objectContaining({ content: expect.arrayContaining([
        expect.objectContaining({ type: 'inlineMath', props: { formula: 'x^2+1' } }),
      ]) })]),
    })), { timeout: 3000 });
  });

  it('не отправляет восстановленный черновик до выбора пользователя; восстанавливает заголовок и текст', async () => {
    const store = createNoteDraftStore(localStorage, 'teacher1');
    store.write('n1', { token: 'draft', patch: { title: 'Черновик урока', body: [{ type: 'paragraph', content: 'Несохранённый текст' }] }, baseUpdated: 'old' });
    mount();
    await screen.findByText('Найден несохранённый черновик в этом браузере');
    expect(screen.getByPlaceholderText('Заголовок заметки')).toBeDisabled();
    expect(mocks.api.updateNote).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Восстановить' }));
    await screen.findByText('Несохранённый текст', { selector: 'p' });
    expect(screen.getByPlaceholderText('Заголовок заметки')).toHaveValue('Черновик урока');
    await waitFor(() => expect(mocks.api.updateNote).toHaveBeenCalledWith('n1', expect.objectContaining({ title: 'Черновик урока' })), { timeout: 3000 });
  });

  it('при переключении с заметки из URL отправляет заголовок исходной записи и остаётся на выбранной', async () => {
    mount('/app/notes?note=n1');
    const input = await screen.findByPlaceholderText('Заголовок заметки');
    await waitFor(() => expect(input).toHaveValue('Конспект'));
    fireEvent.change(input, { target: { value: 'Новый заголовок' } });
    fireEvent.click(screen.getByText('Вторая заметка'));
    await waitFor(() => expect(input).toHaveValue('Вторая заметка'));
    await waitFor(() => expect(mocks.api.updateNote).toHaveBeenCalledWith('n1', { title: 'Новый заголовок' }));
    expect(input).toHaveValue('Вторая заметка');
  });

  it('PDF содержит отрисованную формулу в строке', async () => {
    mount();
    await screen.findByRole('button', { name: 'Редактировать формулу x>0' });
    fireEvent.click(screen.getByRole('button', { name: 'Экспорт в PDF' }));
    await waitFor(() => expect(mocks.pdfHtml).toHaveBeenCalled());
    expect(mocks.pdfHtml.mock.lastCall[0]).toContain('katex');
    expect(mocks.pdfHtml.mock.lastCall[0]).toContain('функция возрастает');
  });

  it('вставляет новую формулу в текст через тулбар', async () => {
    mount();
    await screen.findByRole('button', { name: 'Редактировать формулу x>0' });
    fireEvent.click(screen.getByRole('button', { name: '∑ в строке' }));
    const dialog = await screen.findByRole('dialog', { name: 'Формула в строке' });
    fireEvent.change(within(dialog).getByLabelText('Формула LaTeX'), { target: { value: '\\frac{1}{2}' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Вставить' }));
    await screen.findByRole('button', { name: 'Редактировать формулу \\frac{1}{2}' });
  });

  it('создаёт заметку из готового шаблона', async () => {
    mount();
    await screen.findByPlaceholderText('Заголовок заметки');
    fireEvent.click(screen.getByRole('button', { name: 'Способы создания заметки' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Из шаблона…' }));
    fireEvent.click(await screen.findByRole('button', { name: 'План урока' }));
    await waitFor(() => expect(mocks.api.createNote).toHaveBeenCalledWith(expect.objectContaining({ title: 'План урока', type: 'lesson' })));
    await screen.findByText('Цель урока');
    expect(screen.getByPlaceholderText('Заголовок заметки')).toHaveValue('План урока');
  });

  it('дублирует заметку с самым свежим заголовком', async () => {
    mount();
    const title = await screen.findByPlaceholderText('Заголовок заметки');
    fireEvent.change(title, { target: { value: 'План на завтра' } });
    fireEvent.click(screen.getByRole('button', { name: 'Действия с заметкой' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Дублировать заметку' }));
    await waitFor(() => expect(mocks.api.createNote).toHaveBeenCalledWith(expect.objectContaining({ title: 'План на завтра — копия' })));
    await waitFor(() => expect(title).toHaveValue('План на завтра — копия'));
  });

  it('сохраняет личный шаблон из текущего текста с формулой', async () => {
    mount();
    await screen.findByRole('button', { name: 'Редактировать формулу x>0' });
    fireEvent.click(screen.getByRole('button', { name: 'Действия с заметкой' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Сохранить как шаблон…' }));
    const dialog = await screen.findByRole('dialog', { name: 'Сохранить как шаблон' });
    fireEvent.change(within(dialog).getByLabelText('Название шаблона'), { target: { value: 'Мой конспект' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Сохранить' }));
    await waitFor(() => expect(mocks.api.createNoteTemplate).toHaveBeenCalledWith(expect.objectContaining({ title: 'Мой конспект', type: 'lesson' })));
    const saved = mocks.api.createNoteTemplate.mock.lastCall[0];
    expect(saved.body[0].content.some((n) => n.type === 'inlineMath')).toBe(true);
    expect(saved.body[0]).not.toHaveProperty('id');
  });

  it('viewer читает формулы, но не меняет заметку и не создаёт шаблоны', async () => {
    mocks.auth.canEdit = false;
    mocks.auth.canDelete = false;
    const view = mount();
    const input = await screen.findByPlaceholderText('Заголовок заметки');
    expect(input).toBeDisabled();
    expect(view.container.querySelector('.bn-inline-math .katex')).not.toBeNull();
    expect(screen.queryByRole('button', { name: /Редактировать формулу/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Действия с заметкой' })).toBeNull();
    expect(mocks.api.updateNote).not.toHaveBeenCalled();
  });
});

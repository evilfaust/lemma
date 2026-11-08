import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import StudentIntervalLab from '../components/lab/interval/StudentIntervalLab';
import StudentIntervalFeed from '../components/lab/interval/StudentIntervalFeed';
import { api } from '../shared/services/pocketbase';
vi.mock('../shared/services/pocketbase', () => ({ api: { getLabInterval: vi.fn(), startLabInterval: vi.fn(), actLabInterval: vi.fn(), getMyLabIntervals: vi.fn() } }));
vi.mock('../components/MathRenderer', () => ({ default: ({ text }) => <div>{text}</div> }));
vi.mock('../student/pwa/useAppUpdate', () => ({ useBlockAppReload: vi.fn() }));
vi.mock('../student/pwa/InstallApp', () => ({ CabinetLink: () => <a href="/student/">Главная</a> }));
function view(revision = 0, stepIndex = 0) { return { work: { title: 'Эксперимент', count: 3, isOpen: true }, hintsAllowed: true, current: { key: 'q1', expression: '(x+1)(x-2)>0', rootCount: 2, ...(stepIndex > 1 ? { roots: [-1, 2] } : stepIndex === 1 ? { rootChoices: [2, -1] } : {}) }, attempt: { id: 'attempt', status: 'started', state: { version: 2, revision, taskIndex: 0, stepIndex, answers: {} } } }; }
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); });
describe('ученический эксперимент', () => {
  it('отправляет текущий шаг и ревизию, после ответа показывает следующий шаг', async () => {
    api.getLabInterval.mockResolvedValue(view()); api.actLabInterval.mockResolvedValue(view(1, 1));
    render(<StudentIntervalLab id="work" />);
    fireEvent.change(await screen.findByLabelText('Критические точки'), { target: { value: '-1; 2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Проверить шаг' }));
    await screen.findByRole('heading', { name: 'Расставь корни' });
    expect(api.actLabInterval).toHaveBeenCalledWith('work', { kind: 'check', value: '-1; 2', revision: 0, version: 2 });
    expect(screen.getByRole('link', { name: 'Главная' })).toHaveAttribute('href', '/student/');
  });
  it('сохраняет черновик при сетевой ошибке и блокирует повтор без обновления состояния', async () => {
    api.getLabInterval.mockResolvedValue(view()); api.actLabInterval.mockRejectedValue(new Error('Сеть недоступна'));
    render(<StudentIntervalLab id="work" />);
    fireEvent.change(await screen.findByLabelText('Критические точки'), { target: { value: '-1; 2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Проверить шаг' }));
    await screen.findByText('Сеть недоступна');
    expect(screen.getByLabelText('Критические точки')).toHaveValue('-1; 2');
    expect(screen.getByRole('button', { name: 'Проверить шаг' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Загрузить сохранённое' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Проверить шаг' })).not.toBeDisabled());
  });
  it('возобновляет совпадающий черновик и не даёт отправлять шаг закрытой работы', async () => {
    localStorage.setItem('lemma.lab.interval.attempt.q1.roots', JSON.stringify({ revision: 0, value: '-1; 2' }));
    const data = view(); data.work.isOpen = false; api.getLabInterval.mockResolvedValue(data);
    render(<StudentIntervalLab id="work" />);
    expect(await screen.findByLabelText('Критические точки')).toHaveValue('-1; 2');
    expect(screen.getByRole('button', { name: 'Проверить шаг' })).toBeDisabled();
  });
  it('не стирает набранный ответ при получении подсказки', async () => {
    api.getLabInterval.mockResolvedValue(view());
    const hinted = view(1); hinted.attempt.state.answers['q1.roots'] = { hinted: true, checks: 0 };
    api.actLabInterval.mockResolvedValue(hinted);
    render(<StudentIntervalLab id="work" />);
    fireEvent.change(await screen.findByLabelText('Критические точки'), { target: { value: '-1; 2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Подсказка' }));
    await screen.findByRole('note');
    expect(screen.getByLabelText('Критические точки')).toHaveValue('-1; 2');
  });
  it('штрихует промежутки, сохраняет отметки и отдельно проверяет запись ответа', async () => {
    const shading = view(5, 5);
    shading.attempt.state.answers = {
      'q1.changes': { correct: true, value: [false, true] },
      'q1.points': { correct: true, value: [false, false] },
      'q1.signs': { correct: true, value: [1, -1, 1] },
    };
    api.getLabInterval.mockResolvedValue(shading);
    const notation = view(6, 6);
    notation.attempt.state.answers = { ...shading.attempt.state.answers, 'q1.answer': { correct: true, value: { gaps: [true, false, true], points: [false, false] } } };
    const completed = view(5); completed.current = null;
    completed.attempt.status = 'completed'; completed.attempt.state.taskIndex = 3;
    completed.attempt.summary = { total: 3, independent: 3, corrected: 0, helped: 0, skipped: 0 };
    api.actLabInterval.mockResolvedValueOnce(notation).mockResolvedValueOnce(completed);
    render(<StudentIntervalLab id="work" />);
    const gaps = await screen.findAllByRole('button', { name: /^Заштриховать промежуток/ });
    fireEvent.click(gaps[0]); fireEvent.click(gaps[2]);
    fireEvent.click(screen.getByRole('button', { name: 'Проверить шаг' }));
    const answer = await screen.findByRole('textbox', { name: 'Ответ промежутками' });
    expect(document.querySelectorAll('.li-gap-shaded')).toHaveLength(2);
    expect(screen.getByLabelText('Чётная кратность')).toHaveTextContent('!');
    expect(screen.getAllByLabelText('Выколотая точка')).toHaveLength(2);
    expect(api.actLabInterval).toHaveBeenCalledWith('work', { revision: 5, version: 2, kind: 'check', value: { gaps: [true, false, true], points: [false, false] } });
    fireEvent.change(answer, { target: { value: '(-∞; -1) ∪ (2; +∞)' } });
    fireEvent.click(screen.getByRole('button', { name: 'Проверить шаг' }));
    await screen.findByRole('heading', { name: 'Тренировка завершена' });
    expect(api.actLabInterval).toHaveBeenCalledWith('work', { revision: 6, version: 2, kind: 'check', value: '(-∞; -1) ∪ (2; +∞)' });
    expect(screen.queryByRole('button', { name: 'Проверить шаг' })).not.toBeInTheDocument();
  });
  it('показывает отдельную карточку только при назначении, с правильным маршрутом', async () => {
    const onPresence = vi.fn(); api.getMyLabIntervals.mockResolvedValue({ works: [] });
    const r = render(<StudentIntervalFeed studentId="s" onPresence={onPresence} />);
    await waitFor(() => expect(onPresence).toHaveBeenCalledWith(false));
    expect(screen.queryByRole('region', { name: 'Лаборатория' })).not.toBeInTheDocument();
    r.unmount(); api.getMyLabIntervals.mockResolvedValue({ works: [{ id: 'w', title: 'Метод интервалов', count: 3, done: 1, status: 'started', isOpen: true }] });
    render(<StudentIntervalFeed studentId="s" />);
    expect(await screen.findByRole('link', { name: 'Продолжить' })).toHaveAttribute('href', '/student/lab-interval/w');
  });
});

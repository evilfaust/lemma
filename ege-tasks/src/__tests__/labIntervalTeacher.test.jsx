import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from 'antd';
import IntervalLab from '../components/lab/interval/IntervalLab';
import { api } from '../shared/services/pocketbase';
vi.mock('../shared/services/pocketbase', () => ({ api: { getLabIntervalWorks: vi.fn(), getTeachingGroups: vi.fn(), getStudentsByGroup: vi.fn(), createLabIntervalWork: vi.fn(), getLabIntervalResults: vi.fn() } }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ canEdit: true }) }));
vi.mock('../components/MathRenderer', () => ({ default: ({ text }) => <div>{text}</div> }));
beforeEach(() => {
  vi.clearAllMocks();
  api.getLabIntervalWorks.mockResolvedValue({ works: [] });
  api.getTeachingGroups.mockResolvedValue([{ id: 'group', name: 'Пилотная группа' }]);
  api.getStudentsByGroup.mockResolvedValue([{ id: 'student', name: 'Петя' }]);
  api.createLabIntervalWork.mockResolvedValue({ id: 'newwork' });
  api.getLabIntervalResults.mockImplementation(() => new Promise(() => {}));
});
describe('назначение отдельной экспериментальной работы', () => {
  it('требует выбрать группу и просмотреть задания, затем фиксирует её состав', async () => {
    render(<App><IntervalLab /></App>);
    fireEvent.click(screen.getByRole('button', { name: 'Создать работу' }));
    expect(await screen.findByRole('button', { name: 'Назначить группе' })).toBeDisabled();
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Тестовая группа' }));
    fireEvent.click(await screen.findByText('Пилотная группа'));
    await screen.findByText('Будет назначено: 1 ученикам');
    expect(api.getStudentsByGroup).toHaveBeenCalledWith('group');
    expect(screen.getByRole('button', { name: 'Назначить группе' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Предпросмотр заданий' }));
    fireEvent.click(screen.getByRole('button', { name: 'Назначить группе' }));
    await waitFor(() => expect(api.createLabIntervalWork).toHaveBeenCalledOnce());
    const sent = api.createLabIntervalWork.mock.calls[0][0];
    expect(sent.participants).toEqual(['student']);
    expect(sent.group).toBe('group'); expect(sent.tasks).toHaveLength(8);
    expect(sent.tasks.every(t => t.expected && t.expr && t.answerLatex)).toBe(true);
  });
});

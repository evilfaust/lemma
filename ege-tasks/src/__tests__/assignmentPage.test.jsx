// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App, ConfigProvider } from 'antd';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import AssignmentPage from '../components/workspace/AssignmentPage';
import { api } from '../shared/services/pocketbase';

vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ canEdit: true }) }));
vi.mock('../shared/services/pocketbase', () => ({
  api: {
    getAssignment: vi.fn(),
    getAssignmentProgress: vi.fn(),
    setAssignmentReviewed: vi.fn(),
    updateSession: vi.fn(),
  },
}));
vi.mock('../components/worksheet/TeacherResultsDashboard', () => ({
  default: ({ sessionId }) => <div>Результаты {sessionId}</div>,
}));

it('показывает результаты выбранной выдачи и отдельно закрывает приём и отмечает разбор', async () => {
  const deadline = '2026-10-01 14:00:00.000Z';
  const record = { id: 'selected', deadline, is_open: true, student_title: 'Тест 11 Б' };
  api.getAssignment.mockResolvedValue(record);
  api.getAssignmentProgress.mockResolvedValue(new Map([['selected', {
    expected: 2,
    submitted: [{ id: 'a', name: 'Анна' }],
    started: [{ id: 'b', name: 'Борис' }],
    untouched: [],
  }]]));
  api.setAssignmentReviewed.mockResolvedValue({ reviewed_deadline: deadline });
  api.updateSession.mockResolvedValue({ is_open: false });

  render(
    <ConfigProvider theme={{ token: { motion: false } }}>
      <App>
        <MemoryRouter initialEntries={['/app/today/assignments/selected']}>
          <Routes>
            <Route path="/app/today/assignments/:sessionId" element={<AssignmentPage />} />
          </Routes>
        </MemoryRouter>
      </App>
    </ConfigProvider>,
  );

  expect(await screen.findByText('Сдали 1 из 2')).toBeInTheDocument();
  expect(screen.getByText('Борис')).toBeInTheDocument();
  expect(screen.getByText('Результаты selected')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Отметить разобранной' }));
  expect(await screen.findByText('Итоги разобраны')).toBeInTheDocument();
  expect(api.setAssignmentReviewed).toHaveBeenCalledWith(record, true);
  expect(api.updateSession).not.toHaveBeenCalled();
  expect(screen.getByText('Приём открыт')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Закрыть приём' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Закрыть', exact: true }));
  await waitFor(() => expect(api.updateSession).toHaveBeenCalledWith('selected', { is_open: false }));
  expect(await screen.findByRole('button', { name: 'Открыть приём' })).toBeInTheDocument();
  expect(screen.getByText('Итоги разобраны')).toBeInTheDocument();
});

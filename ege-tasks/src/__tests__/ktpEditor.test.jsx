import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { App as AntApp } from 'antd';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// КТП (v3.9.409): список берёт КТП, а не онлайн-курсы; «Новое КТП» с шаблоном
// приходит в редактор с ?template= и раскладывает программу под пары.

const mockApi = vi.hoisted(() => ({
  getKtps: vi.fn(),
  getCourses: vi.fn(),
  getTeachingGroups: vi.fn(),
  getKtp: vi.fn(),
  getKtpEntries: vi.fn(),
  updateKtp: vi.fn(),
  createKtpEntries: vi.fn(),
  updateKtpEntries: vi.fn(),
}));
vi.mock('../shared/services/pocketbase', () => ({ api: mockApi, default: {} }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ canEdit: true, canDelete: true }) }));
vi.mock('../contexts/ReferenceDataContext', () => ({ useReferenceData: () => ({ topics: [] }) }));

// eslint-disable-next-line import/first
import KtpList from '../components/workspace/KtpList';
// eslint-disable-next-line import/first
import KtpEditor from '../components/workspace/KtpEditor';

const COURSE = { id: 'ktp1', title: 'Геометрия 10', year: '2026/2027', unit: 'pair', per_week: 2, expand: {} };

const renderAt = (path) => render(
  <AntApp>
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/app/ktp" element={<KtpList />} />
        <Route path="/app/ktp/:courseId" element={<KtpEditor />} />
      </Routes>
    </MemoryRouter>
  </AntApp>,
);

describe('КТП', () => {
  beforeEach(() => {
    Object.values(mockApi).forEach((fn) => fn.mockReset());
    mockApi.getTeachingGroups.mockResolvedValue([]);
    mockApi.getKtp.mockResolvedValue(COURSE);
    mockApi.getKtpEntries.mockResolvedValue([]);
    mockApi.createKtpEntries.mockResolvedValue({ created: 1, failed: 0 });
  });
  afterEach(cleanup);

  it('список показывает КТП, а не онлайн-курсы', async () => {
    mockApi.getKtps.mockResolvedValue([{ id: 'k1', title: 'Мой план', year: '2026/2027', unit: 'pair', per_week: 2 }]);
    mockApi.getCourses.mockResolvedValue([{ id: 'g1', name: 'Интенсив', year: '2025/2026' }]);
    renderAt('/app/ktp');
    expect(await screen.findByText('Мой план')).toBeTruthy();
    expect(screen.getByText(/2 пары в неделю/)).toBeTruthy();
    expect(mockApi.getCourses).not.toHaveBeenCalled();
  });

  it('шаблон стереометрии по парам: 68 пар, недели 1…34', async () => {
    renderAt('/app/ktp/ktp1?template=stereo10-atanasyan');
    expect(await screen.findByText('Заполнить КТП по шаблону')).toBeTruthy();
    expect(screen.getByText(/68 пар/, { selector: 'b' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Заполнить' }));
    await waitFor(() => expect(mockApi.createKtpEntries).toHaveBeenCalledTimes(1));
    const [courseId, rows, startOrder] = mockApi.createKtpEntries.mock.calls[0];
    expect(courseId).toBe('ktp1');
    expect(startOrder).toBe(0);
    const lessons = rows.filter((r) => !r.is_section);
    expect(lessons.reduce((s, r) => s + r.hours, 0)).toBe(68);
    expect(Math.max(...lessons.map((r) => r.week_no))).toBeLessThanOrEqual(34);
    expect(rows[0]).toMatchObject({ is_section: true });
    // единица и ритм курса не менялись — курс не перезаписывается
    expect(mockApi.updateKtp).not.toHaveBeenCalled();
  });

  it('пустой план: столбец «Пары» и кнопка шаблона', async () => {
    renderAt('/app/ktp/ktp1');
    expect(await screen.findByText('Заполнить по шаблону')).toBeTruthy();
    expect(screen.getByText('Пары')).toBeTruthy();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { App as AntApp } from 'antd';
import { manualLink, manualIdFromPath } from '../utils/stereo';

const mockApi = vi.hoisted(() => ({
  getStereoScenes: vi.fn(),
  getStereoScene: vi.fn(),
  createStereoScene: vi.fn(),
  updateStereoScene: vi.fn(),
  deleteStereoScene: vi.fn(),
  getPublicStereoScene: vi.fn(),
}));
vi.mock('../shared/services/pocketbase', () => ({ api: mockApi, default: {} }));

// eslint-disable-next-line import/first
import StereoLibrary from '../components/stereo/StereoLibrary';
// eslint-disable-next-line import/first
import StudentStereoManual from '../components/stereo/StudentStereoManual';

const cube = { kind: 'cube', a: 4 };
const ops = [
  { id: 'a', type: 'pointOnLine', name: 'M', ref: ['A', 'A1'], t: 0.5, ratio: [1, 1], note: 'середина бокового ребра' },
  { id: 'b', type: 'pointOnLine', name: 'N', ref: ['C', 'C1'], t: 0.5, ratio: [1, 1] },
  { id: 'c', type: 'segment', ref: ['M', 'N'] },
];

describe('ссылки пособия', () => {
  it('адрес и разбор', () => {
    expect(manualLink('abcdefghijklmno').short).toBe('student.oipav.ru/s/abcdefghijklmno');
    expect(manualIdFromPath('/s/abcdefghijklmno')).toBe('abcdefghijklmno');
    expect(manualIdFromPath('/student/s/abcdefghijklmno/')).toBe('abcdefghijklmno');
    expect(manualIdFromPath('/s/short')).toBeNull();
    expect(manualIdFromPath('/b/10a')).toBeNull();
  });
});

describe('библиотека', () => {
  beforeEach(() => Object.values(mockApi).forEach((f) => f.mockReset()));
  const props = (over = {}) => ({
    open: true, onClose: vi.fn(), scene: { body: cube, ops }, camera: { yaw: 1, pitch: 2, zoom: 1 },
    currentDoc: null, dirty: true, onOpen: vi.fn(), onSaved: vi.fn(), canEdit: true, ...over,
  });

  it('без миграции — подсказка', async () => {
    mockApi.getStereoScenes.mockResolvedValue(null);
    render(<AntApp><StereoLibrary {...props()} /></AntApp>);
    await act(async () => {});
    expect(screen.getByText(/появится после обновления базы/)).toBeTruthy();
  });

  it('сохранить новый — с ракурсом; открыть ученикам', async () => {
    mockApi.getStereoScenes.mockResolvedValue([{ id: 'abcdefghijklmno', title: 'Сечение куба', public: false, updated: '2026-09-27 10:00:00.000Z' }]);
    mockApi.createStereoScene.mockResolvedValue({ id: 'zzzzzzzzzzzzzzz', title: 'Новый' });
    mockApi.updateStereoScene.mockResolvedValue({});
    const p = props();
    render(<AntApp><StereoLibrary {...p} /></AntApp>);
    await act(async () => {});
    fireEvent.change(screen.getByPlaceholderText(/Название, например/), { target: { value: 'Новый' } });
    await act(async () => { fireEvent.click(screen.getByText('Сохранить')); });
    expect(mockApi.createStereoScene).toHaveBeenCalledWith({ title: 'Новый', scene: p.scene, camera: p.camera });
    expect(p.onSaved).toHaveBeenCalledWith({ id: 'zzzzzzzzzzzzzzz', title: 'Новый' });

    await act(async () => { fireEvent.click(screen.getByRole('switch')); });
    expect(mockApi.updateStereoScene).toHaveBeenCalledWith('abcdefghijklmno', { public: true });
    expect(screen.getByLabelText('Скопировать ссылку')).toBeTruthy();
  });

  it('открыть сохранённый без несохранённых изменений — сразу', async () => {
    mockApi.getStereoScenes.mockResolvedValue([{ id: 'abcdefghijklmno', title: 'Сечение куба', updated: '' }]);
    mockApi.getStereoScene.mockResolvedValue({ id: 'abcdefghijklmno', title: 'Сечение куба', scene: { body: cube, ops } });
    const p = props({ dirty: false });
    render(<AntApp><StereoLibrary {...p} /></AntApp>);
    await act(async () => {});
    await act(async () => { fireEvent.click(screen.getByText('Сечение куба')); });
    expect(p.onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 'abcdefghijklmno' }));
  });
});

describe('пособие ученика', () => {
  beforeEach(() => Object.values(mockApi).forEach((f) => f.mockReset()));

  it('листаем шаги с подписями', async () => {
    mockApi.getPublicStereoScene.mockResolvedValue({
      id: 'abcdefghijklmno', title: 'Сечение куба', scene: { body: cube, ops }, camera: { yaw: 30, pitch: 20, zoom: 1 },
    });
    render(<StudentStereoManual id="abcdefghijklmno" />);
    await act(async () => {});
    expect(screen.getByText('Сечение куба')).toBeTruthy();
    expect(screen.getByText('шаг 0 из 3')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Следующий шаг'));
    expect(screen.getByText('середина бокового ребра')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByText('шаг 3 из 3')).toBeTruthy();
    expect(screen.getByLabelText('Следующий шаг').disabled).toBe(true);
  });

  it('закрытая ссылка', async () => {
    mockApi.getPublicStereoScene.mockResolvedValue(null);
    render(<StudentStereoManual id="abcdefghijklmno" />);
    await act(async () => {});
    expect(screen.getByText('Пособие недоступно')).toBeTruthy();
  });
});

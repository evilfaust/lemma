import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { App as AntApp } from 'antd';

const mockApi = vi.hoisted(() => ({
  getStereoScenes: vi.fn(),
  getPlanimScenes: vi.fn(),
  getStereoScene: vi.fn(),
  createStereoScene: vi.fn(),
  createPlanimScene: vi.fn(),
  updateStereoScene: vi.fn(),
  deleteStereoScene: vi.fn(),
  getPublicStereoScene: vi.fn(),
}));
vi.mock('../shared/services/pocketbase', () => ({ api: mockApi, default: {} }));
vi.mock('../contexts/AuthContext', () => ({ useOptionalAuth: () => ({ canEdit: true }) }));

// eslint-disable-next-line import/first
import StereoLibrary from '../components/stereo/StereoLibrary';
// eslint-disable-next-line import/first
import PlanimEditor from '../components/planim/PlanimEditor';
// eslint-disable-next-line import/first
import StudentStereoManual from '../components/stereo/StudentStereoManual';
// eslint-disable-next-line import/first
import StudentPlanimManual, { firstManualStep } from '../components/planim/StudentPlanimManual';
// eslint-disable-next-line import/first
import { parsePlanimBlock } from '../utils/planim';

const { scene: TRI } = parsePlanimBlock('треугольник ABC 5 6 7\nH = высота B AC // опускаем высоту\nM = медиана B AC');

beforeAll(() => {
  if (!window.PointerEvent) {
    window.PointerEvent = class extends MouseEvent {
      constructor(type, init = {}) { super(type, init); this.pointerId = init.pointerId ?? 1; }
    };
  }
});

describe('библиотека планиметрических чертежей', () => {
  beforeEach(() => {
    Object.values(mockApi).forEach((f) => f.mockReset());
    localStorage.clear();
  });

  it('окно библиотеки с kind="planim" читает и пишет планиметрию, без ракурса', async () => {
    mockApi.getPlanimScenes.mockResolvedValue([{ id: 'abcdefghijklmno', title: 'Высота', public: false, updated: '' }]);
    mockApi.createPlanimScene.mockResolvedValue({ id: 'zzzzzzzzzzzzzzz', title: 'Новый' });
    const onSaved = vi.fn();
    render(
      <AntApp>
        <StereoLibrary kind="planim" open onClose={vi.fn()} scene={TRI} currentDoc={null} dirty onOpen={vi.fn()} onSaved={onSaved} canEdit />
      </AntApp>,
    );
    await act(async () => {});
    expect(mockApi.getStereoScenes).not.toHaveBeenCalled();
    expect(screen.getByText('Высота')).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText(/Высота и медиана/), { target: { value: 'Новый' } });
    await act(async () => { fireEvent.click(screen.getByText('Сохранить')); });
    expect(mockApi.createPlanimScene).toHaveBeenCalledWith({ title: 'Новый', scene: TRI });
    expect(onSaved).toHaveBeenCalledWith({ id: 'zzzzzzzzzzzzzzz', title: 'Новый' });
  });

  it('стереобиблиотека по-прежнему своя', async () => {
    mockApi.getStereoScenes.mockResolvedValue([]);
    render(<AntApp><StereoLibrary open onClose={vi.fn()} scene={{ ops: [] }} currentDoc={null} dirty={false} onOpen={vi.fn()} onSaved={vi.fn()} canEdit /></AntApp>);
    await act(async () => {});
    expect(mockApi.getStereoScenes).toHaveBeenCalled();
    expect(mockApi.getPlanimScenes).not.toHaveBeenCalled();
  });

  it('редактор: открыть из библиотеки, правка → «несохранённые изменения», сохранить текущий', async () => {
    mockApi.getPlanimScenes.mockResolvedValue([{ id: 'abcdefghijklmno', title: 'Треугольник с высотой', updated: '' }]);
    mockApi.getStereoScene.mockResolvedValue({ id: 'abcdefghijklmno', title: 'Треугольник с высотой', kind: 'planim', scene: TRI });
    mockApi.updateStereoScene.mockResolvedValue({});
    render(<AntApp><PlanimEditor /></AntApp>);
    fireEvent.click(screen.getByText('Библиотека'));
    await act(async () => {});
    await act(async () => { fireEvent.click(screen.getByText('Треугольник с высотой')); });
    expect(screen.getByText('«Треугольник с высотой»')).toBeTruthy();
    expect(screen.getByText('M — середина AC')).toBeTruthy();

    const input = screen.getByLabelText('Строка команд');
    fireEvent.change(input, { target: { value: 'угол BAC' } });
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', keyCode: 13 });
      fireEvent.keyUp(input, { key: 'Enter', code: 'Enter', keyCode: 13 });
    });
    expect(screen.getByText('«Треугольник с высотой» · есть несохранённые изменения')).toBeTruthy();

    await act(async () => { fireEvent.keyDown(window, { key: 's', code: 'KeyS', ctrlKey: true }); });
    await act(async () => {});
    await act(async () => { fireEvent.click(screen.getByText('Сохранить «Треугольник с высотой»')); });
    const [id, patch] = mockApi.updateStereoScene.mock.calls[0];
    expect(id).toBe('abcdefghijklmno');
    expect(Object.keys(patch)).toEqual(['scene']);
    expect(patch.scene.ops.at(-1)).toMatchObject({ type: 'angle', pts: ['B', 'A', 'C'] });
    await waitFor(() => expect(screen.getByText('«Треугольник с высотой»')).toBeTruthy());
  });
});

describe('пособие ученика по планиметрическому чертежу', () => {
  let restoreRect;
  beforeAll(() => {
    const orig = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function rect() {
      return { x: 0, y: 0, left: 0, top: 0, width: 400, height: 500, right: 400, bottom: 500, toJSON() {} };
    };
    restoreRect = () => { Element.prototype.getBoundingClientRect = orig; };
  });
  afterAll(() => restoreRect());

  it('начинает с готовой фигуры и листает построения', async () => {
    expect(firstManualStep(TRI.ops)).toBe(4); // три вершины + контур
    render(<StudentPlanimManual rec={{ id: 'x', title: 'Высота', scene: TRI }} />);
    expect(screen.getByText('шаг 4 из 9')).toBeTruthy();
    expect(screen.getByText(/Сначала — сама фигура/)).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Следующий шаг'));
    expect(screen.getByText(/Шаг 5: H — основание перпендикуляра из B на AC/)).toBeTruthy();
    expect(screen.getByText('опускаем высоту')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByText('Шаг 6: Отрезок BH')).toBeTruthy();
  });

  it('ссылка /s/<id> открывает планиметрию по kind', async () => {
    mockApi.getPublicStereoScene.mockResolvedValue({ id: 'abcdefghijklmno', title: 'Медиана', kind: 'planim', scene: TRI });
    render(<StudentStereoManual id="abcdefghijklmno" />);
    expect(await screen.findByText('шаг 4 из 9')).toBeTruthy();
    expect(document.querySelector('.planim-canvas')).toBeTruthy();
  });
});

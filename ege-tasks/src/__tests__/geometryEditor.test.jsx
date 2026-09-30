import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { App as AntApp } from 'antd';
import { findStereoAtCursor } from '../utils/plotSnippet';
import {
  stereoDrawingSvg, stereoSpecFromSvg, stereoBlockMarkdown, parseStereoBlock,
} from '../utils/stereo';

const mockApi = vi.hoisted(() => ({
  getGeometryTopics: vi.fn(),
  getGeometrySubtopics: vi.fn(),
  getNextGeometryCode: vi.fn(),
  getGeometryImageUrl: vi.fn(() => ''),
  createGeometryTask: vi.fn(),
  updateGeometryTask: vi.fn(),
  deleteGeometryTask: vi.fn(),
}));
vi.mock('../shared/services/pocketbase', () => ({ api: mockApi, default: {} }));
// Апплет GeoGebra тянет скрипт с geogebra.org — в тестах он не нужен.
vi.mock('../components/GeoGebraApplet', () => ({ default: () => <div data-testid="ggb" /> }));

// eslint-disable-next-line import/first
import GeometryTaskEditor, { normalizeHints } from '../components/GeometryTaskEditor';

const cube = { kind: 'cube', a: 4 };

describe('стереочертёж в тексте и в чертеже задачи', () => {
  it('блок ```stereo под курсором', () => {
    const text = 'Постройте сечение.\n\n```stereo\nкуб\nM на AA1\n```\n\nОтвет: 12';
    const inside = text.indexOf('M на');
    expect(findStereoAtCursor(text, inside)).toEqual({
      start: text.indexOf('```stereo'), end: text.indexOf('```\n\nОтвет') + 3, spec: 'куб\nM на AA1', format: 'block',
    });
    expect(findStereoAtCursor(text, 3)).toBeNull();
    expect(findStereoAtCursor('```plot\nf x\n```', 9)).toBeNull();
  });

  it('SVG задачи несёт исходник, кириллица цела, обрезан по содержимому', () => {
    const { scene, camera } = parseStereoBlock('куб 4\nM на AA1 // середина ребра\nN на CC1\nсечение MNB\nцвет MNB красный');
    const svg = stereoDrawingSvg(scene, camera, { color: true });
    expect(svg).toMatch(/^<svg[^>]*width="100%"/);
    const spec = stereoSpecFromSvg(svg);
    expect(spec).toContain('// середина ребра');
    expect(spec).toContain('цвет MNB красный');
    const again = parseStereoBlock(spec);
    expect(again.errors).toEqual([]);
    expect(again.scene.ops.map((o) => o.type)).toEqual(['pointOnLine', 'pointOnLine', 'section']);
    const vb = /viewBox="([-\d.]+) ([-\d.]+) ([\d.]+) ([\d.]+)"/.exec(svg).slice(1).map(Number);
    expect(vb[2]).toBeLessThan(520);
    expect(stereoSpecFromSvg('<svg></svg>')).toBeNull();
  });

  it('блок для вставки — с оградой и размером, если был задан', () => {
    const { scene, camera } = parseStereoBlock('куб');
    expect(stereoBlockMarkdown(scene, camera)).toMatch(/^\n```stereo\nкуб 4\nвид 22 22\n```\n$/);
    expect(stereoBlockMarkdown(scene, camera, { size: { width: 300, height: 249 } })).toContain('размер 300 249');
  });
});

describe('указания', () => {
  it('нормализация: строка json, порядок, мусор', () => {
    expect(normalizeHints('[{"order":2,"text_md":"б"},{"order":1,"text_md":"а"}]')).toEqual([{ text_md: 'а' }, { text_md: 'б' }]);
    expect(normalizeHints(null)).toEqual([]);
    expect(normalizeHints('не json')).toEqual([]);
    expect(normalizeHints([{ order: 1 }, { order: 2, text_md: 'x' }])).toEqual([{ text_md: 'x' }]);
  });
});

describe('редактор геометрической задачи', () => {
  beforeEach(() => {
    Object.values(mockApi).forEach((f) => f.mockReset?.());
    mockApi.getGeometryTopics.mockResolvedValue([]);
    mockApi.getGeometrySubtopics.mockResolvedValue([]);
    mockApi.getGeometryImageUrl.mockReturnValue('');
    mockApi.getNextGeometryCode.mockResolvedValue('GEO-254');
    mockApi.createGeometryTask.mockResolvedValue({ id: 'n' });
    mockApi.updateGeometryTask.mockResolvedValue({});
  });

  const mount = (props = {}) => render(
    <AntApp>
      <GeometryTaskEditor task={null} onSaved={vi.fn()} onCancel={vi.fn()} {...props} />
    </AntApp>,
  );

  it('новая задача получает следующий свободный код; тулбар как в основном редакторе', async () => {
    mount();
    await waitFor(() => expect(screen.getByPlaceholderText('GEO-001').value).toBe('GEO-254'));
    for (const label of ['Таблица ▾', 'Числовая прямая', 'График', 'Векторы', 'Клетка', 'Планиметрия', 'Стерео']) {
      expect(screen.getAllByText(label).length).toBeGreaterThanOrEqual(2); // условие + решение
    }
  });

  it('сохранение: указания и «на готовом чертеже»', async () => {
    const onSaved = vi.fn();
    const task = {
      id: 't1', code: 'GEO-010', statement_md: 'Найдите угол', task_type: 'ready',
      hints: [{ order: 1, text_md: 'Проведите диаметр' }],
    };
    mount({ task, onSaved });
    await act(async () => {});
    expect(screen.getByText('указаний: 1')).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: /На готовом чертеже/ }).checked).toBe(true);
    fireEvent.click(screen.getByText('Добавить указание'));
    await act(async () => { fireEvent.click(screen.getAllByText('Сохранить')[0]); }); // первая — кнопка задачи в шапке
    await waitFor(() => expect(mockApi.updateGeometryTask).toHaveBeenCalled());
    const [, payload] = mockApi.updateGeometryTask.mock.calls[0];
    expect(payload.task_type).toBe('ready');
    expect(payload.hints).toEqual([{ order: 1, text_md: 'Проведите диаметр' }]); // пустое указание не сохраняется
    expect(payload.code).toBe('GEO-010');
    expect(onSaved).toHaveBeenCalled();
  });

  it('несохранённые правки: «не сохранено», переспрос при выходе, Ctrl+S', async () => {
    const onCancel = vi.fn();
    mount({ task: { id: 't1', code: 'GEO-010', statement_md: 'x' }, onCancel });
    await act(async () => {});
    fireEvent.click(screen.getByText('Назад к задачам'));
    expect(onCancel).toHaveBeenCalledTimes(1); // правок нет — сразу

    fireEvent.change(screen.getByPlaceholderText('Атанасян, §7'), { target: { value: 'Шарыгин' } });
    expect(screen.getByText('не сохранено')).toBeTruthy();
    fireEvent.click(screen.getByText('Назад к задачам'));
    expect((await screen.findAllByText('Уйти без сохранения?')).length).toBeGreaterThan(0);
    expect(onCancel).toHaveBeenCalledTimes(1);

    await act(async () => { fireEvent.keyDown(window, { key: 's', code: 'KeyS', ctrlKey: true }); });
    await waitFor(() => expect(mockApi.updateGeometryTask).toHaveBeenCalled());
    expect(mockApi.updateGeometryTask.mock.calls[0][1].source).toBe('Шарыгин');
  });
});

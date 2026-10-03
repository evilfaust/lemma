import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent, cleanup } from '@testing-library/react';
import { App as AntApp } from 'antd';
import { currentAcademicYear } from '../utils/academicYear';

// Эфир и чертежи в кабинете ученика (v3.9.283): классы у комнаты эфира и у
// пособия библиотеки, лента кабинета (GET /api/stereo/my).

const mockApi = vi.hoisted(() => ({
  getMyStereoFeed: vi.fn(),
  getTeachingGroups: vi.fn(),
  getStereoScenes: vi.fn(),
  updateStereoScene: vi.fn(),
}));
vi.mock('../shared/services/pocketbase', () => ({ api: mockApi, default: {} }));

// eslint-disable-next-line import/first
import StudentStereoFeed from '../components/student/StudentStereoFeed';
// eslint-disable-next-line import/first
import StereoLibrary from '../components/stereo/StereoLibrary';
// eslint-disable-next-line import/first
import StereoLivePanel from '../components/stereo/StereoLivePanel';
// eslint-disable-next-line import/first
import { _resetStereoGroups } from '../components/stereo/StereoGroupsSelect';

const YEAR = currentAcademicYear();
const GROUPS = [
  { id: 'g11a', name: '11 А', year: YEAR },
  { id: 'g7b', name: '7 Б', year: YEAR },
  { id: 'g10aold', name: '10 А', year: '2000/2001' },
  { id: 'g9old', name: '9 В', year: '2000/2001' },
];

afterEach(cleanup); // Drawer и выпадашки живут порталами в body

beforeEach(() => {
  Object.values(mockApi).forEach((f) => f.mockReset());
  _resetStereoGroups();
  mockApi.getTeachingGroups.mockResolvedValue(GROUPS);
});

describe('кабинет ученика: эфир и чертежи', () => {
  it('нет ленты (хук не задеплоен / не вошёл) — блока нет', async () => {
    mockApi.getMyStereoFeed.mockResolvedValue(null);
    const { container } = render(<StudentStereoFeed />);
    await act(async () => {});
    expect(container.innerHTML).toBe('');
  });

  it('пустая лента — блока нет', async () => {
    mockApi.getMyStereoFeed.mockResolvedValue({ rooms: [], scenes: [] });
    const { container } = render(<StudentStereoFeed />);
    await act(async () => {});
    expect(container.innerHTML).toBe('');
  });

  it('идущий эфир и пособия — ссылками /b/ и /s/', async () => {
    mockApi.getMyStereoFeed.mockResolvedValue({
      rooms: [{ code: '10a', title: '10 А' }],
      scenes: [
        { id: 'abcdefghijklmno', title: 'Сечение куба', kind: '' },
        { id: 'pqrstuvwxyzabcd', title: 'Высота треугольника', kind: 'planim' },
      ],
    });
    render(<StudentStereoFeed />);
    await act(async () => {});
    expect(screen.getByText('в эфире')).toBeTruthy();
    expect(screen.getByText('10 А').closest('a').getAttribute('href')).toBe('/student/b/10a');
    expect(screen.getByText('Сечение куба').closest('a').getAttribute('href')).toBe('/student/s/abcdefghijklmno');
    expect(screen.getByText('Высота треугольника').closest('a').getAttribute('href')).toBe('/student/s/pqrstuvwxyzabcd');
  });

  it('длинный список пособий сворачивается', async () => {
    mockApi.getMyStereoFeed.mockResolvedValue({
      rooms: [],
      scenes: Array.from({ length: 6 }, (_, i) => ({ id: `scene${i}aaaaaaaaaa`, title: `Чертёж ${i + 1}`, kind: '' })),
    });
    render(<StudentStereoFeed />);
    await act(async () => {});
    expect(screen.queryByText('Чертёж 6')).toBeNull();
    fireEvent.click(screen.getByText('Показать все (6)'));
    expect(screen.getByText('Чертёж 6')).toBeTruthy();
  });

  it('эфир начался, пока кабинет открыт, — появляется по опросу', async () => {
    vi.useFakeTimers();
    try {
      mockApi.getMyStereoFeed
        .mockResolvedValueOnce({ rooms: [], scenes: [] })
        .mockResolvedValue({ rooms: [{ code: '7b', title: '7 Б' }], scenes: [] });
      render(<StudentStereoFeed />);
      await act(async () => {});
      expect(screen.queryByText('в эфире')).toBeNull();
      await act(async () => { vi.advanceTimersByTime(20000); });
      expect(screen.getByText('в эфире')).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('библиотека: классы пособия', () => {
  const props = {
    open: true, onClose: vi.fn(), scene: { body: { kind: 'cube', a: 4 }, ops: [] }, camera: { yaw: 1, pitch: 2, zoom: 1 },
    currentDoc: null, dirty: false, onOpen: vi.fn(), onSaved: vi.fn(), canEdit: true,
  };

  it('выбор классов — только у открытых пособий и только после миграции', async () => {
    mockApi.getStereoScenes.mockResolvedValue([
      { id: 'aaaaaaaaaaaaaaa', title: 'Открытый', public: true, groups: [], updated: '' },
      { id: 'bbbbbbbbbbbbbbb', title: 'Закрытый', public: false, groups: [], updated: '' },
      { id: 'ccccccccccccccc', title: 'До миграции', public: true, updated: '' },
    ]);
    render(<AntApp><StereoLibrary {...props} /></AntApp>);
    await act(async () => {});
    // Drawer рисуется порталом в body
    expect(document.querySelectorAll('.stereo-lib__groups')).toHaveLength(1);
    expect(document.querySelector('.stereo-lib__groups').closest('li').textContent).toContain('Открытый');
  });

  it('класс пособия сохраняется; в списке — классы этого года и уже выбранные прошлых', async () => {
    mockApi.getStereoScenes.mockResolvedValue([
      { id: 'aaaaaaaaaaaaaaa', title: 'Сечение', public: true, groups: ['g10aold'], updated: '' },
    ]);
    mockApi.updateStereoScene.mockResolvedValue({});
    render(<AntApp><StereoLibrary {...props} /></AntApp>);
    await act(async () => {});
    // Метки выбранного в режиме maxTagCount="responsive" jsdom не рисует
    // (меряет ширины) — проверяем по списку вариантов.
    fireEvent.mouseDown(document.querySelector('.stereo-lib__groups .ant-select-selector'));
    expect(await screen.findByTitle('10 А · 2000/2001')).toBeTruthy(); // выбранный прошлогодний
    fireEvent.click(await screen.findByTitle('11 А'));
    expect(mockApi.updateStereoScene).toHaveBeenCalledWith('aaaaaaaaaaaaaaa', { groups: ['g10aold', 'g11a'] });
    expect(screen.queryByTitle('9 В · 2000/2001')).toBeNull(); // чужой прошлый год не предлагается
  });
});

describe('панель эфира: классы трансляции', () => {
  const room = (over = {}) => ({ id: 'r1', code: '10a', live: false, scene: null, ...over });
  const live = (r, over = {}) => ({
    rooms: [r], room: r, isLive: !!r.live, error: '',
    selectRoom: vi.fn(), createRoom: vi.fn(), deleteRoom: vi.fn(), setGroups: vi.fn().mockResolvedValue(),
    start: vi.fn(), stop: vi.fn(), pushCamera: vi.fn(), setLead: vi.fn(), ...over,
  });
  const mount = (l) => render(<AntApp><StereoLivePanel live={l} camera={{ yaw: 1, pitch: 2, zoom: 1 }} /></AntApp>);

  it('до миграции (нет поля groups) — выбора нет', async () => {
    mount(live(room()));
    await act(async () => {});
    expect(screen.queryByLabelText('Классы')).toBeNull();
  });

  it('классы можно сменить и во время эфира', async () => {
    const l = live(room({ live: true, groups: ['g7b'] }));
    const { container } = mount(l);
    await act(async () => {});
    expect(screen.getByText(/ученики этих классов видят его в личном кабинете/)).toBeTruthy();
    fireEvent.mouseDown(container.querySelector('.stereo-live__groups .ant-select-selector'));
    fireEvent.click(await screen.findByTitle('11 А'));
    expect(l.setGroups).toHaveBeenCalledWith(['g7b', 'g11a']);
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render, screen, fireEvent, waitFor, cleanup,
} from '@testing-library/react';
import { App as AntApp } from 'antd';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { stereoDrawingSvg, parseStereoBlock } from '../utils/stereo/dsl';
import { DEFAULT_CAMERA } from '../utils/stereo/camera';

// Ссылка ученику на геометрическую работу (v3.9.284): /w/<id> без входа,
// только условия и чертежи; классам — в кабинет.

const mockApi = vi.hoisted(() => ({
  getStudentGeometryWork: vi.fn(),
  setGeometryWorkDrawings: vi.fn(),
  getGeometryImageUrl: vi.fn((t) => (t.geogebra_image_base64 ? `https://pb/files/${t.id}/${t.geogebra_image_base64}` : '')),
  setGeometryWorkSharing: vi.fn(),
  getTeachingGroups: vi.fn(),
  getMyStereoFeed: vi.fn(),
}));
vi.mock('../shared/services/pocketbase', () => ({ api: mockApi, default: {} }));

const mockChunked = vi.hoisted(() => ({ getFullListByOr: vi.fn() }));
vi.mock('../shared/services/pb/chunked.js', () => mockChunked);

// eslint-disable-next-line import/first
import { workLink, workFromLocation, variantItems, variantCount } from '../utils/geometryWorkLink';
// eslint-disable-next-line import/first
import StudentGeometryWork from '../components/geometry/student/StudentGeometryWork';
// eslint-disable-next-line import/first
import GeometryWorkShareModal from '../components/geometry/works/GeometryWorkShareModal';
// eslint-disable-next-line import/first
import StudentStereoFeed from '../components/student/StudentStereoFeed';
// eslint-disable-next-line import/first
import { _resetStereoGroups } from '../components/stereo/StereoGroupsSelect';
// eslint-disable-next-line import/first
import { geometryApi } from '../shared/services/pb/geometry';
// eslint-disable-next-line import/first
import { pb } from '../shared/services/pb/client.js';
// eslint-disable-next-line import/first
import { planimDrawingSvg, parsePlanimBlock } from '../utils/planim/dsl';

const WID = 'abcdefghijklmno';
const STRUCTURE = {
  variants: [
    { items: [{ task: 't1' }, { task: 't2' }, { task: 't3' }] },
    { items: [{ task: 't4' }, null, { task: 't5' }] },
  ],
  layouts: {},
};
const CUBE_SVG = stereoDrawingSvg({ body: { kind: 'cube', a: 4 }, ops: [] }, DEFAULT_CAMERA);
const PLANIM_SVG = planimDrawingSvg(parsePlanimBlock('треугольник ABC 5 6 7\nH = высота C AB').scene);
// Так задачи приходят с сервера (хук geometry_work.pb.js): уровень уже посчитан,
// чертёж решения t3 сервер не отдал (has_drawing: false).
const TASKS = [
  { id: 't1', statement_md: 'Найдите длину $AC_1$.', level: 'live', kind: 'stereo', has_drawing: true, drawing_view: 'svg', drawing_svg: CUBE_SVG },
  { id: 't2', statement_md: 'Задача про пирамиду.', level: 'image', kind: 'image', has_drawing: true, geogebra_image_base64: 'pic.png' },
  { id: 't3', statement_md: 'Задача три.', level: 'none', kind: null, has_drawing: false },
  { id: 't4', statement_md: 'Вторая: первая задача.', level: 'none', kind: null, has_drawing: false },
  { id: 't5', statement_md: 'Вторая: третья задача.', level: 'none', kind: null, has_drawing: false },
];
const VARIANTS = [['t1', 't2', 't3'], ['t4', null, 't5']];
const serverWork = (tasks = TASKS) => ({ id: WID, title: 'Сечения куба', class: 10, variants: VARIANTS, tasks });

afterEach(cleanup);
beforeEach(() => {
  Object.values(mockApi).forEach((f) => f.mockClear?.());
  mockApi.getStudentGeometryWork.mockReset();
  mockApi.setGeometryWorkDrawings.mockReset();
  mockApi.setGeometryWorkSharing.mockReset();
  mockApi.getTeachingGroups.mockReset();
  mockApi.getMyStereoFeed.mockReset();
  _resetStereoGroups();
  localStorage.clear();
  mockApi.getTeachingGroups.mockResolvedValue([{ id: 'g7', name: '7 Б' }]);
  mockApi.getStudentGeometryWork.mockResolvedValue(serverWork());
});

describe('ссылки и состав варианта', () => {
  it('ссылка общая и на вариант, разбор адреса', () => {
    expect(workLink(WID).full).toBe(`https://student.oipav.ru/w/${WID}`);
    expect(workLink(WID, 1).short).toBe(`student.oipav.ru/w/${WID}?v=2`);
    expect(workFromLocation(`/w/${WID}`)).toEqual({ id: WID, variant: null });
    expect(workFromLocation(`/student/w/${WID}`, '?v=2')).toEqual({ id: WID, variant: 1 });
    expect(workFromLocation(`/w/${WID}`, '?v=0')).toEqual({ id: WID, variant: null });
    expect(workFromLocation('/s/abc')).toBeNull();
    expect(workFromLocation('/student/abcdefghijklmno')).toBeNull(); // это код сессии
  });

  it('пустая ячейка номер позиции не сдвигает', () => {
    expect(variantItems(STRUCTURE, 1)).toEqual([{ no: 1, taskId: 't4' }, { no: 3, taskId: 't5' }]);
    expect(variantCount(STRUCTURE)).toBe(2);
  });

  it('ученику работа приходит хуком сервера (он и режет ответы и скрытые чертежи)', async () => {
    const send = vi.spyOn(pb, 'send').mockResolvedValue({ id: WID, variants: [[]], tasks: [] });
    await geometryApi.getStudentGeometryWork(WID);
    expect(send.mock.calls[0][0]).toBe(`/api/geometry/work/${WID}`);
    send.mockRejectedValue(Object.assign(new Error('nf'), { status: 404 }));
    expect(await geometryApi.getStudentGeometryWork(WID)).toBeNull();
    send.mockRestore();
  });
});

describe('страница ученика /w/<id>', () => {
  it('общая ссылка: сначала выбор варианта, потом задания без ответов', async () => {
    render(<StudentGeometryWork id={WID} />);
    expect(await screen.findByText('Сечения куба')).toBeInTheDocument();
    expect(screen.getByText(/Выберите свой вариант/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Вариант 2'));
    expect(await screen.findByText('Вторая: первая задача.')).toBeInTheDocument();
    expect(screen.getByText('Вторая: третья задача.')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument(); // номер позиции, а не «2»
    expect(screen.queryByText(/Ответ/)).toBeNull();
    // выбор запомнился, можно сменить
    expect(localStorage.getItem(`gwork.variant.${WID}`)).toBe('1');
    fireEvent.click(screen.getByText('сменить вариант'));
    expect(screen.getByText(/Выберите свой вариант/)).toBeInTheDocument();
  });

  it('ссылка варианта: сразу задания, выбора нет; стереочертёж живой, чертёж решения скрыт', async () => {
    const { container } = render(<StudentGeometryWork id={WID} variant={0} />);
    expect(await screen.findByText('Задача про пирамиду.')).toBeInTheDocument();
    expect(screen.queryByText(/Выберите свой вариант/)).toBeNull();
    expect(screen.queryByText('сменить вариант')).toBeNull();
    expect(screen.getByText('Вариант 1')).toBeInTheDocument();
    expect(container.querySelector('.sgw-figure--live .theory-stereo')).not.toBeNull();
    const imgs = [...container.querySelectorAll('.sgw-figure img')].map((i) => i.getAttribute('src'));
    expect(imgs).toEqual(['https://pb/files/t2/pic.png']); // sol.png — чертёж решения, не показываем
  });

  it('закрытая работа — понятное сообщение', async () => {
    mockApi.getStudentGeometryWork.mockResolvedValue(null);
    render(<StudentGeometryWork id={WID} />);
    expect(await screen.findByText('Работа недоступна')).toBeInTheDocument();
  });

  it('учитель скрыл чертёж — ученику «сделайте сами», ни картинки, ни холста', async () => {
    mockApi.getStudentGeometryWork.mockResolvedValue(serverWork([
      { id: 't1', statement_md: 'Скрытый чертёж.', level: 'none', kind: null, has_drawing: true },
      { id: 't2', statement_md: 'Без чертежа вовсе.', level: 'none', kind: null, has_drawing: false },
    ]));
    const { container } = render(<StudentGeometryWork id={WID} variant={0} />);
    expect(await screen.findByText('Скрытый чертёж.')).toBeInTheDocument();
    expect(screen.getAllByText('Чертёж к задаче сделайте сами.')).toHaveLength(1);
    expect(container.querySelector('.sgw-figure')).toBeNull();
  });

  it('картинка: SVG без холста; шаги: листание построения с начала', async () => {
    mockApi.getStudentGeometryWork.mockResolvedValue(serverWork([
      { id: 't1', statement_md: 'Картинкой.', level: 'image', kind: 'stereo', has_drawing: true, drawing_view: 'svg', drawing_svg: CUBE_SVG.replace(/<!--stereo:[^>]*-->/, '') },
      { id: 't2', statement_md: 'По шагам.', level: 'steps', kind: 'planim', has_drawing: true, drawing_view: 'svg', drawing_svg: PLANIM_SVG },
    ]));
    const { container } = render(<StudentGeometryWork id={WID} variant={0} />);
    expect(await screen.findByText('Картинкой.')).toBeInTheDocument();
    expect(container.querySelectorAll('.sgw-figure--svg svg')).toHaveLength(1);
    expect(container.querySelector('.sgw-figure--live .planim-live')).not.toBeNull();
    expect(screen.getByText(/Сначала — сама фигура/)).toBeInTheDocument();
    expect(screen.getByLabelText('Следующий шаг')).toBeInTheDocument();
    expect(screen.getByText(/Построение листается по шагам/)).toBeInTheDocument();
  });

  it('стереочертёж по шагам начинается с самого тела', async () => {
    const parsed = parseStereoBlock('куб 4\nM на AB 1:1');
    expect(parsed.scene.ops).toHaveLength(1);
    const svg = stereoDrawingSvg(parsed.scene, DEFAULT_CAMERA);
    mockApi.getStudentGeometryWork.mockResolvedValue(serverWork([
      { id: 't1', statement_md: 'Куб по шагам.', level: 'steps', kind: 'stereo', has_drawing: true, drawing_view: 'svg', drawing_svg: svg },
    ]));
    render(<StudentGeometryWork id={WID} variant={0} />);
    expect(await screen.findByText('Само тело')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Следующий шаг'));
    expect(screen.getByText(/Всё построение/)).toBeInTheDocument();
  });
});

describe('окно «Ученикам» у учителя', () => {
  it('открыть работу и выбрать класс — сохраняется сразу, ссылки по вариантам', async () => {
    mockApi.setGeometryWorkSharing.mockResolvedValue({});
    const onChange = vi.fn();
    render(
      <AntApp>
        <GeometryWorkShareModal open workId={WID} variants={2} sharing={{ public: false, groups: [] }} onChange={onChange} />
      </AntApp>,
    );
    expect(screen.getByText(/Ссылки заработают/)).toBeInTheDocument();
    expect(screen.getByLabelText('Скопировать: Вариант 2')).toBeDisabled();
    fireEvent.click(screen.getByLabelText('Открыта ученикам'));
    await waitFor(() => expect(mockApi.setGeometryWorkSharing).toHaveBeenCalledWith(WID, { public: true, groups: [] }));
    expect(onChange).toHaveBeenCalledWith({ public: true, groups: [] });
    expect(screen.getByText(`student.oipav.ru/w/${WID}?v=2`)).toBeInTheDocument();
    expect(screen.getByLabelText('Скопировать: Вариант 2')).not.toBeDisabled();
  });
});

describe('чертежи ученикам — окно учителя', () => {
  const structure = {
    variants: [
      { items: [{ task: 't1' }, { task: 't2' }] },
      { items: [{ task: 't4' }, { task: 't5' }] },
    ],
    layouts: {},
  };
  const byId = new Map([
    ['t1', { id: 't1', code: 'GEO-303', drawing_view: 'svg', drawing_svg: CUBE_SVG }],
    ['t2', { id: 't2', code: 'GEO-304', geogebra_image_base64: 'pic.png' }],
    ['t4', { id: 't4', code: 'GEO-305', drawing_view: 'svg', drawing_svg: CUBE_SVG }],
    ['t5', { id: 't5', code: 'GEO-306' }],
  ]);
  const renderModal = (props = {}) => render(
    <AntApp>
      <GeometryWorkShareModal
        open
        workId={WID}
        variants={2}
        sharing={{ public: true, groups: [] }}
        structure={structure}
        tasksById={byId}
        drawings={null}
        {...props}
      />
    </AntApp>,
  );

  it('по каждой позиции видно, что получит ученик, с учётом вида чертежа', () => {
    renderModal();
    expect(screen.getByText('Чертежи ученикам')).toBeInTheDocument();
    expect(screen.getByText('Ученик увидит: интерактивный чертёж')).toBeInTheDocument();
    expect(screen.getByText(/Вариант 1: чертёж-картинка — у задачи картинка \(GeoGebra\/PNG\)/)).toBeInTheDocument();
    expect(screen.getByText(/Вариант 2: только условие \(чертежа нет\)/)).toBeInTheDocument();
  });

  it('уровень позиции сохраняется сразу — всем задачам позиции во всех вариантах', async () => {
    mockApi.setGeometryWorkDrawings.mockResolvedValue({});
    const onDrawingsChange = vi.fn();
    renderModal({ onDrawingsChange });
    const select = screen.getAllByLabelText('Задание 1')[0].closest('.ant-select');
    fireEvent.mouseDown(select.querySelector('.ant-select-selector'));
    const option = await waitFor(() => {
      const el = [...document.querySelectorAll('.ant-select-item-option-content')]
        .find((n) => n.textContent === 'Чертёж + шаги построения');
      if (!el) throw new Error('нет варианта');
      return el;
    });
    fireEvent.click(option);
    await waitFor(() => expect(mockApi.setGeometryWorkDrawings).toHaveBeenCalledWith(
      WID, { default: 'live', tasks: { t1: 'steps', t4: 'steps' } },
    ));
    expect(onDrawingsChange).toHaveBeenCalled();
    expect(screen.getByText('Ученик увидит: чертёж + шаги построения')).toBeInTheDocument();
  });
});

describe('кабинет ученика', () => {
  it('открытые работы классу — блок «Работы по геометрии» со ссылкой /w/', async () => {
    mockApi.getMyStereoFeed.mockResolvedValue({ rooms: [], scenes: [], works: [{ id: WID, title: 'Сечения куба', class: 10 }] });
    render(<StudentStereoFeed />);
    const link = await screen.findByText('Сечения куба');
    expect(screen.getByText('Работы по геометрии')).toBeInTheDocument();
    expect(link.closest('a').getAttribute('href')).toBe(`/student/w/${WID}`);
  });
});

describe('сервер', () => {
  it('миграция: public + groups, чтение открытых без входа, откат', () => {
    const src = readFileSync(resolve(__dirname, '../../../pocketbase/pb_migrations/1787600000_geometry_works_public.js'), 'utf8');
    expect(src).toMatch(/"name": "public"/);
    expect(src).toMatch(/"name": "groups"/);
    expect(src).toMatch(/\|\| public = true/);
    expect(src).toMatch(/removeById\("bool_gwork_public"\)/);
  });

  it('хук кабинета отдаёт открытые работы классов', () => {
    const src = readFileSync(resolve(__dirname, '../../../pocketbase/pb_hooks/stereo_feed.pb.js'), 'utf8');
    expect(src).toMatch(/find\("geometry_works", "public = true"/);
    expect(src).toMatch(/works: works/);
  });
});

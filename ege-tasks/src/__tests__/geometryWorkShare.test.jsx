import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render, screen, fireEvent, waitFor, cleanup,
} from '@testing-library/react';
import { App as AntApp } from 'antd';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { stereoDrawingSvg } from '../utils/stereo/dsl';
import { DEFAULT_CAMERA } from '../utils/stereo/camera';

// Ссылка ученику на геометрическую работу (v3.9.284): /w/<id> без входа,
// только условия и чертежи; классам — в кабинет.

const mockApi = vi.hoisted(() => ({
  getPublicGeometryWork: vi.fn(),
  getStudentGeometryTasks: vi.fn(),
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

const WID = 'abcdefghijklmno';
const STRUCTURE = {
  variants: [
    { items: [{ task: 't1' }, { task: 't2' }, { task: 't3' }] },
    { items: [{ task: 't4' }, null, { task: 't5' }] },
  ],
  layouts: {},
};
const CUBE_SVG = stereoDrawingSvg({ body: { kind: 'cube', a: 4 }, ops: [] }, DEFAULT_CAMERA);
const TASKS = [
  { id: 't1', statement_md: 'Найдите длину $AC_1$.', drawing_view: 'svg', drawing_svg: CUBE_SVG },
  { id: 't2', statement_md: 'Задача про пирамиду.', geogebra_image_base64: 'pic.png' },
  { id: 't3', statement_md: 'Задача три.', geogebra_image_base64: 'sol.png', image_role: 'solution' },
  { id: 't4', statement_md: 'Вторая: первая задача.' },
  { id: 't5', statement_md: 'Вторая: третья задача.' },
];

afterEach(cleanup);
beforeEach(() => {
  Object.values(mockApi).forEach((f) => f.mockClear?.());
  mockApi.getPublicGeometryWork.mockReset();
  mockApi.getStudentGeometryTasks.mockReset();
  mockApi.setGeometryWorkSharing.mockReset();
  mockApi.getTeachingGroups.mockReset();
  mockApi.getMyStereoFeed.mockReset();
  _resetStereoGroups();
  localStorage.clear();
  mockApi.getTeachingGroups.mockResolvedValue([{ id: 'g7', name: '7 Б' }]);
  mockApi.getPublicGeometryWork.mockResolvedValue({ id: WID, title: 'Сечения куба', class: 10, structure: STRUCTURE });
  mockApi.getStudentGeometryTasks.mockResolvedValue(TASKS);
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

  it('ученику задачи запрашиваются без ответа и решения', async () => {
    mockChunked.getFullListByOr.mockResolvedValue([]);
    await geometryApi.getStudentGeometryTasks(['t1', 't2']);
    const { fields } = mockChunked.getFullListByOr.mock.calls[0][3];
    expect(fields).toContain('statement_md');
    for (const f of ['answer', 'solution_md', 'hints', 'solution_files']) expect(fields.split(',')).not.toContain(f);
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
    mockApi.getPublicGeometryWork.mockResolvedValue(null);
    render(<StudentGeometryWork id={WID} />);
    expect(await screen.findByText('Работа недоступна')).toBeInTheDocument();
    expect(mockApi.getStudentGeometryTasks).not.toHaveBeenCalled();
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

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render, screen, fireEvent, waitFor, cleanup,
} from '@testing-library/react';
import { App as AntApp } from 'antd';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createRequire } from 'module';

// Показ условий обычной работы ученикам (v3.9.306): /r/<id> без входа и без
// выдачи — только условия; классам — в кабинет; к уроку — пункт work_view.

const mockApi = vi.hoisted(() => ({
  getShownWork: vi.fn(),
  getShownWorkVariants: vi.fn(),
  getShownTasks: vi.fn(),
  getShownTaskImages: vi.fn(),
  getTaskImageUrl: vi.fn((t) => (t.image ? `https://pb/files/${t.id}/${t.image}` : '')),
  getTaskImageRecordUrl: vi.fn((r) => `https://pb/img/${r.id}/${r.file}`),
  setWorkShowSharing: vi.fn(),
  getVariantsByWorks: vi.fn(),
  getTeachingGroups: vi.fn(),
  getMyStereoFeed: vi.fn(),
}));
vi.mock('../shared/services/pocketbase', () => ({ api: mockApi, default: {} }));

const mockChunked = vi.hoisted(() => ({ getFullListByOr: vi.fn() }));
vi.mock('../shared/services/pb/chunked.js', () => mockChunked);

// eslint-disable-next-line import/first
import {
  showLink, showFromLocation, variantTaskIds, pickVariant,
} from '../utils/workShowLink';
// eslint-disable-next-line import/first
import StudentWorkShow from '../components/student/StudentWorkShow';
// eslint-disable-next-line import/first
import WorkShowPanel from '../components/worksheet/WorkShowPanel';
// eslint-disable-next-line import/first
import StudentStereoFeed from '../components/student/StudentStereoFeed';
// eslint-disable-next-line import/first
import { _resetStereoGroups } from '../components/stereo/StereoGroupsSelect';
// eslint-disable-next-line import/first
import { worksApi } from '../shared/services/pb/works';
// eslint-disable-next-line import/first
import { OPENABLE_TYPES, materialPath } from '../utils/lessonMaterials';

const require = createRequire(import.meta.url);
const lessonsLib = require('../../../pocketbase/pb_hooks/lessons_feed_lib.js');

const WID = 'abcdefghijklmno';
const VARIANTS = [
  { id: 'v1', number: 1, tasks: ['t1', 't2', 't3'], order: [{ taskId: 't3', position: 0 }, { taskId: 't1', position: 1 }, { taskId: 't2', position: 2 }] },
  { id: 'v2', number: 2, tasks: ['t4', 't5'], order: [] },
];
const TASKS = [
  { id: 't1', statement_md: 'Первая задача: $2+2$.' },
  { id: 't2', statement_md: 'Вторая задача с рисунком.', image: 'pic.png', has_image: true },
  { id: 't3', statement_md: 'Третья задача ![image](https://ege.sdamgia.ru/get_file?id=777).' },
  { id: 't4', statement_md: 'Вар. 2: первая.' },
  { id: 't5', statement_md: 'Вар. 2: вторая.' },
];

afterEach(cleanup);
beforeEach(() => {
  Object.values(mockApi).forEach((f) => f.mockReset?.());
  mockApi.getTaskImageUrl.mockImplementation((t) => (t.image ? `https://pb/files/${t.id}/${t.image}` : ''));
  mockApi.getTaskImageRecordUrl.mockImplementation((r) => `https://pb/img/${r.id}/${r.file}`);
  mockApi.getShownWork.mockResolvedValue({ id: WID, title: 'Контрольная по степеням', class: 9, show_open: true });
  mockApi.getShownWorkVariants.mockResolvedValue(VARIANTS);
  mockApi.getShownTasks.mockResolvedValue(TASKS);
  mockApi.getShownTaskImages.mockResolvedValue([
    { id: 'img1', task: 't3', file: 'local.png', sdamgia_file_id: '777', role: 'condition' },
  ]);
  mockApi.getTeachingGroups.mockResolvedValue([{ id: 'g7', name: '9 А' }]);
  mockChunked.getFullListByOr.mockReset();
  _resetStereoGroups();
  localStorage.clear();
});

describe('ссылка и порядок задач', () => {
  it('ссылка общая и на вариант (по номеру варианта), разбор адреса', () => {
    expect(showLink(WID).full).toBe(`https://student.oipav.ru/r/${WID}`);
    expect(showLink(WID, 2).short).toBe(`student.oipav.ru/r/${WID}?v=2`);
    expect(showFromLocation(`/r/${WID}`)).toEqual({ id: WID, variant: null });
    expect(showFromLocation(`/student/r/${WID}`, '?v=3')).toEqual({ id: WID, variant: 3 });
    expect(showFromLocation(`/r/${WID}`, '?v=0')).toEqual({ id: WID, variant: null });
    expect(showFromLocation(`/w/${WID}`)).toBeNull(); // геометрическая работа
    expect(showFromLocation(`/student/${WID}`)).toBeNull(); // код выдачи
  });

  it('порядок — по order, задачи без позиции в конце; без order — как в tasks', () => {
    expect(variantTaskIds(VARIANTS[0])).toEqual(['t3', 't1', 't2']);
    expect(variantTaskIds(VARIANTS[1])).toEqual(['t4', 't5']);
    expect(variantTaskIds({ tasks: ['a', 'b', 'c'], order: [{ taskId: 'c', position: 0 }] })).toEqual(['c', 'a', 'b']);
    expect(variantTaskIds(null)).toEqual([]);
    expect(pickVariant(VARIANTS, 2)?.id).toBe('v2');
    expect(pickVariant(VARIANTS, 5)).toBeNull();
  });

  it('ученику задачи запрашиваются без ответа и решения', async () => {
    mockChunked.getFullListByOr.mockResolvedValue([]);
    await worksApi.getShownTasks(['t1', 't2', 't1']);
    const [collection, , ids, { fields }] = mockChunked.getFullListByOr.mock.calls[0];
    expect(collection).toBe('tasks');
    expect(ids).toEqual(['t1', 't2']);
    expect(fields).toContain('statement_md');
    for (const f of ['answer', 'solution_md', 'explanation_md', 'criteria_md']) expect(fields.split(',')).not.toContain(f);
  });

  it('картинки — только условия (роль condition)', async () => {
    mockChunked.getFullListByOr.mockResolvedValue([
      { id: 'a', task: 't1', role: 'condition' },
      { id: 'b', task: 't1', role: 'solution' },
      { id: 'c', task: 't1', role: '' },
    ]);
    const list = await worksApi.getShownTaskImages(['t1']);
    expect(list.map((r) => r.id)).toEqual(['a', 'c']);
  });
});

describe('страница ученика /r/<id>', () => {
  it('общая ссылка: выбор варианта, затем условия по порядку — без поля ответа', async () => {
    const { container } = render(<StudentWorkShow id={WID} />);
    expect(await screen.findByText('Контрольная по степеням')).toBeInTheDocument();
    expect(screen.getByText(/Выберите свой вариант/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Вариант 1'));
    expect(await screen.findByText(/Третья задача/)).toBeInTheDocument();
    const order = [...container.querySelectorAll('.sgw-task__body')].map((n) => n.textContent.slice(0, 6));
    expect(order).toEqual(['Третья', 'Первая', 'Вторая']);
    expect(container.querySelector('input, textarea')).toBeNull();
    expect(screen.queryByText(/Отправить/)).toBeNull();
    // картинка задачи и подмена ссылки «Решу» на свой файл
    const srcs = [...container.querySelectorAll('img')].map((i) => i.getAttribute('src'));
    expect(srcs).toContain('https://pb/files/t2/pic.png');
    expect(srcs).toContain('https://pb/img/img1/local.png');
    expect(localStorage.getItem(`workshow.variant.${WID}`)).toBe('1');
    fireEvent.click(screen.getByText('сменить вариант'));
    expect(screen.getByText(/Выберите свой вариант/)).toBeInTheDocument();
  });

  it('ссылка варианта: сразу его задания, выбора нет', async () => {
    render(<StudentWorkShow id={WID} variant={2} />);
    expect(await screen.findByText('Вар. 2: первая.')).toBeInTheDocument();
    expect(screen.queryByText(/Выберите свой вариант/)).toBeNull();
    expect(screen.queryByText('сменить вариант')).toBeNull();
    expect(screen.getByText('Вариант 2')).toBeInTheDocument();
  });

  it('один вариант — без выбора и без метки варианта', async () => {
    mockApi.getShownWorkVariants.mockResolvedValue([VARIANTS[1]]);
    render(<StudentWorkShow id={WID} />);
    expect(await screen.findByText('Вар. 2: вторая.')).toBeInTheDocument();
    expect(screen.queryByText(/Выберите свой вариант/)).toBeNull();
    expect(screen.queryByText('Вариант 2')).toBeNull();
  });

  it('ссылка на вариант, которого уже нет, — выбор из оставшихся', async () => {
    render(<StudentWorkShow id={WID} variant={7} />);
    expect(await screen.findByText(/Выберите свой вариант/)).toBeInTheDocument();
  });

  it('закрытая работа — понятное сообщение, задачи не грузятся', async () => {
    mockApi.getShownWork.mockResolvedValue(null);
    render(<StudentWorkShow id={WID} />);
    expect(await screen.findByText('Работа недоступна')).toBeInTheDocument();
    expect(mockApi.getShownTasks).not.toHaveBeenCalled();
  });
});

describe('панель «Показ условий» у учителя', () => {
  it('открыть — сохраняется сразу, ссылки по вариантам', async () => {
    mockApi.getVariantsByWorks.mockResolvedValue([{ id: 'v2', number: 2 }, { id: 'v1', number: 1 }]);
    mockApi.setWorkShowSharing.mockResolvedValue({ show_open: true, show_groups: [] });
    const onChange = vi.fn();
    render(
      <AntApp>
        <WorkShowPanel work={{ id: WID, show_open: false, show_groups: [] }} canEdit onChange={onChange} />
      </AntApp>,
    );
    expect(await screen.findByLabelText('Скопировать: Вариант 2')).toBeDisabled();
    expect(screen.getByText(/Ссылки заработают/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Условия открыты ученикам'));
    await waitFor(() => expect(mockApi.setWorkShowSharing).toHaveBeenCalledWith(WID, { open: true, groups: [] }));
    expect(onChange).toHaveBeenCalledWith({ show_open: true, show_groups: [] });
    expect(screen.getByText(`student.oipav.ru/r/${WID}?v=2`)).toBeInTheDocument();
    expect(screen.getByLabelText('Скопировать: Вариант 2')).not.toBeDisabled();
  });

  it('без права правки переключатель недоступен', async () => {
    mockApi.getVariantsByWorks.mockResolvedValue([{ id: 'v1', number: 1 }]);
    render(
      <AntApp>
        <WorkShowPanel work={{ id: WID, show_open: true, show_groups: [] }} canEdit={false} />
      </AntApp>,
    );
    expect(await screen.findByText(`student.oipav.ru/r/${WID}`)).toBeInTheDocument();
    expect(screen.getByLabelText('Условия открыты ученикам')).toBeDisabled();
  });
});

describe('кабинет ученика и уроки', () => {
  it('открытые классу работы — блок «Задания от учителя» со ссылкой /r/', async () => {
    mockApi.getMyStereoFeed.mockResolvedValue({
      rooms: [], scenes: [], works: [], shows: [{ id: WID, title: 'Контрольная по степеням', class: 9 }],
    });
    render(<StudentStereoFeed />);
    const link = await screen.findByText('Контрольная по степеням');
    expect(screen.getByText('Задания от учителя')).toBeInTheDocument();
    expect(link.closest('a').getAttribute('href')).toBe(`/student/r/${WID}`);
  });

  it('урок: work_view уходит ученику пунктом show с id работы', () => {
    const out = lessonsLib.projectItems([
      { type: 'work_view', id: WID, title: 'Разбор', role: 'homework', due: 'next' },
      { type: 'work', id: WID, title: 'Учительская' },
    ], false);
    expect(out).toEqual([{ kind: 'show', role: 'homework', due: 'next', title: 'Разбор', work_id: WID }]);
  });

  it('учителю work_view открывается в редакторе работы', () => {
    expect(OPENABLE_TYPES.has('work_view')).toBe(true);
    expect(materialPath(WID, 'work_view')).toBe(`/app/works/${WID}/edit`);
  });
});

describe('сервер', () => {
  it('миграция: два необязательных поля, правила не трогаются, откат', () => {
    const src = readFileSync(resolve(__dirname, '../../../pocketbase/pb_migrations/1788200000_work_show.js'), 'utf8');
    expect(src).toMatch(/"name": "show_open"/);
    expect(src).toMatch(/"name": "show_groups"/);
    expect(src).not.toMatch(/\.(listRule|viewRule|createRule|updateRule|deleteRule)\s*=/);
    expect(src).toMatch(/removeById\("bool_work_show_open"\)/);
  });

  it('хук кабинета ищет открытые работы по show_groups', () => {
    const src = readFileSync(resolve(__dirname, '../../../pocketbase/pb_hooks/stereo_feed.pb.js'), 'utf8');
    expect(src).toMatch(/find\("works", "show_open = true", "-updated", 100, "show_groups"\)/);
    expect(src).toMatch(/shows: shows/);
    expect(src).toMatch(/field \+ "\.id \?= /); // мульти-relation — только через .id
  });
});

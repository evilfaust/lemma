import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from 'antd';
import WorkLessonLinks from '../components/worksheet/WorkLessonLinks';

const { api, auth } = vi.hoisted(() => ({
  api: Object.fromEntries([
    'getLessonsByMaterialId', 'getLessons', 'getLesson', 'updateLesson', 'getSessionsByWork',
    'getSessionsByMCTest', 'getSessionsByIds', 'createSession', 'createMCTestSession',
    'getWork', 'setWorkShowSharing', 'getGeometryWork', 'setGeometryWorkSharing',
  ].map(key => [key, vi.fn()])),
  auth: { canEdit: true },
}));
vi.mock('../services/pocketbase', () => ({ api }));
vi.mock('../contexts/AuthContext', () => ({ useOptionalAuth: () => auth }));

let lesson;
const file = { type: 'material', id: 'file1', title: 'Конспект', visible: true };
const renderLinks = (props = {}) => render(<App><WorkLessonLinks workId="work1" workTitle="Производные" {...props} /></App>);
const openPicker = async () => {
  const button = await screen.findByRole('button', { name: /Прикрепить к уроку/ });
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);
  await screen.findByText(/10 А · Правила/);
};
const choose = async () => {
  await openPicker();
  fireEvent.click(screen.getByRole('button', { name: 'Прикрепить', exact: true }));
};
const commit = async () => {
  fireEvent.click(await screen.findByRole('button', { name: 'Добавить в урок' }));
  await waitFor(() => expect(api.updateLesson).toHaveBeenCalled());
};

beforeEach(() => {
  vi.resetAllMocks();
  auth.canEdit = true;
  lesson = {
    id: 'lesson1', title: 'Правила', date_plan: '2026-10-31T09:00:00', status: 'planned',
    materials: [file], expand: { group: { id: 'g1', name: '10 А', student_schedule: true } },
  };
  api.getLessons.mockImplementation(async () => [structuredClone(lesson)]);
  api.getLesson.mockImplementation(async () => structuredClone(lesson));
  api.getLessonsByMaterialId.mockImplementation(async () => JSON.stringify(lesson.materials).includes('work1') ? [structuredClone(lesson)] : []);
  api.updateLesson.mockImplementation(async (id, patch) => { lesson = { ...lesson, ...patch }; return lesson; });
  api.getSessionsByWork.mockResolvedValue([{ id: 'session1', work: 'work1', is_open: true }]);
  api.getSessionsByMCTest.mockResolvedValue([]);
  api.getSessionsByIds.mockResolvedValue([]);
  api.getWork.mockResolvedValue({ id: 'work1', show_open: false, show_groups: ['g2'] });
  api.setWorkShowSharing.mockResolvedValue({ show_open: true, show_groups: ['g2'] });
});
afterEach(cleanup);

describe('прикрепление работы из её карточки', () => {
  it('онлайн: берёт открытую выдачу и сохраняет материалы, добавленные после открытия окна', async () => {
    renderLinks();
    await choose();
    const later = { type: 'text', text: 'Добавлено в календаре' };
    lesson.materials.push(later);
    await commit();
    expect(api.updateLesson).toHaveBeenCalledWith('lesson1', { materials: [file, later, {
      type: 'work', id: 'work1', title: 'Производные', deliver: 'online', session: 'session1', role: 'class',
    }] });
    expect(api.createSession).not.toHaveBeenCalled();
    await screen.findByText(/Правила · Решать онлайн/);
  });

  it('не открывает закрытую бумажную выдачу — создаёт новую онлайн', async () => {
    api.getSessionsByWork.mockResolvedValue([{ id: 'paper', is_open: false }]);
    api.createSession.mockResolvedValue({ id: 'newSession' });
    renderLinks();
    await choose();
    await commit();
    expect(api.createSession).toHaveBeenCalledWith({ work: 'work1', is_open: true, student_title: 'Производные' });
    expect(lesson.materials[1].session).toBe('newSession');
  });

  it('только условия: открывает показ, сохраняет классы и ДЗ к следующему уроку', async () => {
    const onWorkChange = vi.fn();
    renderLinks({ onWorkChange });
    await choose();
    fireEvent.click(screen.getByRole('radio', { name: /Только условия/ }));
    fireEvent.click(screen.getByText('ДЗ к след.'));
    await commit();
    expect(api.setWorkShowSharing).toHaveBeenCalledWith('work1', { open: true, groups: ['g2'] });
    expect(onWorkChange).toHaveBeenCalledWith({ show_open: true, show_groups: ['g2'] });
    expect(lesson.materials[1]).toMatchObject({ deliver: 'show', role: 'homework', due: 'next' });
    expect(api.createSession).not.toHaveBeenCalled();
  });

  it('при ошибке открытия условий не сохраняет недоступную ученику работу', async () => {
    api.setWorkShowSharing.mockRejectedValue(new Error('Нет доступа'));
    renderLinks();
    await choose();
    fireEvent.click(screen.getByRole('radio', { name: /Только условия/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Добавить в урок' }));
    await screen.findByText(/Не удалось прикрепить работу к уроку: Нет доступа/);
    expect(api.updateLesson).not.toHaveBeenCalled();
  });

  it.each(['Писали на бумаге', 'Только мне'])('%s: прикрепляет без выдачи и открытия условий', async label => {
    renderLinks();
    await choose();
    fireEvent.click(screen.getByRole('radio', { name: new RegExp(label) }));
    await commit();
    expect(lesson.materials[1]).toEqual({ type: 'work', id: 'work1', title: 'Производные', ...(label === 'Писали на бумаге' ? { deliver: 'paper' } : {}) });
    expect(api.getSessionsByWork).not.toHaveBeenCalled();
    expect(api.setWorkShowSharing).not.toHaveBeenCalled();
  });

  it('урок без ученического расписания: привязка только учителю', async () => {
    lesson.expand.group.student_schedule = false;
    renderLinks();
    await choose();
    await waitFor(() => expect(api.updateLesson).toHaveBeenCalled());
    expect(lesson.materials[1]).toEqual({ type: 'work', id: 'work1', title: 'Производные' });
    expect(api.createSession).not.toHaveBeenCalled();
  });

  it('не дублирует работу, прикреплённую в календаре после открытия окна', async () => {
    renderLinks();
    await choose();
    lesson.materials.push({ type: 'work_view', id: 'work1' });
    fireEvent.click(screen.getByRole('button', { name: 'Добавить в урок' }));
    await screen.findByText('Работа уже в этом уроке');
    expect(api.updateLesson).not.toHaveBeenCalled();
    expect(api.getSessionsByWork).not.toHaveBeenCalled();
  });

  it('открепление удаляет старую ссылку на выдачу и сохраняет свежие материалы', async () => {
    lesson.materials.push({ type: 'session', id: 'session1' });
    api.getSessionsByIds.mockResolvedValue([{ id: 'session1', work: 'work1' }]);
    api.getLessonsByMaterialId.mockImplementation(async () => [structuredClone(lesson)]);
    const { container } = renderLinks();
    await screen.findByText(/Правила · Решать онлайн/);
    const later = { type: 'text', text: 'Новое ДЗ' };
    lesson.materials.push(later);
    fireEvent.click(container.querySelector('.ant-tag-close-icon'));
    await waitFor(() => expect(api.updateLesson).toHaveBeenCalledWith('lesson1', { materials: [file, later] }));
  });

  it('viewer видит привязку, но не может её изменить', async () => {
    auth.canEdit = false;
    lesson.materials.push({ type: 'work', id: 'work1' });
    const { container } = renderLinks();
    await screen.findByText(/Правила · Только мне/);
    expect(screen.queryByRole('button', { name: /Прикрепить к уроку/ })).not.toBeInTheDocument();
    expect(container.querySelector('.ant-tag-close-icon')).toBeNull();
  });

  it('прикрепляет тест с его собственной выдачей', async () => {
    api.createMCTestSession.mockResolvedValue({ id: 'testSession' });
    renderLinks({ materialType: 'mc_test' });
    await choose();
    await commit();
    expect(api.createMCTestSession).toHaveBeenCalledWith('work1', { student_title: 'Производные' });
    expect(lesson.materials[1]).toMatchObject({ type: 'mc_test', deliver: 'online', session: 'testSession' });
    expect(api.createSession).not.toHaveBeenCalled();
  });

  it('геометрия использует показ условий и сохраняет группы доступа', async () => {
    api.getGeometryWork.mockResolvedValue({ public: false, groups: ['g2'] });
    renderLinks({ materialType: 'geometry_work' });
    await choose();
    await commit();
    expect(api.setGeometryWorkSharing).toHaveBeenCalledWith('work1', { public: true, groups: ['g2'] });
    expect(lesson.materials[1]).toMatchObject({ type: 'geometry_work', deliver: 'show' });
    expect(api.createSession).not.toHaveBeenCalled();
  });

  it('предупреждает о скрытом уроке и не открывает его автоматически', async () => {
    lesson.hidden_from_students = true;
    renderLinks();
    await choose();
    expect(screen.getByText(/Работа появится у них, когда вы откроете урок/)).toBeInTheDocument();
    await commit();
    expect(api.updateLesson.mock.calls[0][1]).not.toHaveProperty('hidden_from_students');
  });

  it('поиск по классу отсекает чужие результаты, отменённые уроки не предлагаются', async () => {
    api.getLessons.mockResolvedValue([
      lesson, { ...lesson, id: 'lesson2', title: 'Отменённый', status: 'cancelled' },
      { ...lesson, id: 'lesson3', title: 'Иной урок', expand: { group: { name: '11 Б' } } },
    ]);
    renderLinks();
    await openPicker();
    fireEvent.change(screen.getByLabelText('Поиск урока'), { target: { value: '10 А' } });
    expect(screen.queryByText(/Иной урок/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Отменённый/)).not.toBeInTheDocument();
    expect(screen.getByText(/10 А · Правила/)).toBeInTheDocument();
  });
});

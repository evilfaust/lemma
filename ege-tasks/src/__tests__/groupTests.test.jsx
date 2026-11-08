import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { App } from 'antd';
import { groupRosterText, groupTestProgress, groupTestProgressText } from '../utils/groupTests';
import { assignedGroupTests } from '../utils/studentHome';

const api = vi.hoisted(() => ({
  getTeachingGroups: vi.fn(), getGroupTestSessions: vi.fn(), getGroupTestAttempts: vi.fn(),
  getAssignableSessions: vi.fn(), assignSessionToGroup: vi.fn(), getStudentsByGroup: vi.fn(), getCourseStudents: vi.fn(),
  setSessionGroups: vi.fn(),
}));
vi.mock('../shared/services/pocketbase', () => ({ api }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ canEdit: true }) }));
import GroupTestsSection from '../components/workspace/GroupTestsSection';
import CopyGroupButton from '../components/workspace/CopyGroupButton';
import SessionGroupsSelect from '../components/worksheet/SessionGroupsSelect';

const group = { id: 'g11', name: '11 класс', prev_group: 'g10' };
const students = [
  { id: 'b', name: 'Борисов Борис' }, { id: 'a', name: 'Андреева Анна' },
  { id: 'c', name: 'Васильев Виктор' }, { id: 'd', name: 'Громова Галина', external: true },
];
const session = { id: 's1', student_title: 'Субботний тест', is_open: true, groups: ['g11'], created: '2026-10-31', deadline: '2026-10-31T18:00:00' };

describe('список и статусы группы', () => {
  it('список по алфавиту, только имена, без логинов и паролей', () => {
    expect(groupRosterText(group, [...students, { id: 'e', name: ' Долгов\nДмитрий ', username: 'private', password: 'secret' }]))
      .toBe('11 класс\n1. Андреева Анна\n2. Борисов Борис\n3. Васильев Виктор\n4. Громова Галина\n5. Долгов Дмитрий');
  });
  it('сдача/коррекция важнее начатой пересдачи, внешние не считаются не приступившими', () => {
    const p = groupTestProgress(students, [
      { student: 'a', status: 'corrected' }, { student: 'a', status: 'started' },
      { student: 'b', status: 'started' }, { student: 'other', student_name: 'Васильев Виктор', status: 'submitted' },
    ]);
    expect(Object.fromEntries(Object.entries(p).map(([k, list]) => [k, list.map((s) => s.id)])))
      .toEqual({ submitted: ['a'], started: ['b'], untouched: ['c'], external: ['d'] });
    expect(groupTestProgressText(group, session, p)).toContain('Начали, но не отправили (1):\n1. Борисов Борис');
    expect(groupTestProgressText(group, session, p)).toContain('Срок сдачи: 31.10.2026 18:00');
  });
  it('гостя узнаёт только по уникальному полному имени', () => {
    const p = groupTestProgress([...students, { id: 'e', name: 'Борисов Борис' }], [
      { student_name: ' андреева   анна ', status: 'submitted' }, { student_name: 'Борисов Борис', status: 'started' },
    ]);
    expect(p.submitted.map((s) => s.id)).toEqual(['a']);
    expect(p.started).toEqual([]);
    expect(p.untouched.map((s) => s.id)).toEqual(['b', 'e', 'c']);
  });
});

describe('выдача: выбор групп', () => {
  it('сохраняет выбор только по кнопке и возвращает обновлённую выдачу', async () => {
    const onSaved = vi.fn();
    api.setSessionGroups.mockResolvedValue({ ...session, groups: ['g11'] });
    render(<App><SessionGroupsSelect session={{ ...session, groups: [] }} onSaved={onSaved} /></App>);
    fireEvent.mouseDown(screen.getByRole('combobox'));
    fireEvent.click(await screen.findByText('11 класс', { selector: '.ant-select-item-option-content' }));
    expect(api.setSessionGroups).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Сохранить/ }));
    await waitFor(() => expect(api.setSessionGroups).toHaveBeenCalledWith('s1', ['g11']));
    expect(onSaved).toHaveBeenCalledWith({ ...session, groups: ['g11'] });
  });
  it('до миграции сообщает об обновлении базы и не предлагает сохранить', () => {
    const { groups, ...old } = session;
    render(<App><SessionGroupsSelect session={old} onSaved={vi.fn()} /></App>);
    expect(screen.getByText('Назначение будет доступно после обновления базы.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Сохранить/ })).toBeDisabled();
  });
});

describe('главная ученика: назначенные тесты', () => {
  it('сегодня до 18:00, продолжить, просрочка, без срока; сданное и дубли убираются', () => {
    const rows = assignedGroupTests([
      { id: 'none', title: 'Без срока', status: 'untouched' },
      { id: 'today', deadline: '2026-10-31T18:00:00', status: 'started' },
      { id: 'done', status: 'submitted' }, { id: 'today', status: 'untouched' },
      { id: 'late', deadline: '2026-10-30T18:00:00', status: 'untouched' },
    ], '2026-10-31T12:00:00');
    expect(rows.map((r) => r.id)).toEqual(['late', 'today', 'none']);
    expect(rows[0].overdue).toBe(true);
    expect(rows[1]).toMatchObject({ dueLabel: 'Сегодня до 18:00', action: 'Продолжить', overdue: false });
    expect(rows[2]).toMatchObject({ dueLabel: 'Без срока сдачи', action: 'Начать тест' });
  });
});

beforeEach(() => {
  vi.clearAllMocks();
  api.getTeachingGroups.mockResolvedValue([group, { id: 'g10' }]);
  api.getGroupTestSessions.mockResolvedValue([session]);
  api.getGroupTestAttempts.mockResolvedValue([{ student: 'a', status: 'submitted' }]);
  api.getAssignableSessions.mockResolvedValue([{ ...session, id: 'new', groups: ['other'], student_title: 'Новый тест' }]);
  api.assignSessionToGroup.mockResolvedValue({});
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockResolvedValue() } });
});

describe('карточка группы', () => {
  const mount = () => render(<App><GroupTestsSection group={group} students={students} /></App>);
  it('берёт тесты по цепочке лет; перед копированием обновляет статусы', async () => {
    mount();
    await screen.findByText('Не приступали (2)');
    expect(api.getGroupTestSessions).toHaveBeenCalledWith(['g11', 'g10']);
    api.getGroupTestAttempts.mockResolvedValueOnce([{ student: 'a', status: 'submitted' }, { student: 'b', status: 'started' }]);
    fireEvent.click(screen.getByRole('button', { name: /Копировать статусы/ }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled());
    expect(navigator.clipboard.writeText.mock.calls[0][0]).toContain('Начали, но не отправили (1):\n1. Борисов Борис');
  });
  it('ошибка чтения не превращается в «все не приступили»', async () => {
    api.getGroupTestAttempts.mockRejectedValue(new Error('offline'));
    mount();
    await screen.findByText(/Не удалось получить статусы/);
    expect(screen.queryByText(/Не приступали/)).toBeNull();
    expect(screen.getByRole('button', { name: /Копировать статусы/ })).toBeDisabled();
  });
  it('ошибка свежей проверки не копирует устаревшую сводку', async () => {
    mount();
    await screen.findByText('Сдали (1)');
    api.getGroupTestAttempts.mockRejectedValueOnce(new Error('offline'));
    fireEvent.click(screen.getByRole('button', { name: /Копировать статусы/ }));
    await screen.findByText(/Не удалось обновить статусы/);
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
  });
  it('назначает существующую выдачу выбранной группе', async () => {
    mount();
    await screen.findByText('Сдали (1)');
    fireEvent.click(screen.getByRole('button', { name: /Назначить тест/ }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.mouseDown(within(dialog).getByRole('combobox'));
    fireEvent.click(await screen.findByText(/Новый тест/, { selector: '.ant-select-item-option-content' }));
    fireEvent.click(within(dialog).getByRole('button', { name: /^Назначить$/ }));
    await waitFor(() => expect(api.assignSessionToGroup).toHaveBeenCalledWith('new', 'g11'));
  });
  it('копирует состав из карточки, без сетевого запроса', async () => {
    render(<App><CopyGroupButton group={group} students={students} /></App>);
    fireEvent.click(screen.getByRole('button', { name: /Копировать список группы/ }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(groupRosterText(group, students)));
    expect(api.getStudentsByGroup).not.toHaveBeenCalled();
  });
  it('курсы копируют участников курса, а не основной класс', async () => {
    api.getCourseStudents.mockResolvedValue(students);
    render(<App><CopyGroupButton group={{ ...group, kind: 'course' }} /></App>);
    fireEvent.click(screen.getByRole('button', { name: /Копировать список группы/ }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled());
    expect(api.getCourseStudents).toHaveBeenCalledWith('g11', { strict: true });
    expect(api.getStudentsByGroup).not.toHaveBeenCalled();
  });
});

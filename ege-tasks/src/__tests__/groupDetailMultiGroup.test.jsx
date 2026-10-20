/**
 * Карточка группы и ученик нескольких групп (v3.9.386).
 *
 * Баг, с которого всё началось: «Добавить» в карточке группы переводило
 * ученика (прежнее членство молча закрывалось), а «Отвязать» закрывало его
 * ОСНОВНУЮ группу, даже если нажали в другой.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { App as AntApp } from 'antd';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ canEdit: true, canDelete: true, isSuperAdmin: true }),
}));
vi.mock('../components/workspace/CoTeachersSection', () => ({ default: () => null }));
vi.mock('../components/workspace/summer/GroupCampaignsSection', () => ({ default: () => null }));
vi.mock('../components/workspace/course/CourseMembersSection', () => ({ default: () => null }));
vi.mock('../components/students/StudentEditModal', () => ({ default: () => null }));
vi.mock('../components/students/StudentLoginsModal', () => ({ default: () => null }));

const api = {
  getTeachingGroup: vi.fn(),
  getStudentsByGroup: vi.fn(),
  getStudentsForGroupPicker: vi.fn(),
  getMembershipsByYear: vi.fn(),
  getTeachingGroups: vi.fn(),
  addStudentToGroup: vi.fn(),
  removeStudentFromGroup: vi.fn(),
  setStudentGroup: vi.fn(),
  createManualStudent: vi.fn(),
};
vi.mock('../shared/services/pocketbase', () => ({ api }));

const { default: GroupDetail } = await import('../components/workspace/GroupDetail');

const ivan = { id: 'ivan', name: 'Гунько Иван', username: 'gunko.i', teaching_group: 'param' };
const olya = { id: 'olya', name: 'Оля Новая', username: 'olya', teaching_group: '' };
const petya = { id: 'petya', name: 'Петя Ученик', username: 'petya', teaching_group: 'ege' };

function renderGroup(groupId = 'ege') {
  return render(
    <AntApp>
      <MemoryRouter initialEntries={[`/app/groups/${groupId}`]}>
        <Routes>
          <Route path="/app/groups/:groupId" element={<GroupDetail />} />
        </Routes>
      </MemoryRouter>
    </AntApp>,
  );
}

describe('GroupDetail — ученик в нескольких группах', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getTeachingGroups.mockResolvedValue([
      { id: 'ege', name: '11 ЕГЭ' }, { id: 'param', name: 'Параметр' },
    ]);
    api.addStudentToGroup.mockResolvedValue(null);
    api.removeStudentFromGroup.mockResolvedValue(null);
  });

  it('в составе видно, где ещё учится ученик; «Отвязать» убирает только из этой группы', async () => {
    api.getTeachingGroup.mockResolvedValue({ id: 'ege', name: '11 ЕГЭ', year: '2026/2027' });
    api.getStudentsByGroup.mockResolvedValue([ivan, petya]);
    api.getStudentsForGroupPicker.mockResolvedValue([ivan, petya, olya]);
    api.getMembershipsByYear.mockResolvedValue([
      { student: 'ivan', group: 'param', status: 'active' },
      { student: 'ivan', group: 'ege', status: 'active' },
      { student: 'petya', group: 'ege', status: 'active' },
    ]);
    renderGroup('ege');

    expect(await screen.findByText('ещё: Параметр')).toBeInTheDocument();
    const row = screen.getByText('Гунько Иван').closest('.ws-roster__item');
    fireEvent.click(within(row).getByTitle('Отвязать'));
    await waitFor(() => expect(api.removeStudentFromGroup).toHaveBeenCalledWith('ivan', 'ege'));
    expect(api.setStudentGroup).not.toHaveBeenCalled();
  });

  it('добавить ученика другой группы: по умолчанию остаётся и там', async () => {
    api.getTeachingGroup.mockResolvedValue({ id: 'ege', name: '11 ЕГЭ', year: '2026/2027' });
    api.getStudentsByGroup.mockResolvedValue([petya]);
    // Иван: указатель на «Параметр», в «11 ЕГЭ» его уже нет — но он кандидат.
    api.getStudentsForGroupPicker.mockResolvedValue([ivan, petya, olya]);
    api.getMembershipsByYear.mockResolvedValue([
      { student: 'ivan', group: 'param', status: 'active' },
      { student: 'petya', group: 'ege', status: 'active' },
    ]);
    renderGroup('ege');
    await screen.findByText('Петя Ученик');

    fireEvent.click(screen.getByRole('button', { name: /Добавить/ }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.mouseDown(within(dialog).getByRole('combobox'));
    fireEvent.click(await screen.findByText(/Гунько Иван .*сейчас: Параметр/));

    expect(await within(dialog).findByText(/уже занимается в другой группе/)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Оставить и там/)).toBeChecked();

    fireEvent.click(within(dialog).getByRole('button', { name: /Привязать/ }));
    await waitFor(() => expect(api.addStudentToGroup).toHaveBeenCalledWith('ivan', 'ege', { move: false }));
  });

  it('«Перевести сюда» передаёт move', async () => {
    api.getTeachingGroup.mockResolvedValue({ id: 'ege', name: '11 ЕГЭ', year: '2026/2027' });
    api.getStudentsByGroup.mockResolvedValue([]);
    api.getStudentsForGroupPicker.mockResolvedValue([ivan]);
    api.getMembershipsByYear.mockResolvedValue([{ student: 'ivan', group: 'param', status: 'active' }]);
    renderGroup('ege');

    fireEvent.click(await screen.findByRole('button', { name: /Добавить учеников/ }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.mouseDown(within(dialog).getByRole('combobox'));
    fireEvent.click(await screen.findByText(/Гунько Иван/, { selector: '.ant-select-item-option-content' }));
    fireEvent.click(await within(dialog).findByLabelText(/Перевести сюда/));
    fireEvent.click(within(dialog).getByRole('button', { name: /Привязать/ }));
    await waitFor(() => expect(api.addStudentToGroup).toHaveBeenCalledWith('ivan', 'ege', { move: true }));
  });

  it('новичок без группы — без вопроса', async () => {
    api.getTeachingGroup.mockResolvedValue({ id: 'ege', name: '11 ЕГЭ', year: '2026/2027' });
    api.getStudentsByGroup.mockResolvedValue([petya]);
    api.getStudentsForGroupPicker.mockResolvedValue([petya, olya]);
    api.getMembershipsByYear.mockResolvedValue([]);
    renderGroup('ege');
    await screen.findByText('Петя Ученик');

    fireEvent.click(screen.getByRole('button', { name: /Добавить/ }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.mouseDown(within(dialog).getByRole('combobox'));
    fireEvent.click(await screen.findByText(/Оля Новая/, { selector: '.ant-select-item-option-content' }));
    expect(within(dialog).queryByText(/другой группе/)).toBeNull();
  });
});

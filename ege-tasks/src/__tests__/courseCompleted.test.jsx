import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { studentFacing } from '../utils/homework';

// «Курс завершён» и ДЗ в карточке урока (v3.9.293).

const mockApi = vi.hoisted(() => ({ getLessons: vi.fn() }));
vi.mock('../shared/services/pocketbase', () => ({ api: mockApi, default: {} }));

// eslint-disable-next-line import/first
import useLessonHomework from '../components/workspace/calendar/useLessonHomework';
// eslint-disable-next-line import/first
import { isCompletedCourse } from '../shared/services/pb/groups';

describe('кому видны уроки группы', () => {
  it('курс — пока не завершён, класс — по переключателю', () => {
    expect(studentFacing({ kind: 'course' })).toBe(true);
    expect(studentFacing({ kind: 'course', completed: true })).toBe(false);
    expect(studentFacing({ kind: 'class' })).toBe(false);
    expect(studentFacing({ kind: 'class', student_schedule: true })).toBe(true);
    // «завершён» у класса ничего не значит
    expect(studentFacing({ student_schedule: true, completed: true })).toBe(true);
    expect(studentFacing(null)).toBe(false);
  });

  it('из пикеров уходит только завершённый курс', () => {
    expect(isCompletedCourse({ kind: 'course', completed: true })).toBe(true);
    expect(isCompletedCourse({ kind: 'course' })).toBe(false);
    expect(isCompletedCourse({ kind: 'class', completed: true })).toBe(false);
  });
});

describe('ДЗ в карточке урока (useLessonHomework)', () => {
  const group = { id: 'g1', kind: 'class', student_schedule: true };
  const L = (id, date, materials = [], extra = {}) => ({
    id, group: 'g1', owner: 't1', status: 'planned', date_plan: date, materials, expand: { group }, ...extra,
  });
  const prev = L('prev', '2026-10-01T07:15:00Z', [
    { type: 'text', text: 'Задача 5', role: 'homework', due: 'next' },
    { type: 'material', title: 'Ключи', role: 'homework', due: 'next', visible: false },
  ]);
  const self = L('self', '2026-10-03T07:15:00Z', [
    { type: 'text', text: '№ 12', role: 'homework', due: 'next' },
    { type: 'text', text: 'Прочитать §3', role: 'homework' },
    { type: 'work', id: 'w1', title: 'Работа учителя' },
  ]);
  const later = L('later', '2026-10-08T07:15:00Z');

  beforeEach(() => {
    mockApi.getLessons.mockReset();
    mockApi.getLessons.mockResolvedValue([prev, self, later]);
  });

  it('своё ДЗ, куда уйдёт «к след.», что пришло с прошлого урока (без скрытого)', async () => {
    const { result } = renderHook(() => useLessonHomework(self));
    expect(result.current.loading).toBe(true);
    expect(result.current.own.map((m) => m.text)).toEqual(['№ 12', 'Прочитать §3']);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.next.id).toBe('later');
    expect(result.current.incoming.map(({ item }) => item.text)).toEqual(['Задача 5']);
    expect(mockApi.getLessons.mock.calls[0][0].groupId).toBe('g1');
  });

  it('группа без расписания для учеников — ничего не грузим и не показываем', () => {
    const closed = { ...self, expand: { group: { id: 'g1', kind: 'class' } } };
    const { result } = renderHook(() => useLessonHomework(closed));
    expect(result.current).toEqual({ own: [], next: null, incoming: [], loading: false });
    expect(mockApi.getLessons).not.toHaveBeenCalled();
  });
});

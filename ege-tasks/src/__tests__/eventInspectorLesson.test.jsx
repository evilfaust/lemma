import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../shared/services/pocketbase', () => ({
  api: { getLessonNote: () => Promise.resolve(null) },
}));

// eslint-disable-next-line import/first
import EventInspector from '../components/workspace/calendar/EventInspector';
// eslint-disable-next-line import/first
import { lessonToEvent } from '../components/workspace/calendar/calendarUtils';

const lesson = (over = {}) => ({
  id: 'l1',
  title: 'Интенсив 11',
  date_plan: '2026-09-21 10:15:00',
  time_slot: '1-4',
  group: 'g1',
  status: 'planned',
  materials: [],
  expand: { group: { id: 'g1', name: '11 БАЗА' } },
  ...over,
});

const renderInspector = (l, props = {}) => {
  const onToggleLessonDone = vi.fn();
  const utils = render(
    <EventInspector
      event={lessonToEvent(l)}
      onClose={() => {}}
      onEdit={() => {}}
      onDelete={() => {}}
      onToggleTodo={() => {}}
      onToggleLessonDone={onToggleLessonDone}
      onOpenWork={() => {}}
      onOpenNote={() => {}}
      canEdit
      canDelete
      {...props}
    />,
  );
  return { ...utils, onToggleLessonDone };
};

describe('EventInspector — статус урока', () => {
  it('кружок статуса зовёт переключатель с записью урока', () => {
    const { container, onToggleLessonDone } = renderInspector(lesson());
    const btn = container.querySelector('.ci-done');
    expect(btn.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(btn);
    expect(onToggleLessonDone).toHaveBeenCalledWith(expect.objectContaining({ id: 'l1' }));
  });

  it('у проведённого урока кружок отмечен и возвращает в запланированные', () => {
    const { container } = renderInspector(lesson({ status: 'done' }));
    const btn = container.querySelector('.ci-done');
    expect(btn.className).toContain('is-on');
    expect(btn.getAttribute('aria-label')).toBe('Вернуть в запланированные');
  });

  it('у отменённого урока и без права правки кружка нет', () => {
    const a = renderInspector(lesson({ status: 'cancelled' }));
    expect(a.container.querySelector('.ci-done')).toBeNull();
    const b = renderInspector(lesson(), { canEdit: false });
    expect(b.container.querySelector('.ci-done')).toBeNull();
  });

  it('посещаемость осталась главной кнопкой ряда действий', () => {
    renderInspector(lesson());
    expect(screen.getByRole('button', { name: /Отметить посещаемость/ })).toBeInTheDocument();
    // Длинной текстовой кнопки статуса в ряду нет — она не помещалась в панель.
    expect(screen.queryByRole('button', { name: /Провёл|Вернуть в запланированные/ })).toBeNull();
  });
});

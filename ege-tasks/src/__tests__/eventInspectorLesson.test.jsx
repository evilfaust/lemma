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
  it('кнопка «Провёл» зовёт переключатель с записью урока', () => {
    const { onToggleLessonDone } = renderInspector(lesson());
    fireEvent.click(screen.getByRole('button', { name: /Провёл/ }));
    expect(onToggleLessonDone).toHaveBeenCalledWith(expect.objectContaining({ id: 'l1' }));
  });

  it('у проведённого урока кнопка возвращает в запланированные', () => {
    renderInspector(lesson({ status: 'done' }));
    expect(screen.getByRole('button', { name: /Вернуть в запланированные/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Провёл/ })).toBeNull();
  });

  it('у отменённого урока и без права правки кнопки нет', () => {
    renderInspector(lesson({ status: 'cancelled' }));
    expect(screen.queryByRole('button', { name: /Провёл/ })).toBeNull();
    renderInspector(lesson(), { canEdit: false });
    expect(screen.queryByRole('button', { name: /Провёл/ })).toBeNull();
  });

  it('посещаемость осталась отдельной кнопкой', () => {
    renderInspector(lesson());
    expect(screen.getByRole('button', { name: /Посещаемость/ })).toBeInTheDocument();
  });
});

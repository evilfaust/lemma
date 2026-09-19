import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WeekByPairs from '../components/workspace/calendar/WeekByPairs';
import { CalendarContext } from '../components/workspace/calendar/CalendarContext';
import { lessonToEvent } from '../components/workspace/calendar/calendarUtils';
import { slotPairIndexes, PAIRS } from '../components/workspace/lessonTime';

// Понедельник 21 сентября 2026.
const MONDAY = '2026-09-21';
const lesson = (over = {}) => ({
  id: 'l1',
  title: 'Интенсив 11',
  date_plan: `${MONDAY} 10:15:00`,
  time_slot: '1-4',
  group: 'g1',
  status: 'planned',
  expand: { group: { id: 'g1', name: '11 БАЗА' } },
  ...over,
});

const renderWeek = (lessons, ctx = {}) => render(
  <CalendarContext.Provider value={{
    onSelectEvent: () => {}, onCreateInSlot: () => {}, onToggleTodo: () => {},
    onToggleLessonDone: () => {}, canEdit: true, ...ctx,
  }}>
    <WeekByPairs date={new Date(`${MONDAY}T12:00:00`)} events={lessons.map((l) => lessonToEvent(l))} />
  </CalendarContext.Provider>,
);

// Блок урока в сетке: у него inline gridRow «строка / строка».
const blockRows = (el) => el.style.gridRow;

describe('slotPairIndexes', () => {
  it('интенсив занимает все пары диапазона', () => {
    expect(slotPairIndexes('1-4')).toEqual([1, 4]);
    expect(slotPairIndexes('2-3')).toEqual([2, 3]);
  });

  it('одна пара и полупара — одна строка', () => {
    expect(slotPairIndexes('2')).toEqual([2, 2]);
    expect(slotPairIndexes('2a')).toEqual([2, 2]);
    expect(slotPairIndexes('2b')).toEqual([2, 2]);
    expect(slotPairIndexes('0')).toEqual([0, 0]);
  });

  it('пустой или неизвестный код — null', () => {
    expect(slotPairIndexes('')).toBeNull();
    expect(slotPairIndexes('9')).toBeNull();
  });
});

describe('WeekByPairs', () => {
  it('интенсив «1-4» растягивается на четыре строки сетки', () => {
    const { container } = renderWeek([lesson()]);
    const block = container.querySelector('.cw-lesson');
    // Пары индексируются с нуля, строки grid — с единицы: 1-я пара = строка 2.
    expect(blockRows(block)).toBe('2 / 6');
    expect(block.className).toContain('is-tall');
    expect(screen.getByText(/10:15–17:35/)).toBeInTheDocument();
  });

  it('обычный урок занимает одну строку', () => {
    const { container } = renderWeek([lesson({ time_slot: '2' })]);
    const block = container.querySelector('.cw-lesson');
    expect(blockRows(block)).toBe('3 / 4');
    expect(block.className).not.toContain('is-tall');
  });

  it('ячейки под интенсивом не предлагают создать урок', () => {
    const { container } = renderWeek([lesson()]);
    const empty = [...container.querySelectorAll('.cw-cell.is-empty')];
    // Колонку понедельника берём у самого блока: первый день недели зависит
    // от локали dayjs (в приложении — ru, в тесте — дефолтная).
    const col = container.querySelector('.cw-lesson').style.gridColumn;
    const mondayEmpty = empty.filter((c) => c.style.gridColumn === col);
    expect(mondayEmpty.map((c) => c.style.gridRow).sort())
      .toEqual(['1', '6', '7', '8'].sort());
    expect(mondayEmpty.length).toBe(PAIRS.length - 4);
  });

  it('два урока в одну пару делят колонку на дорожки', () => {
    const { container } = renderWeek([
      lesson({ id: 'a', time_slot: '2' }),
      lesson({ id: 'b', time_slot: '2', title: 'Вторая группа' }),
    ]);
    const blocks = [...container.querySelectorAll('.cw-lesson')];
    expect(blocks).toHaveLength(2);
    expect(blocks[0].style.width).toContain('50%');
    expect(blocks[1].style.marginLeft).toContain('50%');
  });

  it('старый урок без time_slot встаёт по времени старта', () => {
    const { container } = renderWeek([lesson({ time_slot: '', date_plan: `${MONDAY} 14:05:00` })]);
    expect(blockRows(container.querySelector('.cw-lesson'))).toBe('4 / 5');
  });

  it('кнопка «провёл» на блоке переключает статус урока', () => {
    const onToggleLessonDone = vi.fn();
    const { container } = renderWeek([lesson({ time_slot: '2' })], { onToggleLessonDone });
    const btn = container.querySelector('.cw-lesson-done');
    expect(btn.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(btn);
    expect(onToggleLessonDone).toHaveBeenCalledWith(expect.objectContaining({ id: 'l1' }));
  });

  it('у проведённого урока кнопка отмечена и возвращает в запланированные', () => {
    const { container } = renderWeek([lesson({ time_slot: '2', status: 'done' })]);
    const btn = container.querySelector('.cw-lesson-done');
    expect(btn.className).toContain('is-on');
    expect(btn.getAttribute('aria-label')).toBe('Вернуть в запланированные');
  });

  it('без права правки и у отменённого урока кнопки нет', () => {
    const a = renderWeek([lesson({ time_slot: '2' })], { canEdit: false });
    expect(a.container.querySelector('.cw-lesson-done')).toBeNull();
    const b = renderWeek([lesson({ time_slot: '2', status: 'cancelled' })]);
    expect(b.container.querySelector('.cw-lesson-done')).toBeNull();
  });
});

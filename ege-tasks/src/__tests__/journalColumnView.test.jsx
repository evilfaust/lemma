import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { App as AntApp } from 'antd';
import JournalColumnModal from '../components/workspace/journal/JournalColumnModal';

// Вид колонки в её настройках (v3.9.312): баллы / проценты / оценка.

afterEach(cleanup);

const COL = {
  key: 'm:c1', id: 'c1', title: 'Контрольная', day: '2026-10-05', scale: 'points',
  max_score: 20, thresholds: null, weight: 1, view: '', online: false, source: 'manual',
};

function setup(column, onSave = vi.fn()) {
  render(
    <AntApp>
      <JournalColumnModal open column={column} onCancel={() => {}} onSave={onSave} hasMarks />
    </AntApp>,
  );
  return onSave;
}

describe('JournalColumnModal — «Показывать в журнале»', () => {
  it('баллы: выбор «Оценка» уходит в view', async () => {
    const onSave = setup(COL);
    await screen.findByText('Показывать в журнале');
    fireEvent.click(screen.getByText('Оценка'));
    fireEvent.click(screen.getByText('Сохранить'));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0][0]).toMatchObject({ view: 'grade', scale: 'points', max_score: 20 });
  });

  it('«Как в журнале» сбрасывает свой вид', async () => {
    const onSave = setup({ ...COL, view: 'percent' });
    await screen.findByText(/всегда в виде «проценты»/);
    fireEvent.click(screen.getByText('Как в журнале'));
    fireEvent.click(screen.getByText('Сохранить'));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0][0].view).toBe('');
  });

  it('онлайн-работа: есть «Баллы» (число верных)', async () => {
    setup({ ...COL, online: true, source: 'work', scale: 'percent' });
    await screen.findByText('Показывать в журнале');
    expect(screen.getByText('Баллы')).toBeTruthy();
    expect(screen.getByText('Проценты')).toBeTruthy();
  });

  it('у оценки 2–5 и зачёта выбора нет', async () => {
    setup({ ...COL, scale: 'grade', max_score: 0 });
    await screen.findByText('Сохранить');
    expect(screen.queryByText('Показывать в журнале')).toBeNull();
  });
});

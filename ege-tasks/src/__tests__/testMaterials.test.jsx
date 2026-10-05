/**
 * Тест (из генератора или с выбором ответа) — полноправный материал урока и
 * колонка журнала (v3.9.299).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { App } from 'antd';

vi.mock('../shared/services/pocketbase', () => ({
  api: {
    getWorks: vi.fn().mockResolvedValue([{ id: 'w1', title: 'Контрольная 1' }]),
    getMCTestsLight: vi.fn().mockResolvedValue([{ id: 't1', title: '6 октября 10 кл', source_type: 'generator' }]),
  },
}));

import WorkColumnModal from '../components/workspace/journal/WorkColumnModal';
import {
  materialPath, OPENABLE_TYPES, testOption, isTestOption, testIdOf,
} from '../utils/lessonMaterials';

describe('материалы урока', () => {
  it('у каждого учительского материала свой редактор', () => {
    expect(materialPath('w1')).toBe('/app/works/w1/edit');
    expect(materialPath('w1', 'work')).toBe('/app/works/w1/edit');
    expect(materialPath('g1', 'geometry_work')).toBe('/app/geometry/works/g1');
    expect(materialPath('t1', 'mc_test')).toBe('/app/worksheets/mc-test/t1');
    expect(OPENABLE_TYPES.has('mc_test')).toBe(true);
    // ученические пункты своего редактора не имеют
    expect(OPENABLE_TYPES.has('session')).toBe(false);
    expect(OPENABLE_TYPES.has('text')).toBe(false);
  });

  it('тест в мульти-селекте отличается от работы префиксом', () => {
    expect(testOption('t1')).toBe('mc:t1');
    expect(isTestOption('mc:t1')).toBe(true);
    expect(isTestOption('w1')).toBe(false);
    expect(testIdOf('mc:t1')).toBe('t1');
  });
});

describe('«Работа или тест Lemma» в журнал', () => {
  beforeEach(() => vi.clearAllMocks());

  it('тест выбирается наравне с работами и уходит в onPickTest', async () => {
    const onPick = vi.fn();
    const onPickTest = vi.fn().mockResolvedValue();
    render(
      <App>
        <WorkColumnModal open onCancel={() => {}} onPick={onPick} onPickTest={onPickTest} />
      </App>,
    );
    await waitFor(() => expect(screen.getByText('Работа или тест Lemma в журнал')).toBeTruthy());
    const dialog = screen.getByRole('dialog');
    fireEvent.mouseDown(within(dialog).getByRole('combobox'));
    fireEvent.click(await screen.findByText('6 октября 10 кл'));
    fireEvent.click(within(dialog).getByRole('button', { name: /Добавить колонку/ }));

    await waitFor(() => expect(onPickTest).toHaveBeenCalledWith(
      expect.objectContaining({ id: 't1', title: '6 октября 10 кл' }),
    ));
    expect(onPick).not.toHaveBeenCalled();
  });
});

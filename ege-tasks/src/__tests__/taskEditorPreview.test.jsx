import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import TaskEditorPreview from '../components/task-editor/TaskEditorPreview';

describe('общий предпросмотр редактора задачи', () => {
  it('подставляет изображения отдельно для условия и решения и скрывает ответы по переключателю', () => {
    const original = 'https://example.test/figure.png';
    const record = (id, file) => ({ id, file, original_url: original, collectionName: 'task_images' });
    render(<TaskEditorPreview
      code="П3-733"
      statement={`Условие задачи ![Чертёж условия](${original})`}
      answer="42"
      solution={`Разбор задачи ![Чертёж решения](${original})`}
      images={{ condition: [record('condition', 'condition.png')], solution: [record('solution', 'solution.png')] }}
    />);

    expect(screen.getByAltText('Чертёж условия')).toHaveAttribute('src', expect.stringContaining('condition.png'));
    expect(screen.getByAltText('Чертёж решения')).toHaveAttribute('src', expect.stringContaining('solution.png'));
    expect(screen.getByText('42')).toBeVisible();

    fireEvent.click(screen.getByRole('switch', { name: 'Показывать ответ и решение' }));
    expect(screen.queryByText('42')).not.toBeInTheDocument();
    expect(screen.queryByAltText('Чертёж решения')).not.toBeInTheDocument();
    expect(screen.getByAltText('Чертёж условия')).toBeVisible();

    fireEvent.click(screen.getByRole('switch', { name: 'Показывать ответ и решение' }));
    expect(screen.getByText('42')).toBeVisible();
    expect(screen.getByAltText('Чертёж решения')).toBeVisible();
  });

  it('обновляет прикреплённый рисунок и убирает его из превью до сохранения', () => {
    const props = { statement: 'Найдите высоту', answer: '', solution: '', images: { condition: [], solution: [] } };
    const { rerender } = render(<TaskEditorPreview {...props} imageUrl="https://example.test/old.png" />);
    expect(screen.getByAltText('Рисунок к условию')).toHaveAttribute('src', 'https://example.test/old.png');

    rerender(<TaskEditorPreview {...props} imageUrl="data:image/png;base64,new" />);
    expect(screen.getByAltText('Рисунок к условию')).toHaveAttribute('src', 'data:image/png;base64,new');

    rerender(<TaskEditorPreview {...props} imageUrl="" />);
    expect(screen.queryByAltText('Рисунок к условию')).not.toBeInTheDocument();
    expect(screen.getByText('Найдите высоту')).toBeVisible();
  });
});

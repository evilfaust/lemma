import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { App as AntApp } from 'antd';
import { buildTaskImportPrompt, TASK_PROMPT_EXAMPLE, NEEDS_PICTURE_TAG } from '../utils/taskImportPrompt';
import { parseMarkdownFile } from '../utils/markdownTaskParser';
import AiPromptTab from '../components/task-importer/AiPromptTab';

const TOPICS = [
  { title: 'Планиметрия', ege_number: 1, exam_type: 'ege_profile' },
  { title: 'Вычисления', ege_number: 14, exam_type: 'ege_base' },
];

describe('промпт «Импорта задач»', () => {
  it('пример формата разбирается импортом: три задачи, чертёж, тег «нужен рисунок»', () => {
    const r = parseMarkdownFile(TASK_PROMPT_EXAMPLE.join('\n'));
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
    expect(r.format).toBe('ege');
    expect(r.metadata).toMatchObject({ topic: 'Планиметрия', subtopic: 'Трапеция', year: 2026 });
    expect(r.tasks.map((t) => [t.number, t.difficulty, t.answer])).toEqual([[1, '1', '7'], [2, '2', '3'], [3, '1', '24']]);
    expect(r.tasks[0].drawings).toEqual(['planim']);
    expect(r.tasks[0].statement_md).toContain('```planim\nтрапеция ABCD 10 4 4');
    expect(r.tasks[2].tags).toEqual([NEEDS_PICTURE_TAG]);
  });

  it('пример в промпте — тот же, что проверен; темы из базы на месте', () => {
    const prompt = buildTaskImportPrompt({ topics: TOPICS });
    expect(prompt).toContain(TASK_PROMPT_EXAMPLE.join('\n'));
    expect(prompt).toContain('- Планиметрия (№1)');
    expect(prompt).toContain('- Вычисления (№14)');
  });

  it('фильтр по экзамену оставляет темы одного экзамена', () => {
    const prompt = buildTaskImportPrompt({ topics: TOPICS, examType: 'ege_base' });
    expect(prompt).toContain('- Вычисления (№14)');
    expect(prompt).not.toContain('- Планиметрия (№1)');
  });

  it('чертежи текстом — шпаргалка всех редакторов, а вместо плейсхолдера — тег', () => {
    const prompt = buildTaskImportPrompt({ topics: TOPICS });
    for (const lang of ['planim', 'stereo', 'plot', 'chart', 'numline']) expect(prompt).toContain(`\`\`\`${lang}\n`);
    expect(prompt).toContain(`tags: [${NEEDS_PICTURE_TAG}]`);
    // Плейсхолдер ![](рисN) этот импорт прикрепить не умеет — его в промпте быть не должно
    expect(prompt).not.toContain('![](рис');
  });

  it('без чертежей — ни блоков, ни плейсхолдеров, только тег', () => {
    const prompt = buildTaskImportPrompt({ topics: TOPICS, drawings: false });
    expect(prompt).not.toContain('=== ЧЕРТЕЖИ ===');
    expect(prompt).not.toContain('```stereo');
    expect(prompt).not.toContain('![](рис');
    expect(prompt).toContain(`tags: [${NEEDS_PICTURE_TAG}]`);
  });
});

describe('вкладка «Промпт для ИИ»', () => {
  it('показывает промпт, переключает чертежи и ведёт к вставке текста', () => {
    const onGoToText = vi.fn();
    render(<AntApp><AiPromptTab topics={TOPICS} onGoToText={onGoToText} /></AntApp>);
    const area = screen.getByLabelText('Промпт для ИИ');
    expect(area.value).toContain('**1** [1]');
    expect(area.value).toContain('```planim');
    fireEvent.click(screen.getByText('Чертежи текстом'));
    expect(screen.getByLabelText('Промпт для ИИ').value).not.toContain('=== ЧЕРТЕЖИ ===');
    fireEvent.click(screen.getByText('Вставить ответ ИИ'));
    expect(onGoToText).toHaveBeenCalled();
  });
});

// @vitest-environment jsdom
import { App } from 'antd';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import TextTaskGenerator from '../components/text-tasks/TextTaskGenerator';
import { api } from '../shared/services/pocketbase';
import { sheetGeneratorRoute } from '../utils/sheetRegistry';

function mount(entry = sheetGeneratorRoute('table_choice'), generator = 'table_choice', examNumber = 6) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <App><TextTaskGenerator generator={generator} examNumber={examNumber} /></App>
    </MemoryRouter>,
  );
}

afterEach(() => vi.restoreAllMocks());

it('собирает, сохраняет и заново открывает тренировочный лист с таблицей и ответами', async () => {
  vi.spyOn(api, 'getGeneratorSheetFolders').mockResolvedValue([]);
  const save = vi.spyOn(api, 'createGeneratorSheet').mockImplementation(async payload => ({ ...payload, id: 'saved' }));
  const { container, unmount } = mount();
  expect(screen.getByRole('button', { name: /Загрузить лист/ })).toBeEnabled();
  const count = screen.getByRole('spinbutton', { name: 'Заданий в варианте' });
  fireEvent.change(count, { target: { value: '1' } });
  fireEvent.blur(count);
  fireEvent.click(screen.getByRole('button', { name: /Сформировать/ }));

  const table = container.querySelector('.ps-page:not(.ps-page--key) .ps-task-text table');
  expect(table).toBeInTheDocument();
  expect(table.querySelectorAll('tbody tr')).toHaveLength(3);
  expect(screen.queryByRole('heading', { name: 'Ответы' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Лист ответов' }));
  expect(screen.getByRole('heading', { name: 'Ответы' })).toBeInTheDocument();
  expect(container.querySelectorAll('.ps-key-answer')).toHaveLength(1);

  fireEvent.click(screen.getByRole('button', { name: /Сохранить лист/ }));
  const dialog = await screen.findByRole('dialog');
  fireEvent.change(within(dialog).getByRole('textbox', { name: 'Название' }), { target: { value: 'Тренировка №6' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Сохранить' }));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  const [payload] = save.mock.calls[0];
  expect(payload).toMatchObject({
    generator: 'table_choice', kind: 'flat', title: 'Тренировка №6', variants_count: 1, questions_count: 1,
    settings: { showAnswers: true },
  });
  expect(payload.tasks_data[0][0].statement_md).toContain('| Магазин |');
  const original = table.textContent;
  unmount();

  vi.spyOn(api, 'getGeneratorSheet').mockResolvedValue({ ...payload, id: 'saved' });
  const reopened = mount(`${sheetGeneratorRoute('table_choice')}?sheet=saved`);
  await screen.findByRole('heading', { name: 'Ответы' });
  expect(reopened.container.querySelector('.ps-page:not(.ps-page--key) .ps-task-text table').textContent).toBe(original);
});

it('открывает экспорт нового листа сразу в формате импорта работы', async () => {
  mount();
  const count = screen.getByRole('spinbutton', { name: 'Заданий в варианте' });
  fireEvent.change(count, { target: { value: '1' } });
  fireEvent.blur(count);
  fireEvent.click(screen.getByRole('button', { name: /Сформировать/ }));
  fireEvent.click(screen.getByRole('button', { name: /Экспорт .md/ }));
  const dialog = await screen.findByRole('dialog');
  expect(within(dialog).getByRole('textbox').value).toMatch(/^---\nработа: [^\n]+\nконтекст: ege_base\nтема: /);
  expect(within(dialog).getByRole('textbox').value).toMatch(/ответ: \d+\n[\s\S]+\| Магазин \|/);
  expect(within(dialog).getByRole('button', { name: /Скачать .md/ })).toBeEnabled();
});

it('показывает типы №1 и открывает экспорт с темой бытовых расчётов', async () => {
  mount(sheetGeneratorRoute('everyday_math'), 'everyday_math', 1);
  expect(screen.getByRole('checkbox', { name: 'Округление вверх' })).toBeChecked();
  expect(screen.getByRole('checkbox', { name: 'Округление вниз' })).not.toBeChecked();
  fireEvent.click(screen.getByRole('button', { name: /Сформировать/ }));
  fireEvent.click(screen.getByRole('button', { name: /Экспорт .md/ }));
  const dialog = await screen.findByRole('dialog');
  const md = within(dialog).getByRole('textbox').value;
  expect(md).toContain('тема: ЕГЭ-База. №1 Простейшие текстовые задачи');
  expect(md).toContain('подтема: Округление с избытком');
});

it('показывает типы №5 и выгружает вероятность в формате работы', async () => {
  mount(sheetGeneratorRoute('probability'), 'probability', 5);
  expect(screen.getByRole('checkbox', { name: 'Прямой случайный выбор' })).toBeChecked();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Противоположное событие' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Два независимых события' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Вероятность выхода из лабиринта' }));
  fireEvent.click(screen.getByRole('button', { name: /Сформировать/ }));
  fireEvent.click(screen.getByRole('button', { name: /Экспорт .md/ }));
  const dialog = await screen.findByRole('dialog');
  const md = within(dialog).getByRole('textbox').value;
  expect(md).toContain('тема: ЕГЭ-База. №5 Начала теории вероятностей');
  expect(md).toMatch(/окажется исправным|не протекает|выученный вопрос|канале без новостей/);
  expect(md).toContain('подтема: Теоремы о вероятностях событий');
  expect(md).toContain('```planim');
  expect(md).toMatch(/ответ: 0,\d{1,3}\n/);
});

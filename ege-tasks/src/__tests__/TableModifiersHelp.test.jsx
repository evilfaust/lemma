import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { App } from 'antd';
import TableModifiersHelp from '../components/shared/TableModifiersHelp';
import { MODIFIER_INFO, modifierAliases, parseTableDirective } from '../utils/remarkTableModifiers';

const wrapper = ({ children }) => <App>{children}</App>;

describe('MODIFIER_INFO / modifierAliases — единый источник справки', () => {
  it('у каждого модификатора из MOD_ALIASES есть описание', () => {
    // Синонимы собираются из MOD_ALIASES автоматически — прогоняем несколько
    // известных директив через parseTableDirective и убеждаемся, что их
    // канонический ключ описан в MODIFIER_INFO (иначе справка отстанет от парсера).
    ['{без линий}', '{бланк}', '{компактная}', '{галерея}', '{линии}', '{равные колонки}', '{без шапки}']
      .forEach((directive) => {
        const [key] = parseTableDirective(directive);
        expect(MODIFIER_INFO[key]).toBeTruthy();
      });
  });

  it('modifierAliases возвращает все синонимы ключа, включая сам ключ', () => {
    const aliases = modifierAliases('equalcols');
    expect(aliases).toContain('equalcols');
    expect(aliases).toContain('равные колонки');
    expect(aliases).toContain('одинаковая ширина');
    expect(aliases).toContain('поровну');
  });

  it('каждый ключ MODIFIER_INFO реально понимает парсер (round-trip)', () => {
    Object.keys(MODIFIER_INFO).forEach((key) => {
      const alias = modifierAliases(key)[0];
      expect(parseTableDirective(`{${alias}}`)).toEqual([key]);
    });
  });
});

describe('TableModifiersHelp', () => {
  it('открывается по клику и показывает карточку каждого модификатора', () => {
    render(<TableModifiersHelp />, { wrapper });
    fireEvent.click(screen.getByRole('button'));
    Object.values(MODIFIER_INFO).forEach((info) => {
      expect(screen.getByText(info.title)).toBeInTheDocument();
    });
    // директива показана как читаемый тег, а не спрятана в тексте примера
    expect(screen.getByText('{равные колонки}')).toBeInTheDocument();
  });

  it('карточка «Равные колонки» рендерит живой пример — таблицу 50/50', () => {
    render(<TableModifiersHelp />, { wrapper });
    fireEvent.click(screen.getByRole('button'));
    const table = document.querySelector('table.md-table--equalcols');
    expect(table).toBeTruthy();
  });

  it('«Вставить пример» зовёт onInsert с директивой (сама директива в примере)', () => {
    const onInsert = vi.fn();
    render(<TableModifiersHelp onInsert={onInsert} />, { wrapper });
    fireEvent.click(screen.getByRole('button'));
    const buttons = screen.getAllByText('Вставить пример');
    fireEvent.click(buttons[0]);
    expect(onInsert).toHaveBeenCalledTimes(1);
    expect(onInsert.mock.calls[0][0]).toContain('{без линий}');
  });

  it('без onInsert кнопки «Вставить пример» нет — справка только читать', () => {
    render(<TableModifiersHelp />, { wrapper });
    fireEvent.click(screen.getByRole('button'));
    expect(screen.queryByText('Вставить пример')).not.toBeInTheDocument();
  });
});

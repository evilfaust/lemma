import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  defaultSheetHead, resolveSheetHead, patchSheetHead, hasHeadOverrides,
  isHeadFieldEdited, resetSheetHead, readSheetHead, writeSheetHead,
} from '../utils/tdfSheetHead';

vi.mock('../services/pocketbase', () => ({ api: { getTdfItemControlDrawingUrl: () => '' } }));

const SET = { id: 'set1', title: 'Корень n-й степени', class_number: 10 };
const COLS = { formulation: true, drawing: false, notation: false };
const defaults = (patch = {}) => defaultSheetHead({
  mode: 'blank', tdfSet: SET, variantNumber: 1, columns: COLS, ...patch,
});

describe('defaultSheetHead', () => {
  it('повторяет прежнюю шапку бланка', () => {
    const d = defaults();
    expect(d.kind).toBe('Устный опрос');
    expect(d.title).toBe('Корень n-й степени · 10 класс');
    expect(d.variant).toBe('Вариант 1');
    expect(d.note).toBe('Заполните таблицу по памяти: формулировка.');
    expect(d.fioLabel).toBe('Фамилия, имя');
  });

  it('у конспекта нет инструкции, у ключа — своя метка', () => {
    expect(defaults({ mode: 'etalon' }).note).toBe('');
    expect(defaults({ mode: 'key' }).kind).toBe('Ключ учителя');
  });
});

describe('правки шапки', () => {
  it('правка ложится поверх умолчаний', () => {
    const o = patchSheetHead({}, 'title', 'Корни · 10 «А»', defaults(), 1);
    expect(resolveSheetHead(defaults(), o, 1).title).toBe('Корни · 10 «А»');
    expect(isHeadFieldEdited(o, 'title', 1)).toBe(true);
  });

  it('текст, равный умолчанию, правку снимает — шапка снова следит за набором', () => {
    let o = patchSheetHead({}, 'title', 'Другое', defaults(), 1);
    o = patchSheetHead(o, 'title', '  Корень n-й степени · 10 класс ', defaults(), 1);
    expect(hasHeadOverrides(o)).toBe(false);
    const renamed = defaults({ tdfSet: { ...SET, title: 'Корни' } });
    expect(resolveSheetHead(renamed, o, 1).title).toBe('Корни · 10 класс');
  });

  it('пустая строка — «не печатать»', () => {
    const o = patchSheetHead({}, 'kind', '   ', defaults(), 1);
    expect(resolveSheetHead(defaults(), o, 1).kind).toBe('');
  });

  it('строка варианта своя у каждого номера', () => {
    const o = patchSheetHead({}, 'variant', 'Вариант А', defaults(), 1);
    expect(resolveSheetHead(defaults(), o, 1).variant).toBe('Вариант А');
    const d2 = defaults({ variantNumber: 2 });
    expect(resolveSheetHead(d2, o, 2).variant).toBe('Вариант 2');
  });

  it('однострочные поля склеивают переводы строк, инструкция — нет', () => {
    const t = patchSheetHead({}, 'title', 'а\nб', defaults(), 1);
    expect(t.title).toBe('а б');
    const n = patchSheetHead({}, 'note', 'раз\nдва', defaults(), 1);
    expect(n.note).toBe('раз\nдва');
  });

  it('сброс оставляет строки других вариантов', () => {
    let o = patchSheetHead({}, 'variant', 'А', defaults(), 1);
    o = patchSheetHead(o, 'variant', 'Б', defaults({ variantNumber: 2 }), 2);
    o = patchSheetHead(o, 'note', 'Своя', defaults(), 1);
    expect(resetSheetHead(o, 1)).toEqual({ variants: { 2: 'Б' } });
  });

  it('хранится по набору и виду листа', () => {
    localStorage.clear();
    writeSheetHead('set1', 'blank', { title: 'X' });
    expect(readSheetHead('set1', 'blank')).toEqual({ title: 'X' });
    expect(readSheetHead('set1', 'etalon')).toEqual({});
    writeSheetHead('set1', 'blank', {});
    expect(localStorage.getItem('tdf.sheetHead.set1.blank')).toBeNull();
  });
});

describe('TDFPrintView: шапка правится на листе', () => {
  beforeEach(() => localStorage.clear());

  it('щелчок → поле, Enter → новая шапка на листе и в хранилище', async () => {
    const { default: TDFPrintView } = await import('../components/tdf/TDFPrintView');
    const items = [{ id: 'i1', name: 'Определение', type: 'definition', formulation_md: 'x' }];
    const { container } = render(
      <TDFPrintView tdfSet={SET} items={items} mode="blank" variantNumber={1} onBack={() => {}} />,
    );
    const page = () => container.querySelector('.tdfp-pages');
    const title = await screen.findAllByText('Корень n-й степени · 10 класс');
    const editable = title.find(el => el.classList.contains('tdfp-edit'));
    expect(editable).toBeTruthy();
    // В measure-зоне шапка — просто текст, без кнопок правки.
    expect(container.querySelector('.tdfp-measure .tdfp-edit')).toBeNull();

    fireEvent.click(editable);
    const input = page().querySelector('.tdfp-edit-input');
    fireEvent.change(input, { target: { value: 'Корни · 10 «Б»' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(page().querySelector('.tdfp-head__title').textContent).toBe('Корни · 10 «Б»');
    expect(readSheetHead('set1', 'blank').title).toBe('Корни · 10 «Б»');
    expect(screen.getByText('Сбросить шапку')).toBeTruthy();
  });

  it('стёртая строка не печатается и возвращается кнопкой', async () => {
    const { default: TDFPrintView } = await import('../components/tdf/TDFPrintView');
    writeSheetHead('set1', 'blank', { note: '' });
    const items = [{ id: 'i1', name: 'Определение', type: 'definition', formulation_md: 'x' }];
    const { container } = render(
      <TDFPrintView tdfSet={SET} items={items} mode="blank" variantNumber={1} onBack={() => {}} />,
    );
    expect(container.querySelector('.tdfp-pages .tdfp-head__note')).toBeNull();
    fireEvent.click(screen.getByText('инструкцию'));
    expect(container.querySelector('.tdfp-pages .tdfp-head__note').textContent)
      .toMatch(/^Заполните таблицу по памяти: формулировка/);
  });
});

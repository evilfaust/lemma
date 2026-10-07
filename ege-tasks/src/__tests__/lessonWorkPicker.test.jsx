import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { App } from 'antd';
import {
  buildPickerItems, pickerSections, filterPickerItems, sectionOfValue,
  normalizeQuery, folderSection, NO_FOLDER, RECENT_LIMIT,
} from '../utils/lessonWorkPicker';
import { testOption, geoOption } from '../utils/lessonMaterials';
import LessonWorkPickerModal from '../components/workspace/calendar/LessonWorkPickerModal';

// Выбор работы для урока: вместо селекта на 300+ работ — окно с разделами,
// поиском по словам и фильтром по классу урока. Работы каникулярных программ
// (по одной на ученика) узнаются по самим программам и уходят в свой раздел.

const day = (n) => `2026-10-${String(n).padStart(2, '0')} 10:00:00.000Z`;

const WORKS = [
  { id: 'w1', title: 'Контрольная №2. Тригонометрия', class: 10, folder: 'Алгебра 10', updated: day(3) },
  { id: 'w2', title: 'Устный счёт 5', class: 10, folder: '', updated: day(1), is_pinned: true },
  { id: 'w3', title: 'Самостоятельная. Логарифмы', class: 11, folder: 'Алгебра 11', updated: day(5) },
  { id: 'w4', title: 'Каникулы · Алгебра · №9 — Квадратная решётка · Козлова Вера', class: 10, updated: day(6) },
  { id: 'w5', title: 'Лето · Геометрия · №12 — Планиметрия · Рогозина', class: 10, updated: day(7) },
  { id: 'w6', title: 'Тригонометрия: ёмкие формулы', class: 10, folder: 'Алгебра 10', updated: day(2), expand: { topic: { title: 'Синус и косинус' } } },
];
const TESTS = [{ id: 't1', title: 'Тест по производным', created: day(4) }];
const GEO = [{ id: 'g1', title: 'Сечения куба', class: 10, updated: day(8) }];

const items = buildPickerItems({
  works: WORKS, tests: TESTS, geoWorks: GEO,
  workSessions: { w1: [{ id: 's1' }, { id: 's2' }] },
  testSessions: { t1: [{ id: 's3' }] },
  programWorkIds: new Set(['w4', 'w5']),
});

describe('lessonWorkPicker — разделы', () => {
  it('пункты: значение как у прежнего селекта, класс, выдачи, программа', () => {
    expect(items.map((i) => i.value)).toEqual(['w1', 'w2', 'w3', 'w4', 'w5', 'w6', testOption('t1'), geoOption('g1')]);
    const w1 = items.find((i) => i.value === 'w1');
    expect(w1).toMatchObject({ kind: 'work', grade: '10', folder: 'Алгебра 10', issued: 2, program: false });
    expect(items.find((i) => i.value === 'w5').program).toBe(true);
    expect(items.find((i) => i.value === testOption('t1'))).toMatchObject({ kind: 'test', issued: 1, grade: '' });
  });

  it('разделы с учётом класса: папки другого класса и пустые разделы скрыты', () => {
    const keys = pickerSections(items, { grade: '10' }).map((s) => [s.key, s.count]);
    expect(keys).toEqual([
      ['recent', 5],
      ['pinned', 1],
      [folderSection('Алгебра 10'), 2],
      [NO_FOLDER, 1],
      ['tests', 1],
      ['geo', 1],
      ['program', 2],
    ]);
    expect(pickerSections(items).some((s) => s.key === folderSection('Алгебра 11'))).toBe(true);
  });

  it('недавние — свежие сверху, без каникулярных программ', () => {
    const { items: list } = filterPickerItems(items, { section: 'recent', grade: '10' });
    expect(list.map((i) => i.value)).toEqual([geoOption('g1'), testOption('t1'), 'w1', 'w6', 'w2']);
    const many = buildPickerItems({ works: Array.from({ length: 40 }, (_, i) => ({ id: `x${i}`, title: `Р${i}`, updated: day(1) })) });
    expect(filterPickerItems(many, { section: 'recent' }).items).toHaveLength(RECENT_LIMIT);
  });

  it('раздел папки и «ещё N для других классов»', () => {
    const r = filterPickerItems(items, { section: 'program', grade: '11' });
    expect(r.items).toHaveLength(0);
    expect(r.hiddenByGrade).toBe(2);
    expect(filterPickerItems(items, { section: folderSection('Алгебра 10'), grade: '10' }).items.map((i) => i.value))
      .toEqual(['w1', 'w6']);
  });

  it('поиск: слова в любом порядке, ё = е, по папке и теме, по всем разделам', () => {
    expect(normalizeQuery('  Ёмкие   ФОРМУЛЫ ')).toBe('емкие формулы');
    const find = (q, grade = '') => filterPickerItems(items, { section: 'tests', query: q, grade }).items.map((i) => i.value);
    expect(find('тригонометрия контрольная')).toEqual(['w1']);
    expect(find('емкие')).toEqual(['w6']);
    expect(find('синус')).toEqual(['w6']);
    expect(find('алгебра 11')).toEqual(['w3']);
    // своё — выше каникулярных персональных
    expect(find('алгебра')).toEqual(['w3', 'w1', 'w6', 'w4']);
    const r = filterPickerItems(items, { query: 'логарифмы', grade: '10' });
    expect(r.items).toEqual([]);
    expect(r.hiddenByGrade).toBe(1);
  });

  it('окно открывается в разделе выбранной работы', () => {
    expect(sectionOfValue(items, 'w1')).toBe(folderSection('Алгебра 10'));
    expect(sectionOfValue(items, 'w2')).toBe('pinned');
    expect(sectionOfValue(items, 'w4')).toBe('program');
    expect(sectionOfValue(items, testOption('t1'))).toBe('tests');
    expect(sectionOfValue(items, geoOption('g1'))).toBe('geo');
    expect(sectionOfValue(items, 'нет')).toBeNull();
  });
});

describe('LessonWorkPickerModal', () => {
  const renderModal = (props = {}) => {
    const onPick = vi.fn();
    const onClose = vi.fn();
    render(
      <App>
        <LessonWorkPickerModal open items={items} grade="10" onPick={onPick} onClose={onClose} {...props} />
      </App>,
    );
    return { onPick, onClose };
  };

  it('раздел, затем клик по работе отдаёт её значение и закрывает окно', () => {
    const { onPick, onClose } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: /Каникулярные программы/ }));
    expect(screen.getByText(/Козлова Вера/)).toBeTruthy();
    fireEvent.click(screen.getByRole('option', { name: /Козлова Вера/ }));
    expect(onPick).toHaveBeenCalledWith('w4');
    expect(onClose).toHaveBeenCalled();
  });

  it('поиск + Enter выбирает первую найденную; фильтр класса снимается кнопкой', () => {
    const { onPick } = renderModal();
    const input = screen.getByPlaceholderText(/Найти работу/);
    fireEvent.change(input, { target: { value: 'логарифмы' } });
    expect(screen.getByText('Ничего не найдено')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Ещё 1 — для других классов/ }));
    expect(screen.getByRole('option', { name: /Логарифмы/ })).toBeTruthy();
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', keyCode: 13 });
    expect(onPick).toHaveBeenCalledWith('w3');
  });

  it('отметка «выдана ×2» и выбранная работа подсвечена', () => {
    renderModal({ value: 'w1' });
    const row = screen.getByRole('option', { name: /Контрольная №2/ });
    expect(row.getAttribute('aria-selected')).toBe('true');
    expect(row.textContent).toContain('выдана ×2');
  });
});

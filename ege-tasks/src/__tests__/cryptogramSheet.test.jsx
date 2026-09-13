import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { App } from 'antd';
import CryptogramSheet from '../components/cryptogram/CryptogramSheet';
import {
  normalizeCryptogramSettings,
  DEFAULT_CRYPTOGRAM_SETTINGS,
  CRYPTOGRAM_MODE_PRESETS,
} from '../utils/cryptogram';

const wrapper = ({ children }) => <App>{children}</App>;

// «ДОМ» — три уникальные буквы, значит и задач ровно три.
const tasks = [
  { id: 't1', statement_md: 'Вычислите $2 + 2$', answer: '4' },
  { id: 't2', statement_md: 'Вычислите $3 \\cdot 3$', answer: '9' },
  { id: 't3', statement_md: 'Вычислите $10 - 5$', answer: '5' },
];

const sheet = (props = {}) => render(
  <CryptogramSheet tasks={tasks} phrase="ДОМ" title="Шифровка" {...props} />,
  { wrapper }
);

const pageCrypts = (container) => [...container.querySelectorAll('.ps-page .ps-crypt')];

describe('normalizeCryptogramSettings', () => {
  it('без настроек отдаёт дефолты', () => {
    expect(normalizeCryptogramSettings()).toEqual(DEFAULT_CRYPTOGRAM_SETTINGS);
    expect(normalizeCryptogramSettings(null).mode).toBe('single');
  });

  it('отбраковывает мусор в перечислимых полях', () => {
    const s = normalizeCryptogramSettings({
      mode: 'triple', headerMode: 'huge', margins: 'wide',
      answerStyle: 'circle', solutionSpace: 'xxl', columns: 7,
    });
    expect(s.mode).toBe('single');
    expect(s.headerMode).toBe('full');
    expect(s.margins).toBe('normal');
    expect(s.answerStyle).toBe('box');
    expect(s.solutionSpace).toBe('none');
    expect(s.columns).toBe(2);
  });

  it('сохраняет осмысленные значения и приводит числа', () => {
    const s = normalizeCryptogramSettings({ mode: 'duo', columns: 1, duration: '15', fontScale: 0.9 });
    expect(s).toMatchObject({ mode: 'duo', columns: 1, duration: 15, fontScale: 0.9 });
    expect(normalizeCryptogramSettings({ duration: 0 }).duration).toBeNull();
  });

  it('тумблеры выключаются только явным false', () => {
    expect(normalizeCryptogramSettings({ showKey: false }).showKey).toBe(false);
    expect(normalizeCryptogramSettings({ showKey: undefined }).showKey).toBe(true);
  });

  it('компактный пресет укорачивает лист', () => {
    const s = normalizeCryptogramSettings({ ...DEFAULT_CRYPTOGRAM_SETTINGS, ...CRYPTOGRAM_MODE_PRESETS.duo, mode: 'duo' });
    expect(s.headerMode).toBe('compact');
    expect(s.margins).toBe('narrow');
    expect(s.showFooter).toBe(false);
  });
});

describe('CryptogramSheet — лист', () => {
  it('номер задачи — это номера клеток ответа, а не порядковый номер', () => {
    const { container } = sheet();
    const nums = [...container.querySelectorAll('.ps-page .ps-task-num')].map(n => n.textContent.trim());
    // «ДОМ»: Д→клетка 1, О→2, М→3 (у повторов букв клеток было бы несколько)
    expect(nums).toEqual(['1', '2', '3']);
    expect(container.querySelectorAll('.ps-page .ps-task-num--label').length).toBe(3);
  });

  it('повторяющаяся буква даёт задаче несколько клеток', () => {
    const { container } = render(
      <CryptogramSheet tasks={tasks} phrase="КАЗАК" title="Шифровка" />, { wrapper }
    );
    // «КАЗАК» — три уникальные буквы: К в клетках 1 и 5, А во 2 и 4, З в третьей
    const nums = [...container.querySelectorAll('.ps-page .ps-task-num')].map(n => n.textContent.trim());
    expect(nums).toEqual(['1, 5', '2, 4', '3']);
  });

  it('клетки ответа пронумерованы', () => {
    const { container } = sheet();
    const slots = [...container.querySelectorAll('.ps-page .ps-crypt-slot-num')].map(n => n.textContent);
    expect(slots).toEqual(['1', '2', '3']);
  });

  it('ключ учителя несёт буквы и загаданную фразу', () => {
    const { container } = sheet();
    const badges = [...container.querySelectorAll('.ps-page--key .ps-key-badge')].map(b => b.textContent);
    expect(badges.sort()).toEqual(['Д', 'М', 'О']);
    expect(container.querySelector('.ps-key-extra').textContent).toContain('ДОМ');
  });

  it('ключ учителя отключается настройкой', () => {
    const { container } = sheet({ settings: { showKey: false } });
    expect(container.querySelector('.ps-page--key')).toBeNull();
  });

  it('при полной шапке подсказка живёт в инструкции, а не в блоке', () => {
    const full = sheet({ settings: { headerMode: 'full' } });
    expect(full.container.querySelector('.ps-page .ps-crypt-note')).toBeNull();
    expect(full.container.querySelector('.ps-page .ps-note-text').textContent).toContain('таблице шифровки');

    const compact = sheet({ settings: { headerMode: 'compact' } });
    expect(compact.container.querySelector('.ps-page .ps-crypt-note')).not.toBeNull();
  });

  it('описание слова печатается и отключается', () => {
    const on = sheet({ description: 'жилое помещение' });
    expect(on.container.querySelector('.ps-page .ps-crypt-def').textContent).toContain('жилое помещение');

    const off = sheet({ description: 'жилое помещение', settings: { showDefinition: false } });
    expect(off.container.querySelector('.ps-page .ps-crypt-def')).toBeNull();
  });

  it('без задач или с несовпадающим числом букв лист не рисуется', () => {
    const { container } = render(<CryptogramSheet tasks={[]} phrase="ДОМ" />, { wrapper });
    expect(container.querySelector('.ps-root')).toBeNull();

    const mismatch = render(
      <CryptogramSheet tasks={tasks} phrase="ТЕОРЕМА" />, { wrapper }
    );
    expect(mismatch.container.querySelector('.ps-root')).toBeNull();
  });
});

describe('CryptogramSheet — компактный режим «2 на листе»', () => {
  it('A4-режим печатает одну шифровку на целой странице', () => {
    const { container } = sheet();
    expect(pageCrypts(container).length).toBe(1);
    expect(container.querySelectorAll('.ps-page--half').length).toBe(0);
  });

  it('печатает две копии на половинках одного листа', () => {
    const { container } = sheet({ settings: { mode: 'duo', showKey: false } });
    expect(pageCrypts(container).length).toBe(2);
    expect(container.querySelectorAll('.ps-page--half-top').length).toBe(1);
    expect(container.querySelectorAll('.ps-page--half-bot').length).toBe(1);
    expect(container.querySelector('.ps-root--half')).not.toBeNull();
  });

  it('обе копии одинаковые — та же таблица и те же номера клеток', () => {
    const { container } = sheet({ settings: { mode: 'duo', showKey: false } });
    const [first, second] = pageCrypts(container);
    const letters = (el) => [...el.querySelectorAll('.ps-crypt-letter')].map(n => n.textContent);
    expect(letters(first)).toEqual(letters(second));

    const nums = [...container.querySelectorAll('.ps-page')].map(page =>
      [...page.querySelectorAll('.ps-task-num')].map(n => n.textContent.trim()).join('|')
    );
    expect(nums[0]).toBe(nums[1]);
  });

  it('«Вариант 1 / 2» на одинаковых копиях не печатается', () => {
    const { container } = sheet({ settings: { mode: 'duo', showKey: false } });
    expect(container.querySelector('.ps-page .ps-variant')).toBeNull();
  });

  it('сообщает наружу, сколько страниц занял каждый вариант', () => {
    const counts = [];
    sheet({ settings: { mode: 'duo', showKey: false }, onPageCounts: (c) => counts.push(c) });
    const last = counts[counts.length - 1];
    expect(Object.keys(last).sort()).toEqual(['1', '2']);
    expect(last['1']).toBe(1);
  });
});

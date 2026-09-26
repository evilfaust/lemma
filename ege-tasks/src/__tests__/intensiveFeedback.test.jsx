import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { App as AntApp } from 'antd';

const apiMock = vi.hoisted(() => ({
  generateIntensiveFeedback: vi.fn(),
  saveFeedbackExamples: vi.fn(),
}));
// Окно antd под нагрузкой полного прогона дольше 5 с по умолчанию.
vi.setConfig({ testTimeout: 20000 });

vi.mock('../shared/services/pocketbase', () => ({ api: apiMock }));

// eslint-disable-next-line import/first
import {
  addressOf, genderOf, fillName, needsRetake, buildFeedbackData, firstNameOf, NAME_TOKEN,
} from '../utils/intensiveFeedback';
// eslint-disable-next-line import/first
import { buildFeedbackMessages, cleanFeedback, FEEDBACK_RULES } from '../../../pocketbase/feedback-prompt.mjs';
// eslint-disable-next-line import/first
import { buildGrid, indexMarks, mergeColumns } from '../utils/classJournal';
// eslint-disable-next-line import/first
import IntensiveFeedbackModal from '../components/workspace/journal/IntensiveFeedbackModal';

// ── Обращение и пол ─────────────────────────────────────────────────────────

describe('обращение и пол', () => {
  it('обращение: своё поле ученика, иначе словарь, иначе имя', () => {
    expect(addressOf({ name: 'Дрибинская Ксения' })).toBe('Ксюша');
    expect(addressOf({ name: 'Куприн Леонид' })).toBe('Лёня');
    expect(addressOf({ name: 'Шахбазова Сафа' })).toBe('Сафа');
    expect(addressOf({ name: 'Рогозина Диана', short_name: 'Ди' })).toBe('Ди');
    expect(firstNameOf('Иванов')).toBe('Иванов');
  });
  it('пол: по фамилии, иначе по имени (Илья, Никита — мужские)', () => {
    expect(genderOf({ name: 'Пономарева Аня' })).toBe('f');
    expect(genderOf({ name: 'Ипатов Иван' })).toBe('m');
    expect(genderOf({ name: 'Щегельская Дарья' })).toBe('f');
    expect(genderOf({ name: 'Кастан Стефани' })).toBe('m'); // фамилия не склоняется, имя без -а/-я
    expect(genderOf({ name: 'Ли Никита' })).toBe('m');
    expect(genderOf({ name: 'Ким Яна' })).toBe('f');
  });
  it('токен имени подставляется везде', () => {
    expect(fillName(`${NAME_TOKEN}, молодец. ${NAME_TOKEN}!`, 'Аня')).toBe('Аня, молодец. Аня!');
  });
  it('пересдача — только при «w» и двойке', () => {
    expect(needsRetake('w')).toBe(true);
    expect(needsRetake('2+')).toBe(true);
    expect(needsRetake('3')).toBe(false);
    expect(needsRetake('4-')).toBe(false);
    expect(needsRetake('')).toBe(false);
  });
});

// ── Данные для модели ───────────────────────────────────────────────────────

const block = { id: 'B1', title: 'Производная и график', date_from: '2026-09-18 12:00:00.000Z', date_to: '2026-09-23 12:00:00.000Z', final_share: 40 };
const d = (x) => `2026-09-${x} 12:00:00.000Z`;
const stored = [
  { id: 'w1', title: 'f\'', date: d(18), scale: 'points', max_score: 15, block: 'B1', role: 'work', note: 'Техника дифференцирования', created: '1' },
  { id: 'hw1', title: 'ДЗ', date: d(18), scale: 'points', max_score: 20, block: 'B1', role: 'work', created: '2' },
  { id: 'd18', title: 'За день', date: d(18), scale: 'grade', block: 'B1', role: 'day', created: '3' },
  { id: 'w2', title: 'Ф-ч', date: d(21), scale: 'points', max_score: 8, block: 'B1', role: 'work', note: 'с бумажного листа: подпись неразборчива — проверьте', created: '4' },
  { id: 'd21', title: 'За день', date: d(21), scale: 'grade', block: 'B1', role: 'day', created: '5' },
  { id: 'fin', title: 'Зачёт', date: d(23), scale: 'points', max_score: 20, block: 'B1', role: 'final', note: 'Касательная и производная по графику', created: '6' },
  { id: 'tot', title: 'Итог', date: d(23), scale: 'grade', block: 'B1', role: 'total', created: '7' },
];
const students = [
  { id: 's1', name: 'Дрибинская Ксения' },
  { id: 's2', name: 'Шахбазова Сафа' },
  { id: 's3', name: 'Норченко София' },
];
const marks = [
  { col: 'w1', student: 's1', value: '15' }, { col: 'hw1', student: 's1', value: '19' }, { col: 'd18', student: 's1', value: '5' },
  { col: 'w2', student: 's1', value: '8' }, { col: 'd21', student: 's1', value: '5-' }, { col: 'fin', student: 's1', value: '18' },
  { col: 'tot', student: 's1', value: '5' },
  { col: 'w1', student: 's2', value: '13' }, { col: 'hw1', student: 's2', value: '18' }, { col: 'd18', student: 's2', value: '4' },
  { col: 'w2', student: 's2', value: '1' }, { col: 'd21', student: 's2', value: '3-' }, { col: 'fin', student: 's2', value: '7' },
  { col: 'tot', student: 's2', value: '3' },
  { col: 'w1', student: 's3', value: 'н' }, { col: 'd18', student: 's3', value: 'н' }, { col: 'w2', student: 's3', value: 'н' },
  { col: 'd21', student: 's3', value: 'н' }, { col: 'fin', student: 's3', value: '10' }, { col: 'tot', student: 's3', value: 'w' },
];
const columns = mergeColumns(stored, new Map(), { blocks: [block] });
const grid = buildGrid(students, columns, indexMarks(marks), new Map(), { blocks: [block] });

describe('данные ученика для черновика', () => {
  it('🚨 ни фамилий, ни имён, ни обращений — ни у кого из класса', () => {
    for (const s of students) {
      const json = JSON.stringify(buildFeedbackData(columns, grid.rows, s.id, { gender: genderOf(s) }));
      for (const other of students) {
        for (const part of other.name.split(' ')) expect(json).not.toContain(part);
        expect(json).not.toContain(addressOf(other));
      }
    }
  });
  it('дни словами, без дат; темы — только из описаний, служебная заметка не описание', () => {
    const data = buildFeedbackData(columns, grid.rows, 's1', { gender: 'f', rating: 'I', title: block.title });
    const json = JSON.stringify(data);
    expect(data.дни.map((x) => x.день)).toEqual(['первый', 'последний']);
    expect(json).not.toMatch(/\d{2}\.\d{2}/);
    // Обозначения работ («Ф-ч», «ДЗ») в данные не идут — модель их расшифровывает наугад.
    expect(json).not.toContain('Ф-ч');
    expect(json).not.toContain('"ДЗ"');
    expect(data.дни[0].работы[0].что_проверяла).toBe('Техника дифференцирования');
    expect(data.дни[1].работы[0].что_проверяла).toBe('не описано');
    expect(data.зачёт).toMatchObject({ что_проверял: 'Касательная и производная по графику', место_в_группе: '1 из 3' });
    expect(data).toMatchObject({ пол: 'ученица', итог: '5', пересдача: 'нет', рейтинг: 'Первый рейтинг' });
  });
  it('сильные стороны есть у каждого — с них модель начинает', () => {
    const top = buildFeedbackData(columns, grid.rows, 's1', { gender: 'f' });
    expect(top.сильные_стороны).toContain('лучший результат в группе на зачётной работе');
    expect(top.сильные_стороны.join(' ')).toMatch(/без ошибок: «Техника дифференцирования»/);
    const weak = buildFeedbackData(columns, grid.rows, 's2', { gender: 'f' });
    expect(weak.сильные_стороны.length).toBeGreaterThan(0);
    expect(weak.слабые_места).toContain('к концу интенсива результаты снизились');
    expect(weak).toMatchObject({ итог: '3', пересдача: 'нет', рейтинг: 'нет' });
    const sick = buildFeedbackData(columns, grid.rows, 's3', { gender: 'f' });
    expect(sick.сильные_стороны.join(' ')).toMatch(/написала зачётную работу, хотя пропустила часть занятий/);
    expect(sick).toMatchObject({ итог: 'w', пересдача: 'да' });
    expect(sick.дни.every((x) => x.не_был_на_уроке)).toBe(true);
  });
});

// ── Промпт и чистка ответа ──────────────────────────────────────────────────

describe('промпт и чистка ответа модели', () => {
  it('правила: начинать с хорошего, темы только из описаний, пересдача и рейтинг по флагам', () => {
    expect(FEEDBACK_RULES).toMatch(/ПЕРВОЕ ПРЕДЛОЖЕНИЕ — ВСЕГДА О ХОРОШЕМ/);
    expect(FEEDBACK_RULES).toMatch(/«не описано» — тему НЕ называй/);
    expect(FEEDBACK_RULES).toMatch(/«пересдача» = «нет» — о пересдаче НЕ пиши/);
    const [sys, user] = buildFeedbackMessages({ итог: '4' }, '{ИМЯ}, образец.');
    expect(sys.content).toContain('ОБРАЗЦЫ СТИЛЯ КАФЕДРЫ');
    expect(sys.content).toContain('{ИМЯ}, образец.');
    expect(user.content).toContain('"итог": "4"');
  });
  it('обращение — токеном; кавычки и markdown снимаются', () => {
    expect(cleanFeedback('"[Имя], хорошо **поработал**."')).toBe('{ИМЯ}, хорошо поработал.');
    expect(cleanFeedback('Отмечаем работу.')).toBe('{ИМЯ}, отмечаем работу.');
    expect(cleanFeedback('{имя}, молодец.')).toBe('{ИМЯ}, молодец.');
  });
  it('страховка: без рейтинга и без пересдачи в данных такие фразы вырезаются', () => {
    expect(cleanFeedback('{ИМЯ}, отмечаем. Обрати внимание на д/з. Второй рейтинг.', { рейтинг: 'нет', пересдача: 'нет' }))
      .toBe('{ИМЯ}, отмечаем. Обрати внимание на д/з.');
    expect(cleanFeedback('{ИМЯ}, отмечаем. Ждём тебя на пересдачу.', { рейтинг: 'нет', пересдача: 'нет' }))
      .toBe('{ИМЯ}, отмечаем.');
    expect(cleanFeedback('{ИМЯ}, молодец. Первый рейтинг.', { рейтинг: 'Первый рейтинг', пересдача: 'нет' }))
      .toBe('{ИМЯ}, молодец. Первый рейтинг.');
    expect(cleanFeedback('{ИМЯ}, отмечаем. Разбирайся, готовься и сдавай зачёт.', { рейтинг: 'нет', пересдача: 'да' }))
      .toBe('{ИМЯ}, отмечаем. Разбирайся, готовься и сдавай зачёт.');
  });
});

// ── Окно «Обратная связь» ──────────────────────────────────────────────────

describe('IntensiveFeedbackModal', () => {
  beforeEach(() => {
    Object.values(apiMock).forEach((fn) => fn.mockReset());
    apiMock.generateIntensiveFeedback.mockResolvedValue({ text: '{ИМЯ}, отмечаем отличную работу. Молодец.' });
  });

  const totalIndex = columns.findIndex((c) => c.role === 'total');

  function renderModal(props = {}) {
    const onSaveComment = vi.fn(async () => {});
    const onSaveAddress = vi.fn();
    const utils = render(
      <AntApp>
        <IntensiveFeedbackModal
          open
          block={block}
          columns={columns}
          rows={grid.rows}
          totalIndex={totalIndex}
          teacher={{ id: 't1' }}
          canEdit
          onSaveComment={onSaveComment}
          onSaveAddress={onSaveAddress}
          onClose={() => {}}
          {...props}
        />
      </AntApp>,
    );
    return { ...utils, onSaveComment, onSaveAddress };
  }

  it('черновик: в запросе нет имён, в ответ подставляется обращение; сохраняется в итог', async () => {
    const { onSaveComment } = renderModal();
    expect(await screen.findByText('Дрибинская Ксения')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: /Черновик$/ })[0]);
    await waitFor(() => expect(apiMock.generateIntensiveFeedback).toHaveBeenCalledTimes(1));
    const sent = JSON.stringify(apiMock.generateIntensiveFeedback.mock.calls[0][0]);
    expect(sent).not.toContain('Дрибинская');
    expect(sent).not.toContain('Ксюша');
    expect(await screen.findByDisplayValue('Ксюша, отмечаем отличную работу. Молодец.')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: /Сохранить$/ })[0]);
    await waitFor(() => expect(onSaveComment).toHaveBeenCalledWith(
      expect.objectContaining({ id: 's1' }), 'Ксюша, отмечаем отличную работу. Молодец.',
    ));
  });

  it('«Черновики для пустых» — по всем без отзыва; без ИИ кнопки выключены', async () => {
    renderModal();
    fireEvent.click(await screen.findByRole('button', { name: /Черновики для пустых \(3\)/ }));
    await waitFor(() => expect(apiMock.generateIntensiveFeedback).toHaveBeenCalledTimes(3));
  });

  it('без ИИ черновики недоступны; без колонки итога — предупреждение', async () => {
    renderModal({ aiEnabled: false, totalIndex: -1 });
    expect(await screen.findByText(/ИИ-функции выключены/)).toBeInTheDocument();
    expect(screen.getByText(/нет колонки «Итог»/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Черновики для пустых/ })).toBeDisabled();
  });
});

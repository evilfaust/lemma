import { describe, it, expect } from 'vitest';
import {
  studentNameKey, normalizeTelegramId, validateUsername, profileDiff,
  suggestTelegramMatches, bulkSummary, BULK_ACTIONS,
} from '../utils/studentModeration';

describe('studentNameKey', () => {
  it('не зависит от порядка слов и регистра', () => {
    expect(studentNameKey('Сергеева Яна')).toBe(studentNameKey('яна сергеева'));
  });
  it('ё приравнивается к е', () => {
    expect(studentNameKey('Алёна Пётрова')).toBe(studentNameKey('Алена Петрова'));
  });
});

describe('normalizeTelegramId', () => {
  it('вытаскивает числовой id из мусора', () => {
    expect(normalizeTelegramId(' 5935392293 ').value).toBe('5935392293');
    expect(normalizeTelegramId('id: 1025669472').value).toBe('1025669472');
  });
  it('предупреждает про @username', () => {
    const r = normalizeTelegramId('@ksusha');
    expect(r.value).toBe('ksusha');
    expect(r.looksNumeric).toBe(false);
    expect(r.hint).toContain('числовой');
  });
  it('срезает ссылку t.me', () => {
    expect(normalizeTelegramId('https://t.me/ksusha').value).toBe('ksusha');
  });
  it('пустое остаётся пустым и не считается ошибкой', () => {
    expect(normalizeTelegramId('')).toEqual({ value: '', looksNumeric: true, hint: '' });
  });
});

describe('validateUsername', () => {
  it('пропускает нормальный логин', () => {
    expect(validateUsername('st_ab12')).toBe('');
  });
  it('ловит короткий, кириллицу и занятый', () => {
    expect(validateUsername('ab')).toContain('короче');
    expect(validateUsername('ксюша')).toContain('латиница');
    expect(validateUsername('Yanka', { taken: ['yanka'] })).toContain('занят');
  });
  it('пустой логин — ошибка', () => {
    expect(validateUsername('  ')).toBe('Логин обязателен');
  });
});

describe('profileDiff', () => {
  const before = { name: 'Иван', student_class: '', status: 'active', telegram_id: '' };

  it('видит только реальные изменения', () => {
    const diff = profileDiff(before, { name: 'Иван Петров', student_class: '', status: 'active' });
    expect(diff).toHaveLength(1);
    expect(diff[0]).toMatchObject({ field: 'name', label: 'Имя', to: 'Иван Петров' });
  });

  it('пустая строка и undefined — одно и то же', () => {
    expect(profileDiff({ student_class: undefined }, { student_class: '' })).toEqual([]);
  });

  it('поля, которых нет в форме, не считаются очищенными', () => {
    expect(profileDiff({ name: 'Иван', owner: 'teacher1' }, { name: 'Иван' })).toEqual([]);
  });
});

describe('suggestTelegramMatches', () => {
  const extRows = [
    { student_name: 'Сергеева Яна', telegram_id: '111', group_name: 'База 11' },
    { student_name: 'Сергеева Яна', telegram_id: '111', group_name: 'База 11' },
    { student_name: 'Куприн Леонид', telegram_id: '222', group_name: 'База 10' },
    { student_name: 'Дрибинская Ксения', telegram_id: '333', group_name: 'База 10' },
  ];

  it('точное совпадение имени идёт первым и без дублей id', () => {
    const out = suggestTelegramMatches({ student: { name: 'Яна Сергеева' }, extRows });
    expect(out[0]).toMatchObject({ telegramId: '111', match: 'exact' });
    expect(out.filter((c) => c.telegramId === '111')).toHaveLength(1);
    expect(out[0].groups).toEqual(['База 11']);
  });

  it('совпадение по фамилии — partial', () => {
    const out = suggestTelegramMatches({ student: { name: 'Куприн Лёня' }, extRows });
    expect(out[0]).toMatchObject({ telegramId: '222', match: 'partial' });
  });

  it('занятые id не предлагаются', () => {
    const out = suggestTelegramMatches({
      student: { name: 'Яна Сергеева' }, extRows, takenIds: ['111'],
    });
    expect(out.some((c) => c.telegramId === '111')).toBe(false);
    expect(out.every((c) => c.match === 'none')).toBe(true);
  });

  it('без совпадений отдаёт все свободные id', () => {
    const out = suggestTelegramMatches({ student: { name: 'Новый Ученик' }, extRows });
    expect(out).toHaveLength(3);
  });
});

describe('bulkSummary', () => {
  const students = [
    { id: 'a', teaching_group: 'g1', status: 'active' },
    { id: 'b', teaching_group: 'g2', status: 'active' },
    { id: 'c', teaching_group: '', status: 'graduated' },
  ];

  it('считает, кого реально затронет перевод в группу', () => {
    const r = bulkSummary(students, BULK_ACTIONS.GROUP, 'g1', { groupNames: { g1: '11 кл' } });
    expect(r.changed.map((s) => s.id)).toEqual(['b', 'c']);
    expect(r.skipped.map((s) => s.id)).toEqual(['a']);
    expect(r.text).toBe('Перевести в 11 кл: 2 чел. (1 уже так)');
  });

  it('пустой статус считается как active', () => {
    const r = bulkSummary([{ id: 'x', status: '' }], BULK_ACTIONS.STATUS, 'active');
    expect(r.changed).toHaveLength(0);
    expect(r.text).toContain('уже так');
  });

  it('смена статуса на «выбыл»', () => {
    const r = bulkSummary(students, BULK_ACTIONS.STATUS, 'left');
    expect(r.changed).toHaveLength(3);
    expect(r.text).toBe('Поставить статус выбыл: 3 чел.');
  });

  it('неизвестная операция ничего не меняет', () => {
    const r = bulkSummary(students, 'nope', 'x');
    expect(r.changed).toHaveLength(0);
    expect(r.skipped).toHaveLength(3);
  });
});

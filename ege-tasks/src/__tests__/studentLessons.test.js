import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import dayjs from 'dayjs';
import {
  materialVisible, itemMode, withMode, nextLessonMap, resolveHomework,
  nextLessonFor, incomingFor, homeworkFeed,
} from '../utils/homework';

// Библиотека серверного хука (CommonJS, как её подключает JSVM PocketBase).
const require = createRequire(import.meta.url);
const lib = require('../../../pocketbase/pb_hooks/lessons_feed_lib.js');

const L = (id, date, extra = {}) => ({ id, group: 'g1', owner: 't1', status: 'planned', date_plan: date, ...extra });
const hwNext = (title) => ({ kind: 'text', role: 'homework', due: 'next', title, description: title });

describe('проекция урока для ученика (lessons_feed_lib)', () => {
  it('курс: файл виден, пока не скрыт; класс: только отмеченный', () => {
    const files = [
      { type: 'material', title: 'Без пометки', url: 'u1' },
      { type: 'material', title: 'Виден', url: 'u2', visible: true },
      { type: 'material', title: 'Скрыт', url: 'u3', visible: false },
    ];
    expect(lib.projectItems(files, true).map((i) => i.title)).toEqual(['Без пометки', 'Виден']);
    expect(lib.projectItems(files, false).map((i) => i.title)).toEqual(['Виден']);
  });

  it('учительские работы, геометрия и незнакомое не уходят; срок ДЗ переносится', () => {
    const out = lib.projectItems([
      { type: 'work', id: 'w1', title: 'Работа учителя' },
      { type: 'geometry_work', id: 'gw', title: 'Геометрия' },
      { type: 'session', id: 's1', title: 'Тест', role: 'homework', due: 'next' },
      { type: 'text', text: 'Повторить', role: 'homework' },
      { type: 'text', text: 'Объявление', due: 'next' },
    ], false);
    expect(out).toEqual([
      { kind: 'work', role: 'homework', due: 'next', title: 'Тест', session_id: 's1' },
      { kind: 'text', role: 'homework', due: 'lesson', title: '', description: 'Повторить' },
      // «к след.» у не-ДЗ не бывает
      { kind: 'text', role: 'class', due: 'lesson', title: '', description: 'Объявление' },
    ]);
  });

  it('правило видимости совпадает с копией в utils/homework', () => {
    const cases = [
      { type: 'material' }, { type: 'material', visible: true }, { type: 'material', visible: false },
      { type: 'session' }, { type: 'session', visible: false }, { type: 'text' }, null,
    ];
    for (const m of cases) {
      for (const course of [true, false]) {
        expect(materialVisible(m, course)).toBe(lib.materialVisible(m, course));
      }
    }
  });

  it('pbDate — формат хранения PB (пробел вместо T)', () => {
    expect(lib.pbDate(Date.UTC(2026, 9, 5, 7, 15))).toBe('2026-10-05 07:15:00.000Z');
  });
});

describe('режим пункта: роль + срок', () => {
  it('itemMode / withMode туда и обратно', () => {
    const t = { type: 'text', text: 'x', role: 'homework' };
    expect(itemMode(t)).toBe('hw');
    expect(itemMode(withMode(t, 'hw-next'))).toBe('hw-next');
    expect(withMode(withMode(t, 'hw-next'), 'hw')).not.toHaveProperty('due');
    expect(itemMode(withMode(t, 'class'))).toBe('class');
  });

  it('ДЗ-файл класса становится видимым, явно скрытый — нет', () => {
    expect(withMode({ type: 'material' }, 'hw').visible).toBe(true);
    expect(withMode({ type: 'material', visible: false }, 'hw-next').visible).toBe(false);
    expect(withMode({ type: 'material' }, 'class').visible).toBeUndefined();
  });
});

describe('следующий урок', () => {
  it('другой день, тот же класс и учитель, не отменён и не скрыт', () => {
    const lessons = [
      L('a', '2026-10-05T07:15:00Z'),
      L('a2', '2026-10-05T08:50:00Z'),                         // тот же день — вторая полупара
      L('x', '2026-10-06T07:15:00Z', { owner: 't2' }),        // другой учитель
      L('y', '2026-10-06T07:15:00Z', { group: 'g2' }),        // другой класс
      L('c', '2026-10-07T07:15:00Z', { status: 'cancelled' }),
      L('h', '2026-10-08T07:15:00Z', { hidden_from_students: true }),
      L('b', '2026-10-09T07:15:00Z'),
    ];
    const next = nextLessonMap(lessons);
    expect(next.get('a')).toBe('b');
    expect(next.get('a2')).toBe('b');
    expect(next.get('b')).toBeNull();
  });

  it('нет следующего — ДЗ ждёт; урок появился — ДЗ у него', () => {
    const src = L('a', '2026-10-05T07:15:00Z', { items: [hwNext('№ 12')] });
    let r = resolveHomework([src], (l) => l.items);
    expect(r.pending).toHaveLength(1);
    expect(r.targetOf.get('a')).toBeNull();

    r = resolveHomework([src, L('b', '2026-10-12T07:15:00Z')], (l) => l.items);
    expect(r.pending).toHaveLength(0);
    expect(r.incoming.get('b').map((x) => x.item.title)).toEqual(['№ 12']);
    expect(r.targetOf.get('a').id).toBe('b');
  });

  it('перенос и отмена урока-цели переносят ДЗ', () => {
    const src = L('a', '2026-10-05T07:15:00Z', { items: [hwNext('№ 1')] });
    const b = L('b', '2026-10-07T07:15:00Z');
    const c = L('c', '2026-10-09T07:15:00Z');
    expect(resolveHomework([src, b, c], (l) => l.items).targetOf.get('a').id).toBe('b');
    const moved = { ...b, date_plan: '2026-10-10T07:15:00Z' };
    expect(resolveHomework([src, moved, c], (l) => l.items).targetOf.get('a').id).toBe('c');
    const cancelled = { ...b, status: 'cancelled' };
    expect(resolveHomework([src, cancelled, c], (l) => l.items).targetOf.get('a').id).toBe('c');
  });
});

describe('модалка урока: несохранённое состояние', () => {
  const neighbours = [
    L('prev', '2026-10-01T07:15:00Z', { materials: [{ type: 'text', text: 'Задача 5', role: 'homework', due: 'next' }] }),
    L('self', '2026-10-03T07:15:00Z'),
    L('later', '2026-10-08T07:15:00Z'),
  ];

  it('новый урок между прошлым и следующим забирает ДЗ', () => {
    const draft = { group: 'g1', owner: 't1', date_plan: '2026-10-06T07:15:00Z', status: 'planned' };
    expect(incomingFor(draft, neighbours.filter((l) => l.id !== 'self'), (l) => l.materials)).toHaveLength(1);
    expect(nextLessonFor(draft, neighbours).id).toBe('later');
  });

  it('урок, перенесённый в правке на дату позже следующего, ДЗ больше не получает', () => {
    const draft = { ...neighbours[1], date_plan: '2026-10-20T07:15:00Z' };
    expect(incomingFor(draft, neighbours, (l) => l.materials)).toHaveLength(0);
    expect(incomingFor(neighbours[2], neighbours.filter((l) => l.id !== 'self'), (l) => l.materials)).toHaveLength(1);
  });
});

describe('лента ДЗ ученика', () => {
  const now = dayjs('2026-10-05T12:00:00');
  it('сроки по порядку, без даты — в конце, старое и будущее «к этому уроку» — нет', () => {
    const lessons = [
      L('old', '2026-09-20T07:15:00Z', { items: [{ kind: 'text', role: 'homework', description: 'старое' }] }),
      L('mon', '2026-10-05T07:15:00Z', { items: [{ kind: 'text', role: 'homework', description: 'сегодня' }, hwNext('к среде')] }),
      L('wed', '2026-10-07T07:15:00Z', { items: [hwNext('к пятнице')] }),
      L('fri', '2026-10-09T07:15:00Z', { items: [{ kind: 'text', role: 'homework', description: 'заранее' }, hwNext('без даты')] }),
    ];
    const feed = homeworkFeed(lessons, now);
    expect(feed.map((f) => f.item.description)).toEqual(['сегодня', 'к среде', 'к пятнице', 'без даты']);
    expect(feed[1].due.id).toBe('wed');
    expect(feed[2].due.id).toBe('fri');
    expect(feed[3].due).toBeNull();
  });
});

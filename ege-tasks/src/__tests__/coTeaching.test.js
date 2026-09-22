import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  buildEvents, lessonToEvent, initialsOf,
} from '../components/workspace/calendar/calendarUtils';
import { pb, andMineOrCoTaught, andOwner } from '../shared/services/pb/client';

/**
 * Со-ведение класса (v3.9.206): второй учитель видит уроки класса, его учеников
 * и журнал. Доступ выводится ЧЕРЕЗ КЛАСС — `teaching_groups.co_teachers`.
 * Здесь проверяется клиентская половина: фильтр списков и пометка чужого урока.
 */

const ALL = { school: true, lesson: true, deadline: true, todo: true };

function loginAs(id, role = 'editor') {
  vi.spyOn(pb.authStore, 'model', 'get').mockReturnValue({
    id, role, collectionName: 'teachers',
  });
}

describe('andMineOrCoTaught', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('без учителя (ученический контур) фильтр прозрачен', () => {
    vi.spyOn(pb.authStore, 'model', 'get').mockReturnValue(null);
    expect(andMineOrCoTaught('date_plan >= "x"')).toBe('date_plan >= "x"');
  });

  it('собирает «моё + со-ведение + расшаренное»', () => {
    loginAs('t1');
    const f = andMineOrCoTaught('', { shareField: 'shared_with' });
    expect(f).toBe('(owner = "t1" || group.co_teachers.id ?= "t1" || shared_with.id ?= "t1")');
  });

  it('для самой группы со-ведущие лежат на записи, без обхода relation', () => {
    loginAs('t1');
    const f = andMineOrCoTaught('archived != true', { groupPath: '', shareField: 'co_teachers' });
    expect(f).toBe('(archived != true) && (owner = "t1" || co_teachers.id ?= "t1")');
  });

  it('🚨 у superadmin фильтр НЕ снимается — иначе календарь завуча = вся школа', () => {
    loginAs('boss', 'superadmin');
    // andOwner для superadmin прозрачен...
    expect(andOwner('')).toBe('');
    // ...а видимость уроков — про роль в классе, а не про права в системе.
    expect(andMineOrCoTaught('')).toContain('owner = "boss"');
  });
});

describe('чужой урок на сетке', () => {
  const lesson = (extra = {}) => ({
    id: 'l1', title: 'Производная', date_plan: '2026-09-16T10:15:00Z',
    owner: 't2', group: 'g1',
    expand: { owner: { id: 't2', name: 'Иванов Пётр' }, group: { id: 'g1', name: '10 БАЗА' } },
    ...extra,
  });

  it('урок коллеги помечен ведущим', () => {
    const { resource } = lessonToEvent(lesson(), 't1');
    expect(resource.isForeign).toBe(true);
    expect(resource.ownerName).toBe('Иванов Пётр');
  });

  it('свой урок не помечается', () => {
    expect(lessonToEvent(lesson({ owner: 't1' }), 't1').resource.isForeign).toBe(false);
  });

  it('без залогиненного учителя пометки нет (старое поведение)', () => {
    expect(lessonToEvent(lesson()).resource.isForeign).toBe(false);
  });

  it('buildEvents прокидывает id учителя до события', () => {
    const [e] = buildEvents({
      lessons: [lesson()], deadlines: [], todos: [], filters: ALL, groupFilter: null, myTeacherId: 't1',
    });
    expect(e.resource.isForeign).toBe(true);
  });

  it('инициалы для метки', () => {
    expect(initialsOf('Иванов Пётр')).toBe('ИП');
    expect(initialsOf('Иванов Пётр Сергеевич')).toBe('ИП');
    expect(initialsOf('teacher')).toBe('T');
    expect(initialsOf('')).toBe('');
  });
});

describe('миграция правил со-ведения', () => {
  const sql = readFileSync(
    resolve(__dirname, '../../../pocketbase/pb_migrations/1786200000_co_teacher_rules.js'),
    'utf-8',
  );

  it('доступ выводится через класс, а не копируется в каждую коллекцию', () => {
    // Один источник правды: co_teachers лежит только на teaching_groups.
    expect(sql).toContain('group.co_teachers ?= @request.auth.id');
    expect(sql).toContain('lesson.group.co_teachers ?= @request.auth.id');
    expect(sql).toContain('teaching_group.co_teachers ?= @request.auth.id');
  });

  it('🚨 удаление класса и правка ученика остаются у владельца', () => {
    // Смотрим ИМЕННО блок коллекции в NEW_RULES: правило с тем же именем
    // ниже по файлу (у другой коллекции) не должно засчитываться.
    const newRules = sql.split('const NEW_RULES')[1].split('// Снимок ПРОДа')[0];
    const block = (name) => (newRules.match(new RegExp(`${name}: \\{([\\s\\S]*?)\\n  \\},`)) || [])[1] || '';
    // Ищем присвоение правила (с двоеточием) — в блоке есть комментарий,
    // объясняющий, почему deleteRule не трогаем.
    expect(block('teaching_groups')).toContain('updateRule:');
    expect(block('teaching_groups')).not.toContain('deleteRule:');
    expect(block('students')).toContain('listRule:');
    expect(block('students')).not.toContain('updateRule:');
  });

  it('заметки открываются только привязанные к уроку', () => {
    expect(sql).toContain('lesson != ""');
  });

  it('есть снимок прежних правил для отката', () => {
    expect(sql).toContain('OLD_RULES');
    for (const name of ['teaching_groups', 'lessons', 'lesson_attendance', 'students', 'group_memberships', 'teacher_notes']) {
      expect(sql.split('OLD_RULES')[1]).toContain(`${name}:`);
    }
  });
});

describe('починка правил со-ведения: `.id` у мульти-relation (v3.9.227)', () => {
  // В PB 0.36 `co_teachers ?= @request.auth.id` отвечает 200, но не совпадает
  // никогда — второй учитель видел пустоту. Нужна форма `co_teachers.id ?=`.
  const src = readFileSync(
    resolve(__dirname, '../../../pocketbase/pb_migrations/1786300000_fix_co_teacher_rules_id.js'),
    'utf-8',
  );
  const up = /r\.replace\((\/.*?\/g), '(.*?)'\)/.exec(src.split('migrate(')[1]);
  const re = new Function(`return ${up[1]}`)();
  const fix = (r) => r.replace(re, up[2]);

  it('дописывает .id во все пути до со-ведущих и точечного доступа', () => {
    expect(fix('owner = x || co_teachers ?= @request.auth.id')).toBe('owner = x || co_teachers.id ?= @request.auth.id');
    expect(fix('group.co_teachers ?= @request.auth.id || shared_with ?= @request.auth.id'))
      .toBe('group.co_teachers.id ?= @request.auth.id || shared_with.id ?= @request.auth.id');
    expect(fix('lesson.group.co_teachers ?= a || lesson.shared_with ?= a'))
      .toBe('lesson.group.co_teachers.id ?= a || lesson.shared_with.id ?= a');
  });

  it('повторный прогон ничего не ломает (уже исправленное не трогает)', () => {
    const once = fix('co_teachers ?= a');
    expect(fix(once)).toBe(once);
  });

  it('клиентский фильтр больше не содержит голого `co_teachers ?=`', () => {
    loginAs('t1');
    const f = andMineOrCoTaught('', { shareField: 'shared_with' });
    expect(f).not.toMatch(/(co_teachers|shared_with) \?=/);
    vi.restoreAllMocks();
  });
});

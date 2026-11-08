// @vitest-environment node
import { createRequire } from 'node:module';
import { describe, it, expect, vi } from 'vitest';
const { assignedTests } = createRequire(import.meta.url)('../../../pocketbase/pb_hooks/group_tests_lib.js');
const record = (id, data) => ({ id, getString: (key) => String(data[key] || ''), getBool: (key) => !!data[key] });

function fixture({ migrated = true, sessions = [], attempts = [], groups = {} } = {}) {
  return {
    findCollectionByNameOrId: () => ({ fields: { getByName: () => migrated ? {} : null } }),
    findRecordById: (col, id) => {
      if (col === 'teaching_groups') return record(id, groups[id] || {});
      if (col === 'works') return record(id, { title: 'Производная' });
      throw new Error('not found');
    },
    findRecordsByFilter: vi.fn((col, filter, sort, limit, offset) => (col === 'attempts' ? attempts : sessions).slice(offset, offset + limit)),
  };
}

describe('серверная лента тестов группы', () => {
  it('выбирает открытые выдачи только групп ученика и только его попытки; отдаёт проекцию', () => {
    const app = fixture({ sessions: [record('s1', { work: 'w1', student_title: 'Тест', deadline: '2026-10-31 15:00:00.000Z', variants: 'secret', owner: 'teacher' })],
      attempts: [record('a1', { session: 's1', status: 'submitted' }), record('a2', { session: 's1', status: 'started' })] });
    expect(assignedTests(app, ['g1', 'previousYear'], 'student1')).toEqual([
      { id: 's1', title: 'Производная', deadline: '2026-10-31 15:00:00.000Z', status: 'submitted' },
    ]);
    const [sessionQuery, attemptQuery] = app.findRecordsByFilter.mock.calls;
    expect(sessionQuery[1]).toContain('is_open = true');
    expect(sessionQuery[1]).toContain('groups.id ?= {:g0}');
    expect(attemptQuery[1]).toContain('student = {:s}');
    expect(attemptQuery[1]).toContain('session.groups.id ?= {:g1}');
    expect(attemptQuery[5]).toMatchObject({ s: 'student1', g0: 'g1', g1: 'previousYear' });
  });
  it('не ограничивает статусы первыми 500 попытками и сохраняет название учителя', () => {
    const attempts = Array.from({ length: 500 }, (_, i) => record(`a${i}`, { session: 's1', status: 'started' }));
    attempts.push(record('last', { session: 's1', status: 'corrected' }));
    const app = fixture({ sessions: [record('s1', { student_title: 'Субботний тест', work: 'w1' })], attempts });
    expect(assignedTests(app, ['g1'], 'student1')[0]).toMatchObject({ title: 'Субботний тест', status: 'submitted' });
    expect(app.findRecordsByFilter.mock.calls.some((args) => args[4] === 500)).toBe(true);
  });
  it('новый тест без попытки = не приступал; ошибка чтения не маскируется пустым списком', () => {
    const app = fixture({ sessions: [record('s1', { student_title: 'Алгебра' })] });
    expect(assignedTests(app, ['g1'], 'student1')[0].status).toBe('untouched');
    app.findRecordsByFilter.mockImplementation(() => { throw new Error('db failed'); });
    expect(() => assignedTests(app, ['g1'], 'student1')).toThrow('db failed');
  });
  it('нет групп / миграции / курс завершён — нет тестов', () => {
    for (const [app, groups] of [
      [fixture(), []], [fixture({ migrated: false }), ['g1']],
      [fixture({ groups: { course: { kind: 'course', completed: true } } }), ['course']],
    ]) {
      expect(assignedTests(app, groups, 's')).toEqual([]);
      expect(app.findRecordsByFilter).not.toHaveBeenCalled();
    }
  });
});

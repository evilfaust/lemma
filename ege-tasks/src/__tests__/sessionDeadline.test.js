// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'node:module';
import { deadlinePassed, attemptElapsedSeconds, intakeClosedReason } from '../utils/sessionDeadline';
const { guard } = createRequire(import.meta.url)('../../../pocketbase/pb_hooks/session_deadline_lib.js');
const now = Date.parse('2026-11-02T12:00:00Z');
const record = (collection, data) => ({ collection: () => ({ name: collection }),
  getString: (key) => String(data[key] ?? ''), getBool: (key) => !!data[key],
  set: (key, value) => { data[key] = value; } });
function fixture({ strict = true, deadline = new Date(now).toISOString(), collection = 'attempts', teacher = false, open = true } = {}) {
  const data = { session: 's', attempt: 'a', created: new Date(now - 90000).toISOString(), status: 'submitted' };
  const original = record(collection, { ...data, status: 'started' });
  const r = record(collection, data); r.original = () => original;
  return { data, e: { record: r, hasSuperuserAuth: () => false,
    auth: teacher ? record('teachers', {}) : null,
    app: { findRecordById: (col) => col === 'attempts' ? record('attempts', { session: 's' }) : record('work_sessions', { strict_deadline: strict, deadline, is_open: open }) },
    next: vi.fn(() => 'ok') } };
}
globalThis.ForbiddenError = class extends Error {};
describe('строгий срок', () => {
  it('граница срока, выключенный флаг и пустая дата', () => {
    const s = { strict_deadline: true, deadline: new Date(now).toISOString() };
    expect(deadlinePassed(s, now - 1)).toBe(false);
    expect(deadlinePassed(s, now)).toBe(true);
    expect(deadlinePassed({ ...s, strict_deadline: false }, now)).toBe(false);
    expect(deadlinePassed({ ...s, deadline: '' }, now)).toBe(false);
  });
  it.each(['attempts', 'attempt_answers'])('блокирует создание и изменение %s', (collection) => {
    for (const creating of [false, true]) {
      const { e } = fixture({ collection });
      expect(() => guard(e, creating, now)).toThrow('Срок сдачи истёк');
      expect(e.next).not.toHaveBeenCalled();
    }
  });
  it('условный/пустой срок, время до срока и учитель сохраняют доступ', () => {
    for (const options of [{ strict: false }, { deadline: '' }, { deadline: new Date(now + 1).toISOString() }, { teacher: true }]) {
      expect(guard(fixture(options).e, false, now)).toBe('ok');
    }
  });
  it.each(['attempts', 'attempt_answers'])('ручное закрытие блокирует создание и изменение %s при мягком сроке', (collection) => {
    for (const creating of [false, true]) {
      const options = { collection, strict: false, open: false };
      expect(() => guard(fixture(options).e, creating, now)).toThrow('Учитель закрыл приём ответов');
      expect(guard(fixture({ ...options, teacher: true }).e, creating, now)).toBe('ok');
    }
    expect(intakeClosedReason({ is_open: false })).toBe('Учитель закрыл приём ответов.');
  });
  it('сервер записывает время сдачи и длительность', () => {
    const { e, data } = fixture({ strict: false }); guard(e, false, now);
    expect(data.submitted_at).toBe(new Date(now).toISOString()); expect(data.duration_seconds).toBe(90);
  });
  it('сервер фиксирует первый вход в выданную учителем попытку', () => {
    const { e, data } = fixture({ strict: false });
    data.status = 'started'; data.started_at = 'client-time';
    guard(e, false, now);
    expect(data.started_at).toBe(new Date(now).toISOString());
  });
  it('таймер переживает перезагрузку', () => {
    expect(attemptElapsedSeconds({ created: new Date(now - 125000).toISOString() }, now)).toBe(125);
    expect(attemptElapsedSeconds({ created: 'invalid' }, now)).toBe(0);
  });
});

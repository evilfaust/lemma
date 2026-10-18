import { describe, expect, it } from 'vitest';
import { adoptPatch, cellKey, GEN_SOURCE, isGenTask, mineRecord } from '../utils/geometryAdopt';
import { generateGenTask, genTaskToRecord } from '../utils/stereo/genTasks';

describe('задачи генератора → «Мои»', () => {
  it('перевод на месте: код GEO, своя область, старый код — в источнике', () => {
    const task = { id: 'x', origin: 'gen', code: 'ANG-YO5M4-2', source: GEN_SOURCE };
    expect(adoptPatch(task, 'GEO-512', { topic: 't1', subtopic: 's1' })).toEqual({
      origin: 'manual',
      code: 'GEO-512',
      source: `${GEN_SOURCE}, ANG-YO5M4-2`,
      topic: 't1',
      subtopic: 's1',
    });
  });

  it('без темы подтема не ставится; повторный код в источник не дублируется', () => {
    const task = { origin: 'gen', code: 'SEC-1', source: `${GEN_SOURCE}, SEC-1` };
    const p = adoptPatch(task, 'GEO-001', { subtopic: 's1' });
    expect(p.topic).toBeNull();
    expect(p.subtopic).toBeNull();
    expect(p.source).toBe(`${GEN_SOURCE}, SEC-1`);
  });

  it('пустой источник — подставляется «Генератор задач по стереометрии»', () => {
    expect(adoptPatch({ origin: 'gen', code: 'A' }, 'GEO-1').source).toBe(`${GEN_SOURCE}, A`);
  });

  it('новое задание генератора сразу своей задачей — всё содержимое сохраняется', () => {
    let task = null;
    for (let seed = 1; !task && seed < 50; seed += 1) {
      task = generateGenTask({ type: 'angleLines', body: 'cube', level: 2, seed });
    }
    const rec = genTaskToRecord(task, { code: '' });
    const mine = mineRecord({ ...rec, tags: ['f1'] }, 'GEO-777', { topic: 't1' });
    expect(mine.origin).toBe('manual');
    expect(mine.code).toBe('GEO-777');
    expect(mine.topic).toBe('t1');
    expect(mine.subtopic).toBeNull();
    expect(mine.statement_md).toBe(rec.statement_md);
    expect(mine.answer).toBe(rec.answer);
    expect(mine.drawing_svg).toBe(rec.drawing_svg);
    expect(mine.solution_md).toBe(rec.solution_md);
    expect(mine.section).toBe('stereo');
    expect(mine.tags).toEqual(['f1']);
    expect(mine.source).toBe(GEN_SOURCE);
  });

  it('isGenTask и ключ ячейки', () => {
    expect(isGenTask({ origin: 'gen' })).toBe(true);
    expect(isGenTask({ origin: 'manual' })).toBe(false);
    expect(isGenTask(null)).toBe(false);
    expect(cellKey(1, 3)).toBe('1:3');
  });
});

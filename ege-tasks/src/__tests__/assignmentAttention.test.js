import { describe, expect, it } from 'vitest';
import { assignmentNeedsAttention, assignmentProgress, assignmentReviewed } from '../utils/assignmentAttention';

const session = { deadline: '2026-11-01 14:00:00.000Z' };
const now = Date.parse('2026-11-10T14:00:00Z');
const anya = { id: 'a', name: 'Анна' };
const boris = { id: 'b', name: 'Борис' };
const submitted = { student: anya.id, status: 'submitted' };

describe('очередь внимания по выдачам', () => {
  it('считает ученика из двух групп один раз и не путает пересдачу с отсутствием сдачи', () => {
    const progress = assignmentProgress([anya, boris, anya], [submitted, { student: anya.id, status: 'started' }]);
    expect(progress).toMatchObject({ expected: 2, missing: 1, submitted: [anya], untouched: [boris] });
    expect(assignmentNeedsAttention(session, progress, now)).toBe(true);
    expect(assignmentNeedsAttention(session, progress, Date.parse('2026-11-01T13:59:59Z'))).toBe(false);
  });

  it('убирает полностью сданную работу, включая исправленные учителем и гостевые сдачи', () => {
    const progress = assignmentProgress([anya, boris], [
      { ...submitted, status: 'corrected' },
      { student_name: 'Борис', status: 'submitted' },
    ]);
    expect(progress.missing).toBe(0);
    expect(assignmentNeedsAttention(session, progress, now)).toBe(false);
  });

  it('оставляет выдачу по ссылке или с недоступной сводкой до разбора учителем', () => {
    const progress = assignmentProgress([], [submitted]);
    expect(progress).toMatchObject({ expected: 0, submittedAttempts: 1 });
    expect(assignmentNeedsAttention(session, progress, now)).toBe(true);
    expect(assignmentNeedsAttention(session, null, now)).toBe(true);
    const reviewed = { ...session, reviewed_deadline: '2026-11-01T14:00:00.000Z' };
    expect(assignmentReviewed(reviewed)).toBe(true);
    expect(assignmentNeedsAttention(reviewed, progress, now)).toBe(false);
    expect(assignmentNeedsAttention({ ...reviewed, deadline: '2026-11-09T14:00:00.000Z' }, progress, now)).toBe(true);
  });
});

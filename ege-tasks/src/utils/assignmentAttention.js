import { groupTestProgress } from './groupTests';

export const assignmentPath = (id) => `/app/today/assignments/${encodeURIComponent(id)}`;
export const assignmentDeadlineTime = (value) => Date.parse((value || '').replace(' ', 'T'));

export function assignmentReviewed(session) {
  return Boolean(session.deadline && session.reviewed_deadline
    && assignmentDeadlineTime(session.deadline) === assignmentDeadlineTime(session.reviewed_deadline));
}

export function assignmentProgress(students, attempts) {
  const unique = [...new Map(students.map((student) => [student.id, student])).values()];
  const progress = groupTestProgress(unique, attempts);
  const missing = progress.started.length + progress.untouched.length;
  const expected = progress.submitted.length + missing;
  const submittedAttempts = attempts.filter((a) => a.status === 'submitted' || a.status === 'corrected').length;
  return { ...progress, missing, expected, submittedAttempts };
}

export function assignmentNeedsAttention(session, progress, now) {
  const deadline = assignmentDeadlineTime(session.deadline);
  return deadline <= now && !assignmentReviewed(session)
    && (!progress?.expected || progress.missing > 0);
}

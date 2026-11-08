import dayjs from 'dayjs';
import { studentWorkTitle } from './studentWorkTitle';

const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
const norm = (value) => clean(value).toLocaleLowerCase('ru');
export const sortedRoster = (students = []) => [...students].sort((a, b) => clean(a.name).localeCompare(clean(b.name), 'ru'));

export function groupRosterText(group, students) {
  return [group.name, ...sortedRoster(students).map((s, i) => `${i + 1}. ${clean(s.name) || 'Без имени'}`)].join('\n');
}

// Попытка с аккаунтом сопоставляется только по id. Гостевая — по полному
// имени, только если в группе нет тёзок. Одна сдача важнее начатой пересдачи.
export function groupTestProgress(students = [], attempts = []) {
  const names = new Map();
  for (const s of students) names.set(norm(s.name), (names.get(norm(s.name)) || 0) + 1);
  const result = { submitted: [], started: [], untouched: [], external: [] };
  for (const s of sortedRoster(students)) {
    if (s.external) { result.external.push(s); continue; }
    const mine = attempts.filter((a) => a.student ? a.student === s.id
      : norm(s.name) && names.get(norm(s.name)) === 1 && norm(a.student_name) === norm(s.name));
    const key = mine.some((a) => ['submitted', 'corrected'].includes(a.status)) ? 'submitted'
      : mine.some((a) => a.status === 'started') ? 'started' : 'untouched';
    result[key].push(s);
  }
  return result;
}

export const PROGRESS_LABELS = {
  submitted: 'Сдали', started: 'Начали, но не отправили', untouched: 'Не приступали', external: 'Без аккаунта',
};

export function groupTestProgressText(group, session, progress) {
  const header = [group.name, studentWorkTitle(session)];
  if (session.deadline) header.push(`Срок сдачи: ${dayjs(session.deadline).format('DD.MM.YYYY HH:mm')}`);
  if (!session.is_open) header.push('Приём закрыт');
  const sections = Object.entries(PROGRESS_LABELS).filter(([key]) => key !== 'external' || progress[key].length)
    .map(([key, label]) => `${label} (${progress[key].length}):\n${progress[key].length
      ? progress[key].map((s, i) => `${i + 1}. ${clean(s.name) || 'Без имени'}`).join('\n') : '—'}`);
  return [header.join('\n'), ...sections].join('\n\n');
}

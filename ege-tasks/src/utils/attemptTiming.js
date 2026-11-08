function parseDate(value) {
  const date = new Date(String(value ?? '').replace(' ', 'T'));
  return Number.isFinite(date.getTime()) ? date : null;
}

export function getAttemptTiming(attempt) {
  if (attempt.source === 'scan') return { start: null, end: null, seconds: null };
  // Пустой started_at означает, что ученик ещё не открыл выданную попытку.
  const start = parseDate(attempt.started_at ?? attempt.created);
  const end = attempt.status === 'started' ? null : parseDate(attempt.submitted_at);
  const seconds = start && end && end >= start ? Math.floor((end - start) / 1000) : null;
  return { start, end, seconds };
}

export function averageAttemptDuration(attempts) {
  const durations = attempts.map(attempt => getAttemptTiming(attempt).seconds)
    .filter(seconds => seconds !== null);
  return durations.length
    ? Math.round(durations.reduce((sum, seconds) => sum + seconds, 0) / durations.length)
    : null;
}

export function formatAttemptDuration(seconds) {
  if (seconds === null) return '—';
  const minutes = Math.floor(seconds / 60);
  if (minutes >= 60) return `${Math.floor(minutes / 60)} ч ${minutes % 60} мин`;
  if (minutes > 0) return `${minutes} мин`;
  return `${seconds} с`;
}

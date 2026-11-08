// Дедлайн действует только при явно включённом строгом сроке.
export function deadlinePassed(session, now = Date.now()) {
  const deadline = Date.parse(session?.deadline || '');
  return session?.strict_deadline === true && Number.isFinite(deadline) && now >= deadline;
}

export function intakeClosedReason(session) {
  if (session?.is_open === false) return 'Учитель закрыл приём ответов.';
  return deadlinePassed(session) ? 'Срок сдачи истёк. Приём ответов закрыт.' : '';
}

export function attemptElapsedSeconds(attempt, now = Date.now()) {
  const start = Date.parse(attempt?.started_at || attempt?.created || '');
  return Number.isFinite(start) ? Math.max(0, Math.floor((now - start) / 1000)) : 0;
}

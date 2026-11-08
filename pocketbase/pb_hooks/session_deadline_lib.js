// Только серверное время: часы клиента не влияют на допуск.
function assertIntake(app, sessionId, now) {
  const session = app.findRecordById('work_sessions', sessionId);
  if (!session.getBool('is_open')) {
    throw new ForbiddenError('Учитель закрыл приём ответов.');
  }
  const deadline = Date.parse(session.getString('deadline'));
  if (session.getBool('strict_deadline') && Number.isFinite(deadline) && now >= deadline) {
    throw new ForbiddenError('Срок сдачи истёк. Приём ответов закрыт.');
  }
}
function guard(e, creating, now = Date.now()) {
  if (e.hasSuperuserAuth() || e.auth?.collection().name === 'teachers') return e.next();
  const isAnswer = e.record.collection().name === 'attempt_answers';
  const records = [e.record];
  if (!creating) records.push(e.record.original());
  const sessions = {};
  for (const record of records) {
    const attempt = isAnswer ? e.app.findRecordById('attempts', record.getString('attempt')) : record;
    const sessionId = attempt.getString('session');
    if (sessionId && !sessions[sessionId]) {
      assertIntake(e.app, sessionId, now);
      sessions[sessionId] = true;
    }
  }
  if (!isAnswer) {
    const originalStart = creating ? '' : e.record.original().getString('started_at');
    if (creating || (!originalStart && e.record.getString('started_at'))) {
      e.record.set('started_at', new Date(now).toISOString());
    } else if (originalStart) {
      e.record.set('started_at', originalStart);
    }
  }
  if (!isAnswer && e.record.getString('status') === 'submitted'
    && (creating || e.record.original().getString('status') === 'started')) {
    e.record.set('submitted_at', new Date(now).toISOString());
    const start = Date.parse(e.record.getString('started_at') || e.record.getString('created'));
    if (Number.isFinite(start)) e.record.set('duration_seconds', Math.max(0, Math.floor((now - start) / 1000)));
  }
  return e.next();
}
module.exports = { guard };

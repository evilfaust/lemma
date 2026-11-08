/// <reference path="../pb_data/types.d.ts" />

onRecordUpdate((e) => {
  const record = e.record;
  if (record.getString('status') !== 'submitted') return e.next();

  // Проверка истории и сохранение попытки проходят в одной транзакции.
  const app = e.app;
  return app.runInTransaction((tx) => {
    const badges = tx.findRecordsByFilter('achievements',
      'type = "condition" && condition_type = "perfect_after_errors"', '', 0, 0);
    if (badges.length) {
      const saved = tx.findRecordById('attempts', record.id);
      const field = 'unlocked_achievements';
      const serverIds = badges.map(badge => badge.id);
      const unlocked = record.getStringSlice(field).filter(id => !serverIds.includes(id));
      // Повторная отправка после сетевого сбоя сохраняет уже полученную ачивку.
      unlocked.push(...saved.getStringSlice(field).filter(id => serverIds.includes(id)));

      const total = record.getFloat('total');
      if (saved.getString('status') === 'started' &&
          total > 0 && record.getFloat('score') === total &&
          tx.findRecordById('work_sessions', record.getString('session')).getBool('achievements_enabled')) {
        const student = saved.getString('student');
        const device = saved.getString('device_id');
        const identity = student
          ? 'student = {:student}'
          : 'student = "" && device_id = {:device} && device_id != "" && device_id != "paper-scan"';
        const history = tx.findRecordsByFilter('attempts',
          `id != {:id} && ${identity} && (status = "submitted" || status = "corrected") && total > 0`,
          '', 0, 0, { id: record.id, student, device });
        const submittedAt = a => a.getString('submitted_at') || a.getString('created');
        const lastTwo = history.sort((a, b) => submittedAt(b).localeCompare(submittedAt(a))
          || b.getString('created').localeCompare(a.getString('created'))).slice(0, 2);
        if (lastTwo.length === 2 && lastTwo.every(a => a.getFloat('score') < a.getFloat('total'))) {
          const earned = new Set(history.flatMap(a => a.getStringSlice(field)));
          unlocked.push(...serverIds.filter(id => !earned.has(id)));
        }
      }

      record.set(field, [...new Set(unlocked)]);
    }

    e.app = tx;
    try {
      return e.next();
    } finally {
      e.app = app;
    }
  });
}, 'attempts');

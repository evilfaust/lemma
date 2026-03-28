/// <reference path="../pb_data/types.d.ts" />

/**
 * Автоматически пересчитывает success_rate задачи после каждого ответа ученика.
 * success_rate = доля правильных ответов по всем попыткам для данной задачи (0.0–1.0).
 */

function updateTaskSuccessRate(app, taskId) {
  if (!taskId) return;
  try {
    const db = app.db();
    const row = new DynamicModel({ total: 0, correct: 0 });
    db.newQuery(
      `SELECT COUNT(*) as total, SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) as correct
       FROM attempt_answers WHERE task = {:taskId}`
    ).bind({ taskId }).one(row);

    // -1 означает «нет данных», ≥0 — реальный процент
    const rate = row.total > 0 ? row.correct / row.total : -1;
    db.newQuery("UPDATE tasks SET success_rate = {:rate} WHERE id = {:id}")
      .bind({ rate: rate, id: taskId })
      .execute();
  } catch (err) {
    console.error('[stats hook] Error updating success_rate for task', taskId, String(err));
  }
}

onRecordAfterCreateSuccess((e) => {
  updateTaskSuccessRate(e.app, e.record.getString('task'));
  e.next();
}, 'attempt_answers');

onRecordAfterUpdateSuccess((e) => {
  updateTaskSuccessRate(e.app, e.record.getString('task'));
  e.next();
}, 'attempt_answers');

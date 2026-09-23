import { api } from '../../../shared/services/pocketbase';

/**
 * Сохранить урок из LessonModal: правка или создание + витрина для учеников
 * курса (no-op, если группа урока — не курс). Общий путь календаря и «Сегодня».
 * Возвращает id урока.
 */
export async function saveLesson(existingId, data, meta = {}) {
  let id = existingId;
  if (id) await api.updateLesson(id, data);
  else id = (await api.createLesson(data)).id;
  try {
    await api.syncLessonPublication(id, { published: meta.published !== false });
  } catch (e) {
    console.error('syncLessonPublication', e?.message);
  }
  return id;
}

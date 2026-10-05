import { api } from '../../../shared/services/pocketbase';

/**
 * Сохранить урок из LessonModal: правка или создание. Общий путь календаря и
 * «Сегодня». Возвращает id урока. (До v3.9.293 здесь же пересобиралась витрина
 * курса lesson_publications — ученик теперь читает сам урок через хук.)
 */
export async function saveLesson(existingId, data) {
  if (existingId) {
    await api.updateLesson(existingId, data);
    return existingId;
  }
  return (await api.createLesson(data)).id;
}

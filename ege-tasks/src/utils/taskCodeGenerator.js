import { api } from '../services/pocketbase';
import { previewNextCode } from './taskCode';

/**
 * Подсказка: какой код получит новая задача темы (≈ П12-427).
 *
 * С v3.9.397 код присваивает сервер (хук task_codes.pb.js) — задачу создают с
 * пустым кодом, а это только предпросмотр для окна создания. Пустая строка —
 * тема кодов не раздаёт (Гордин, смешанная тема Мордковича): код введут руками.
 */
export async function generateTaskCode(topicId, topic = null) {
  if (!topicId) return '';
  if (!topic) {
    const topics = await api.getTopics();
    topic = topics.find((t) => t.id === topicId);
    if (!topic) return '';
  }
  const tasks = await api.getTasks({ topic: topicId });
  return previewNextCode(topic, tasks.map((t) => t.code).filter(Boolean));
}

/**
 * Код в формате банка: префикс темы (П12, ПА12, ОГ5, В7.15, Т1, КУ, И11,
 * ВХ11П, М16) + дефис + номер от трёх цифр. Буквы — кириллица.
 */
export function validateTaskCode(code) {
  return /^[А-ЯЁ]{1,5}(\d+(\.\d+)?)?[А-ЯЁ]{0,2}-\d{3,}$/.test(String(code || ''));
}

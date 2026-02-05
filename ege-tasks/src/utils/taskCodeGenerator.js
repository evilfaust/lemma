import { api } from '../services/pocketbase';

/**
 * Генерирует следующий код задачи для заданной темы
 * @param {string} topicId - ID темы
 * @param {object} topic - Объект темы (опционально, будет загружен если не передан)
 * @returns {Promise<string>} - Новый код задачи
 */
export async function generateTaskCode(topicId, topic = null) {
  // Валидация topicId
  if (!topicId) {
    throw new Error('topicId обязателен для генерации кода');
  }

  // 1. Получить тему если не передана или неполная
  if (!topic || !topic.ege_number) {
    console.log('[taskCodeGenerator] Topic не передана или неполная, загружаем из API. topicId:', topicId);

    const topics = await api.getTopics();
    topic = topics.find(t => t.id === topicId);

    if (!topic) {
      throw new Error(`Тема с ID "${topicId}" не найдена в базе данных`);
    }

    console.log('[taskCodeGenerator] Тема загружена:', {
      id: topic.id,
      title: topic.title,
      ege_number: topic.ege_number
    });
  }

  // 2. Проверить наличие ege_number
  const egeNumber = topic.ege_number;
  if (!egeNumber && egeNumber !== 0) {
    console.error('[taskCodeGenerator] Тема без ege_number:', topic);
    throw new Error(`У темы "${topic.title || topic.id}" не указан номер ЕГЭ (ege_number)`);
  }

  // 3. Получить все задачи этой темы
  const tasks = await api.getTasks({ topic: topicId });
  console.log(`[taskCodeGenerator] Найдено ${tasks.length} задач для темы №${egeNumber}`);

  // 4. Извлечь все номера кодов
  const counters = [];
  const prefix = `${egeNumber}-`;

  tasks.forEach(task => {
    if (!task.code || !task.code.startsWith(prefix)) {
      return;
    }

    const parts = task.code.split('-');
    if (parts.length !== 2) {
      return;
    }

    const num = parseInt(parts[1], 10);
    if (!isNaN(num)) {
      counters.push(num);
    }
  });

  // 5. Найти следующий номер
  const nextNumber = counters.length > 0 ? Math.max(...counters) + 1 : 1;

  // 6. Сформировать код с zero-padding
  const code = `${egeNumber}-${String(nextNumber).padStart(3, '0')}`;

  console.log(`[taskCodeGenerator] Сгенерирован код: ${code}`);

  return code;
}

/**
 * Валидация формата кода задачи
 * @param {string} code - Код для валидации
 * @returns {boolean}
 */
export function validateTaskCode(code) {
  const pattern = /^\d+-\d{3}$/;
  return pattern.test(code);
}

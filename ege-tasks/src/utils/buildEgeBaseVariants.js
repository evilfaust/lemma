import { generateEgeBaseTask, generatorsForTopic } from './egeBaseGeneratedTasks';
import { shuffleArray } from './shuffle';

/** Сначала готовим полный состав, затем сохраняем новые задачи.
 * Пустой слот — ошибка: следующие номера ЕГЭ не должны сдвигаться.
 * API передаётся аргументом, чтобы проверки не обращались к боевой базе.
 */
export async function buildEgeBaseVariants({ slots, topics, subtopics, variantsCount, variantsMode, api }) {
  if (!Number.isInteger(variantsCount) || variantsCount < 1 || variantsCount > 30) throw new Error('Укажите от 1 до 30 вариантов');
  const byId = new Map(topics.map(t => [t.id, t]));
  for (const slot of slots) {
    const topic = byId.get(slot.topicId);
    if (!topic || topic.exam_type !== 'ege_base') throw new Error('Тема базового ЕГЭ не найдена');
    if (slot.pinnedTask && slot.pinnedTask.topic !== slot.topicId) throw new Error(`Зафиксированная задача не относится к №${topic.ege_number}`);
    if (!slot.pinnedTask && slot.source === 'generated' && !generatorsForTopic(topic, subtopics, slot.subtopics).some(g => g.id === slot.generatorId)) {
      throw new Error(`Выберите подходящий тип генерации для №${topic.ege_number}`);
    }
  }
  const pools = await Promise.all(slots.map(async slot => {
    if (slot.pinnedTask || slot.source === 'generated') return [];
    // difficulty API принимает одну сложность; несколько фильтруем после чтения.
    const tasks = await api.getTasks({ topic: slot.topicId, subtopics: slot.subtopics, tags: slot.tags });
    return shuffleArray(tasks.filter(t => !slot.difficulty?.length || slot.difficulty.map(String).includes(String(t.difficulty))));
  }));
  // Банк проверяем до генерации и до первой записи.
  pools.forEach((pool, i) => {
    const slot = slots[i];
    if (slot.pinnedTask || slot.source === 'generated') return;
    const required = variantsMode === 'different' ? variantsCount : 1;
    if (pool.length < required) throw new Error(`№${byId.get(slot.topicId).ege_number}: в банке ${pool.length} задач, нужно ${required}. Измените фильтры или источник.`);
  });
  const used = new Set([
    ...slots.map(s => s.pinnedTask?.statement_md),
    ...pools.flatMap(pool => pool.slice(0, variantsMode === 'different' ? variantsCount : 1).map(t => t.statement_md)),
  ].filter(Boolean));
  const drafts = [];
  const count = variantsMode === 'different' ? variantsCount : 1;
  for (let vi = 0; vi < count; vi++) {
    const tasks = [];
    for (let si = 0; si < slots.length; si++) {
      const slot = slots[si];
      let task = slot.pinnedTask;
      if (!task && slot.source === 'generated') {
        task = await generateEgeBaseTask({ topic: byId.get(slot.topicId), subtopics, generatorId: slot.generatorId, used });
      }
      task ||= pools[si][vi];
      tasks.push(task);
    }
    drafts.push(tasks);
  }
  let created = 0;
  try {
    for (const tasks of drafts) {
      for (let i = 0; i < tasks.length; i++) {
        if (!tasks[i].id) {
          tasks[i] = await api.createTask(tasks[i]);
          created++;
        }
      }
    }
  } catch (error) {
    throw new Error(`Не удалось сохранить новые задачи. Уже сохранено в банк: ${created}. Вариант не изменён. ${error.message || ''}`);
  }
  return Array.from({ length: variantsCount }, (_, vi) => ({
    number: vi + 1,
    // Номера полного ЕГЭ задаются слотами, их порядок не перемешивается.
    tasks: variantsMode === 'different' ? drafts[vi] : [...drafts[0]],
  }));
}

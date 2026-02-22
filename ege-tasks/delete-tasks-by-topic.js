import PocketBase from 'pocketbase';

const PB_URL = process.env.VITE_PB_URL || process.env.PB_URL || 'https://task-ege.oipav.ru';
const pb = new PocketBase(PB_URL);

async function deleteTasksByTopic() {
  // Параметры для удаления
  const topicNumber = 16; // Номер темы ЕГЭ
  const source = 'РЕШУ ЕГЭ — математика базовая';
  const subtopicName = 'Действия со степенями'; // Опционально - для более точного удаления

  console.log('🗑️  Начинаю удаление задач...\n');
  console.log(`📋 Параметры поиска:`);
  console.log(`   Номер темы ЕГЭ: ${topicNumber}`);
  console.log(`   Источник: ${source}`);
  if (subtopicName) {
    console.log(`   Подтема: ${subtopicName}`);
  }
  console.log();

  try {
    // Получаем тему по номеру
    const topics = await pb.collection('topics').getFullList({
      filter: `ege_number = ${topicNumber}`,
    });

    if (topics.length === 0) {
      console.log(`❌ Тема с номером ${topicNumber} не найдена`);
      return;
    }

    const topic = topics[0];
    console.log(`✓ Найдена тема: ${topic.title} (ID: ${topic.id})\n`);

    // Если указана подтема, найдем её ID
    let subtopicId = null;
    if (subtopicName) {
      const subtopics = await pb.collection('subtopics').getFullList({
        filter: `name = "${subtopicName}" && topic = "${topic.id}"`,
      });

      if (subtopics.length > 0) {
        subtopicId = subtopics[0].id;
        console.log(`✓ Найдена подтема: ${subtopicName} (ID: ${subtopicId})\n`);
      } else {
        console.log(`⚠️  Подтема "${subtopicName}" не найдена\n`);
      }
    }

    // Формируем фильтр для поиска задач
    let filter = `topic = "${topic.id}" && source ~ "${source}"`;
    if (subtopicId) {
      filter += ` && subtopic ~ "${subtopicId}"`;
    }

    // Получаем задачи для удаления
    const tasks = await pb.collection('tasks').getFullList({
      filter: filter,
      fields: 'id,code,statement_md',
    });

    console.log(`📊 Найдено задач для удаления: ${tasks.length}\n`);

    if (tasks.length === 0) {
      console.log('✓ Нет задач для удаления');
      return;
    }

    // Показываем первые несколько задач для подтверждения
    console.log('📋 Примеры задач, которые будут удалены:');
    tasks.slice(0, 3).forEach((task, i) => {
      const preview = task.statement_md.substring(0, 60);
      console.log(`   ${i + 1}. [${task.code}] ${preview}...`);
    });

    if (tasks.length > 3) {
      console.log(`   ... и ещё ${tasks.length - 3} задач(и)`);
    }

    console.log('\n⚠️  ВНИМАНИЕ: Удаление задач необратимо!');
    console.log('Начинаю удаление...\n');

    let deletedCount = 0;
    let errorCount = 0;

    for (const task of tasks) {
      try {
        await pb.collection('tasks').delete(task.id);
        console.log(`✅ Удалена задача ${task.code}`);
        deletedCount++;
      } catch (error) {
        console.log(`❌ Ошибка при удалении ${task.code}: ${error.message}`);
        errorCount++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 ИТОГОВАЯ СТАТИСТИКА:');
    console.log(`   ✅ Удалено задач: ${deletedCount}`);
    console.log(`   ❌ Ошибок: ${errorCount}`);
    console.log(`   📝 Всего обработано: ${tasks.length}`);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  }
}

// Запускаем скрипт
deleteTasksByTopic();

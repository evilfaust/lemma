import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

async function linkTasksToSubtopics() {
  try {
    console.log('Связываем задачи с подтемами...\n');

    // Получаем все подтемы с их темами
    const subtopics = await pb.collection('subtopics').getFullList({
      expand: 'topic'
    });

    console.log(`Найдено подтем: ${subtopics.length}\n`);

    // Для каждой подтемы находим задачи с соответствующей темой
    for (const subtopic of subtopics) {
      console.log(`Обрабатываем подтему: "${subtopic.name}"`);
      console.log(`  Тема: ${subtopic.expand?.topic?.title} (${subtopic.topic})`);

      // Находим все задачи этой темы, у которых нет подтемы
      const tasks = await pb.collection('tasks').getFullList({
        filter: `topic = "${subtopic.topic}" && subtopic = ""`,
        fields: 'id,code'
      });

      console.log(`  Найдено задач без подтемы: ${tasks.length}`);

      if (tasks.length > 0) {
        let updated = 0;
        for (const task of tasks) {
          try {
            await pb.collection('tasks').update(task.id, {
              subtopic: subtopic.id
            });
            updated++;
          } catch (error) {
            console.error(`  Ошибка при обновлении задачи ${task.code}:`, error.message);
          }
        }
        console.log(`  ✓ Обновлено задач: ${updated}\n`);
      }
    }

    // Проверяем результат
    const tasksWithSubtopic = await pb.collection('tasks').getFullList({
      filter: `subtopic != ""`,
      fields: 'id'
    });

    console.log(`\nИтого:`);
    console.log(`Задач с подтемой: ${tasksWithSubtopic.length}`);

  } catch (error) {
    console.error('Ошибка:', error);
  }
}

linkTasksToSubtopics();

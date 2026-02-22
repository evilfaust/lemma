import PocketBase from 'pocketbase';

const PB_URL = process.env.VITE_PB_URL || process.env.PB_URL || 'https://task-ege.oipav.ru';
const pb = new PocketBase(PB_URL);

async function updateEmptySubtopics() {
  try {
    console.log('Обновляем пустые подтемы...\n');

    // Получаем все подтемы с их темами
    const subtopics = await pb.collection('subtopics').getFullList({
      expand: 'topic'
    });

    console.log(`Найдено подтем: ${subtopics.length}\n`);

    // Для каждой подтемы
    for (const subtopic of subtopics) {
      console.log(`Подтема: "${subtopic.name}"`);
      console.log(`  ID подтемы: ${subtopic.id}`);
      console.log(`  ID темы: ${subtopic.topic}`);

      // Находим все задачи этой темы
      const allTasksOfTopic = await pb.collection('tasks').getFullList({
        filter: `topic = "${subtopic.topic}"`,
        fields: 'id,code,subtopic'
      });

      console.log(`  Всего задач с этой темой: ${allTasksOfTopic.length}`);

      // Подсчитываем задачи с пустой подтемой
      const emptySubtopicTasks = allTasksOfTopic.filter(t => !t.subtopic || t.subtopic === '');
      console.log(`  Задач с пустой подтемой: ${emptySubtopicTasks.length}`);

      if (emptySubtopicTasks.length > 0) {
        console.log(`  Обновляем...`);
        let updated = 0;
        for (const task of emptySubtopicTasks) {
          try {
            await pb.collection('tasks').update(task.id, {
              subtopic: subtopic.id
            });
            updated++;
            if (updated % 50 === 0) {
              console.log(`    Обновлено: ${updated}/${emptySubtopicTasks.length}`);
            }
          } catch (error) {
            console.error(`    Ошибка при обновлении ${task.code}:`, error.message);
          }
        }
        console.log(`  ✓ Обновлено: ${updated}\n`);
      } else {
        console.log(`  Все задачи уже имеют подтему\n`);
      }
    }

    console.log('Готово!');

  } catch (error) {
    console.error('Ошибка:', error);
  }
}

updateEmptySubtopics();

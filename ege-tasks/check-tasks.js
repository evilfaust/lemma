import PocketBase from 'pocketbase';

const PB_URL = process.env.VITE_PB_URL || process.env.PB_URL || 'https://task-ege.oipav.ru';
const pb = new PocketBase(PB_URL);

async function checkTasks() {
  try {
    console.log('Проверяем задачи и подтемы...\n');

    // Получаем все подтемы
    const subtopics = await pb.collection('subtopics').getFullList({
      expand: 'topic'
    });

    console.log(`Всего подтем: ${subtopics.length}`);
    subtopics.forEach(st => {
      console.log(`  - ${st.name} (id: ${st.id}, topic: ${st.expand?.topic?.title})`);
    });

    console.log('\n---\n');

    // Получаем все задачи
    const tasks = await pb.collection('tasks').getFullList({
      expand: 'topic,subtopic',
      fields: 'id,code,topic,subtopic'
    });

    console.log(`Всего задач: ${tasks.length}`);

    const tasksWithSubtopic = tasks.filter(t => t.subtopic);
    const tasksWithoutSubtopic = tasks.filter(t => !t.subtopic);

    console.log(`Задач с подтемой: ${tasksWithSubtopic.length}`);
    console.log(`Задач без подтемы: ${tasksWithoutSubtopic.length}`);

    if (tasksWithSubtopic.length > 0) {
      console.log('\nПримеры задач с подтемой:');
      tasksWithSubtopic.slice(0, 3).forEach(t => {
        console.log(`  - ${t.code}: topic=${t.topic}, subtopic=${t.subtopic}, expanded=${t.expand?.subtopic?.name}`);
      });
    }

    console.log('\n---\n');

    // Проверяем фильтрацию
    const testTopicId = 'rjf1a04ykh5uns7'; // Тема из скриншота
    const testSubtopicId = subtopics.find(st => st.topic === testTopicId)?.id;

    if (testSubtopicId) {
      console.log(`Тестируем фильтрацию:`);
      console.log(`  Topic ID: ${testTopicId}`);
      console.log(`  Subtopic ID: ${testSubtopicId}`);

      const filtered = await pb.collection('tasks').getFullList({
        filter: `topic = "${testTopicId}" && subtopic = "${testSubtopicId}"`,
        expand: 'topic,subtopic'
      });

      console.log(`  Найдено задач: ${filtered.length}`);
    }

  } catch (error) {
    console.error('Ошибка:', error);
  }
}

checkTasks();

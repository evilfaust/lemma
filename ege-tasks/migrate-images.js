import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

async function migrateTaskImages() {
  console.log('🚀 Начинаю миграцию изображений задач...\n');

  try {
    // Получаем все задачи
    const tasks = await pb.collection('tasks').getFullList({
      fields: 'id,statement_md,image_url,has_image',
    });

    console.log(`📊 Всего задач в базе: ${tasks.length}\n`);

    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const task of tasks) {
      // Проверяем, есть ли в statement_md ссылка на изображение
      const imgMatch = task.statement_md?.match(/!\[image\]\((https?:\/\/[^\)]+)\)/);

      if (!imgMatch) {
        // Нет изображения в тексте
        skippedCount++;
        continue;
      }

      const imageUrl = imgMatch[1];
      console.log(`📝 Задача ${task.id}:`);
      console.log(`   Найдено изображение: ${imageUrl}`);

      // Удаляем markdown изображения из statement_md
      const cleanedStatement = task.statement_md.replace(/!\[image\]\(https?:\/\/[^\)]+\)/g, '').trim();

      try {
        // Обновляем задачу
        await pb.collection('tasks').update(task.id, {
          image_url: imageUrl,
          has_image: true,
          statement_md: cleanedStatement,
        });

        console.log(`   ✅ Обновлено\n`);
        updatedCount++;
      } catch (error) {
        console.log(`   ❌ Ошибка: ${error.message}\n`);
        errorCount++;
      }
    }

    console.log('=' .repeat(60));
    console.log('📊 ИТОГОВАЯ СТАТИСТИКА:');
    console.log(`   ✅ Обновлено задач: ${updatedCount}`);
    console.log(`   ⏭️  Пропущено (нет изображений): ${skippedCount}`);
    console.log(`   ❌ Ошибок: ${errorCount}`);
    console.log(`   📝 Всего обработано: ${tasks.length}`);
    console.log('=' .repeat(60));

  } catch (error) {
    console.error('❌ Ошибка при миграции:', error);
    process.exit(1);
  }
}

// Запускаем миграцию
migrateTaskImages();

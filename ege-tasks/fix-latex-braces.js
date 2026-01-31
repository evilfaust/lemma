import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

/**
 * Исправляет круглые скобки на фигурные в LaTeX выражениях
 * Например: $2^(10)$ -> $2^{10}$
 */
function fixLatexBraces(text) {
  if (!text) return text;

  // Заменяем круглые скобки на фигурные в LaTeX выражениях
  // Паттерн: ищем символы ^, _, \frac, \sqrt и т.д. с круглыми скобками

  // 1. Степени и индексы: ^(выражение) -> ^{выражение}
  text = text.replace(/\^(\([^)]+\))/g, (match, group) => {
    return '^{' + group.slice(1, -1) + '}';
  });

  // 2. Нижние индексы: _(выражение) -> _{выражение}
  text = text.replace(/_(\([^)]+\))/g, (match, group) => {
    return '_{' + group.slice(1, -1) + '}';
  });

  // 3. Дроби: \frac(числитель)(знаменатель) -> \frac{числитель}{знаменатель}
  text = text.replace(/\\frac(\([^)]+\))(\([^)]+\))/g, (match, num, den) => {
    return '\\frac{' + num.slice(1, -1) + '}{' + den.slice(1, -1) + '}';
  });

  // 4. Корни: \sqrt(выражение) -> \sqrt{выражение}
  text = text.replace(/\\sqrt(\([^)]+\))/g, (match, group) => {
    return '\\sqrt{' + group.slice(1, -1) + '}';
  });

  // 5. Корни степени n: \sqrt[n](выражение) -> \sqrt[n]{выражение}
  text = text.replace(/\\sqrt\[([^\]]+)\](\([^)]+\))/g, (match, power, group) => {
    return '\\sqrt[' + power + ']{' + group.slice(1, -1) + '}';
  });

  return text;
}

async function fixTasksLatex() {
  console.log('🔧 Начинаю исправление LaTeX в задачах...\n');

  try {
    // Получаем тему №16
    const topics = await pb.collection('topics').getFullList({
      filter: 'ege_number = 16',
    });

    if (topics.length === 0) {
      console.log('❌ Тема №16 не найдена');
      return;
    }

    const topic = topics[0];
    console.log(`✓ Найдена тема: ${topic.title}\n`);

    // Получаем подтему "Действия со степенями"
    const subtopics = await pb.collection('subtopics').getFullList({
      filter: `name = "Действия со степенями" && topic = "${topic.id}"`,
    });

    let filter = `topic = "${topic.id}"`;
    if (subtopics.length > 0) {
      const subtopic = subtopics[0];
      filter += ` && subtopic ~ "${subtopic.id}"`;
      console.log(`✓ Найдена подтема: ${subtopic.name}\n`);
    }

    // Получаем все задачи
    const tasks = await pb.collection('tasks').getFullList({
      filter: filter,
      fields: 'id,code,statement_md,answer',
    });

    console.log(`📊 Найдено задач: ${tasks.length}\n`);

    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const task of tasks) {
      const originalStatement = task.statement_md;
      const originalAnswer = task.answer;

      const fixedStatement = fixLatexBraces(originalStatement);
      const fixedAnswer = fixLatexBraces(originalAnswer);

      // Проверяем, изменилось ли что-то
      const statementChanged = originalStatement !== fixedStatement;
      const answerChanged = originalAnswer !== fixedAnswer;

      if (!statementChanged && !answerChanged) {
        skippedCount++;
        continue;
      }

      console.log(`📝 Задача ${task.code}:`);
      if (statementChanged) {
        console.log(`   Было: ${originalStatement.substring(0, 60)}...`);
        console.log(`   Стало: ${fixedStatement.substring(0, 60)}...`);
      }
      if (answerChanged) {
        console.log(`   Ответ: "${originalAnswer}" -> "${fixedAnswer}"`);
      }

      try {
        await pb.collection('tasks').update(task.id, {
          statement_md: fixedStatement,
          answer: fixedAnswer,
        });

        console.log(`   ✅ Обновлено\n`);
        updatedCount++;
      } catch (error) {
        console.log(`   ❌ Ошибка: ${error.message}\n`);
        errorCount++;
      }
    }

    console.log('='.repeat(60));
    console.log('📊 ИТОГОВАЯ СТАТИСТИКА:');
    console.log(`   ✅ Обновлено задач: ${updatedCount}`);
    console.log(`   ⏭️  Пропущено (не требуют изменений): ${skippedCount}`);
    console.log(`   ❌ Ошибок: ${errorCount}`);
    console.log(`   📝 Всего обработано: ${tasks.length}`);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  }
}

// Запускаем скрипт
fixTasksLatex();

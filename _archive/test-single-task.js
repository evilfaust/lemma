/**
 * Тест парсинга одной задачи со списком
 */

const PDF_SERVICE_URL = 'http://localhost:3001';
const TEST_URL = 'https://mathb-ege.sdamgia.ru/test?category_id=222&filter=all_a&print=true';

async function testSingleTask() {
  try {
    const response = await fetch(`${PDF_SERVICE_URL}/parse-sdamgia`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: TEST_URL }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const problem = data.problems[0];

    console.log('=== ПЕРВАЯ ЗАДАЧА ===');
    console.log('ID:', problem.id);
    console.log('\n=== УСЛОВИЕ (полное) ===');
    console.log(problem.condition);
    console.log('\n=== ОТВЕТ ===');
    console.log(problem.answer);

    // Проверяем наличие списка
    const hasList = problem.condition.includes('\n1)') || problem.condition.includes('\n2)');
    console.log('\n=== ПРОВЕРКА ===');
    console.log('Содержит список:', hasList ? 'ДА' : 'НЕТ');

    // Показываем первые 20 символов после "Среди"
    const match = problem.condition.match(/Среди(.{200})/s);
    if (match) {
      console.log('\nФрагмент после "Среди":');
      console.log(match[1]);
    }

  } catch (error) {
    console.error('ОШИБКА:', error.message);
    process.exit(1);
  }
}

testSingleTask();

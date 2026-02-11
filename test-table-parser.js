/**
 * Тест парсинга таблиц с sdamgia.ru
 */

const PDF_SERVICE_URL = 'http://localhost:3001';

// Тесты для разных типов задач
const TESTS = [
  {
    name: 'Задачи с таблицами',
    url: 'https://mathb-ege.sdamgia.ru/test?category_id=231&filter=all_a&print=true',
    checkTable: true,
    checkList: false,
  },
  {
    name: 'Задачи со списками',
    url: 'https://mathb-ege.sdamgia.ru/test?category_id=222&filter=all_a&print=true',
    checkTable: false,
    checkList: true,
  },
];

async function testParsing(test) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Тест: ${test.name}`);
  console.log(`URL: ${test.url}`);
  console.log('='.repeat(80));

  try {
    const response = await fetch(`${PDF_SERVICE_URL}/parse-sdamgia`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: test.url }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || err.message || `HTTP ${response.status}`);
    }

    const data = await response.json();

    console.log(`\nВсего задач: ${data.count}`);

    console.log('\n--- ПЕРВЫЕ 2 ЗАДАЧИ ---');
    data.problems.slice(0, 2).forEach((problem, index) => {
      console.log(`\n[Задача ${index + 1} — ID: ${problem.id}]`);
      console.log('Условие:');
      console.log(problem.condition.slice(0, 500) + (problem.condition.length > 500 ? '...' : ''));
      console.log('\nОтвет:', problem.answer);

      // Проверяем наличие таблиц
      if (test.checkTable) {
        const hasTable = problem.condition.includes('|') && problem.condition.includes('---');
        console.log('✓ Таблица:', hasTable ? 'ЕСТЬ' : 'НЕТ');
      }

      // Проверяем наличие нумерованных списков
      if (test.checkList) {
        const hasList = /\n\d+\)/.test(problem.condition);
        console.log('✓ Нумерованный список:', hasList ? 'ЕСТЬ' : 'НЕТ');
      }
    });

  } catch (error) {
    console.error('\n❌ ОШИБКА:', error.message);
    return false;
  }

  return true;
}

async function runAllTests() {
  console.log('🚀 Запуск тестов парсинга задач с sdamgia.ru\n');

  for (const test of TESTS) {
    const success = await testParsing(test);
    if (!success) {
      console.error('\n❌ Тесты провалены');
      process.exit(1);
    }
  }

  console.log('\n\n✅ Все тесты пройдены успешно!');
}

runAllTests();

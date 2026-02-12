// Тестирование преобразования в LaTeX
import { convertToLatex } from './ege-tasks/src/utils/markdownTaskParser.js';

const testCases = [
  {
    name: 'Задача 1 (из скриншота)',
    input: 'Найдите тангенсальфа, если косинусальфа = минус дробь: числитель: 1, знаменатель: корень из: 10',
    expected: 'Найдите $\\tan\\alpha$, если $\\cos\\alpha$ = -$\\frac{1}{\\sqrt{10}}$'
  },
  {
    name: 'Задача 2 (из скриншота)',
    input: 'Найдите тангенсальфа, если синусальфа = минус дробь: числитель: 5, знаменатель: корень из: 26',
    expected: 'Найдите $\\tan\\alpha$, если $\\sin\\alpha$ = -$\\frac{5}{\\sqrt{26}}$'
  },
  {
    name: 'Дробь с Pi',
    input: 'дробь: числитель: 3Пи, знаменатель: 2',
    expected: '$\\frac{3\\pi}{2}$'
  },
  {
    name: 'Ответ с числом',
    input: '-3',
    expected: '-3'
  },
  {
    name: 'Ответ с числом 2',
    input: '5',
    expected: '5'
  },
];

console.log('🧪 Тестирование преобразования в LaTeX\n');

testCases.forEach((test, index) => {
  console.log(`\n${index + 1}. ${test.name}`);
  console.log('   Вход:', test.input);

  const result = convertToLatex(test.input);
  console.log('   Результат:', result);

  if (test.expected) {
    console.log('   Ожидалось:', test.expected);
    if (result === test.expected) {
      console.log('   ✅ PASS');
    } else {
      console.log('   ❌ FAIL');
    }
  }
});

console.log('\n\n📝 Дополнительные примеры:');

const examples = [
  'косинус альфа',
  'синус альфа плюс косинус альфа',
  'дробь: числитель: 1, знаменатель: 2',
  'альфа прина[д]+[еж]+ит (Пи; дробь: числитель: 3Пи, знаменатель: 2)',
];

examples.forEach(example => {
  console.log(`\nВход: ${example}`);
  console.log(`Выход: ${convertToLatex(example)}`);
});

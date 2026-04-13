#!/usr/bin/env node
// Скрипт добавления новых ачивок от учеников
// Запуск: node seed-achievements.js <admin_email> <admin_password>

const PB_URL = 'https://task-ege.oipav.ru';

const NEW_ACHIEVEMENTS = [
  {
    code: 'student_cracker',
    title: 'Сухарик ❤️',
    description: 'Великий результат!',
    icon: 'icon073.png',
    type: 'random',
    rarity: 'legendary',
    condition_type: null,
    condition_value: null,
    order: 73,
  },
  {
    code: 'student_vampire',
    title: 'Вампир',
    description: 'Высасываешь смысл, как кровь!',
    icon: 'icon074.png',
    type: 'random',
    rarity: 'legendary',
    condition_type: null,
    condition_value: null,
    order: 74,
  },
  {
    code: 'student_hermitage',
    title: 'Эрмитаж',
    description: 'Результат, как искусство!',
    icon: 'icon075.png',
    type: 'random',
    rarity: 'rare',
    condition_type: null,
    condition_value: null,
    order: 75,
  },
  {
    code: 'student_monster',
    title: 'Монстр',
    description: 'Можешь же, когда хочешь',
    icon: 'icon076.png',
    type: 'condition',
    rarity: 'legendary',
    condition_type: 'count',
    condition_value: { attempts: 10 },
    order: 76,
  },
  {
    code: 'student_survived',
    title: 'Ты выжил',
    description: 'Сделал больше одного правильного задания',
    icon: 'icon077.png',
    type: 'condition',
    rarity: 'common',
    condition_type: 'score',
    condition_value: { min: 10 },
    order: 77,
  },
];

async function main() {
  const [,, email, password] = process.argv;
  if (!email || !password) {
    console.error('Использование: node seed-achievements.js <admin_email> <admin_password>');
    process.exit(1);
  }

  // Авторизация суперпользователя
  const authRes = await fetch(`${PB_URL}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: email, password }),
  });
  if (!authRes.ok) {
    console.error('Ошибка авторизации:', await authRes.text());
    process.exit(1);
  }
  const { token } = await authRes.json();
  console.log('✓ Авторизован');

  // Получаем существующие коды чтобы не дублировать
  const existingRes = await fetch(`${PB_URL}/api/collections/achievements/records?perPage=200`, {
    headers: { Authorization: token },
  });
  const existing = await existingRes.json();
  const existingCodes = new Set(existing.items.map(a => a.code));

  for (const ach of NEW_ACHIEVEMENTS) {
    if (existingCodes.has(ach.code)) {
      console.log(`⚠ Пропуск (уже есть): ${ach.title}`);
      continue;
    }
    const res = await fetch(`${PB_URL}/api/collections/achievements/records`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: token },
      body: JSON.stringify(ach),
    });
    if (res.ok) {
      console.log(`✓ Добавлена: ${ach.title}`);
    } else {
      console.error(`✗ Ошибка (${ach.title}):`, await res.text());
    }
  }

  console.log('\nГотово!');
}

main().catch(console.error);

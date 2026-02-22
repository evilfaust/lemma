/**
 * Скрипт для заполнения базы данных начальными достижениями
 *
 * Использование:
 * node seed-achievements.js
 */

import PocketBase from 'pocketbase';

const PB_URL = process.env.VITE_PB_URL || process.env.PB_URL || 'https://task-ege.oipav.ru';
const pb = new PocketBase(PB_URL);

const achievements = [
  // ============ СЛУЧАЙНЫЕ ЗНАЧКИ: ОБЫЧНЫЕ (common) - 10 шт ============
  {
    code: 'start',
    title: 'Старт дан',
    description: 'Первый шаг к знаниям',
    icon: 'start.png',
    type: 'random',
    rarity: 'common',
    order: 1,
  },
  {
    code: 'novice',
    title: 'Новичок',
    description: 'Начинающий математик',
    icon: 'novice.png',
    type: 'random',
    rarity: 'common',
    order: 2,
  },
  {
    code: 'student',
    title: 'Ученик',
    description: 'Продолжаешь учиться',
    icon: 'student.png',
    type: 'random',
    rarity: 'common',
    order: 3,
  },
  {
    code: 'explorer',
    title: 'Следопыт',
    description: 'Исследуешь математику',
    icon: 'explorer.png',
    type: 'random',
    rarity: 'common',
    order: 4,
  },
  {
    code: 'thinker',
    title: 'Мыслитель',
    description: 'Думаешь над задачами',
    icon: 'thinker.png',
    type: 'random',
    rarity: 'common',
    order: 5,
  },
  {
    code: 'solver',
    title: 'Решатель',
    description: 'Решаешь задачи',
    icon: 'solver.png',
    type: 'random',
    rarity: 'common',
    order: 6,
  },
  {
    code: 'calculator',
    title: 'Калькулятор',
    description: 'Отлично считаешь',
    icon: 'calculator.png',
    type: 'random',
    rarity: 'common',
    order: 7,
  },
  {
    code: 'persistent',
    title: 'Упорный',
    description: 'Не сдаешься',
    icon: 'persistent.png',
    type: 'random',
    rarity: 'common',
    order: 8,
  },
  {
    code: 'brave',
    title: 'Смелый',
    description: 'Не боишься сложностей',
    icon: 'brave.png',
    type: 'random',
    rarity: 'common',
    order: 9,
  },
  {
    code: 'diligent',
    title: 'Старательный',
    description: 'Стараешься изо всех сил',
    icon: 'diligent.png',
    type: 'random',
    rarity: 'common',
    order: 10,
  },

  // ============ СЛУЧАЙНЫЕ ЗНАЧКИ: РЕДКИЕ (rare) - 8 шт ============
  {
    code: 'smart',
    title: 'Умница',
    description: 'Хороший результат',
    icon: 'smart.png',
    type: 'random',
    rarity: 'rare',
    order: 11,
  },
  {
    code: 'erudite',
    title: 'Эрудит',
    description: 'Широкие знания',
    icon: 'erudite.png',
    type: 'random',
    rarity: 'rare',
    order: 12,
  },
  {
    code: 'mathematician',
    title: 'Математик',
    description: 'Отличное владение математикой',
    icon: 'mathematician.png',
    type: 'random',
    rarity: 'rare',
    order: 13,
  },
  {
    code: 'genius_algebra',
    title: 'Гений алгебры',
    description: 'Алгебра — твоя сильная сторона',
    icon: 'genius_algebra.png',
    type: 'random',
    rarity: 'rare',
    order: 14,
  },
  {
    code: 'formula_master',
    title: 'Мастер формул',
    description: 'Отлично работаешь с формулами',
    icon: 'formula_master.png',
    type: 'random',
    rarity: 'rare',
    order: 15,
  },
  {
    code: 'logic_lord',
    title: 'Повелитель логики',
    description: 'Логическое мышление на высоте',
    icon: 'logic_lord.png',
    type: 'random',
    rarity: 'rare',
    order: 16,
  },
  {
    code: 'quick_mind',
    title: 'Быстрый ум',
    description: 'Быстро находишь решения',
    icon: 'quick_mind.png',
    type: 'random',
    rarity: 'rare',
    order: 17,
  },
  {
    code: 'problem_crusher',
    title: 'Дробитель задач',
    description: 'Щелкаешь задачи как орешки',
    icon: 'problem_crusher.png',
    type: 'random',
    rarity: 'rare',
    order: 18,
  },

  // ============ СЛУЧАЙНЫЕ ЗНАЧКИ: ЛЕГЕНДАРНЫЕ (legendary) - 4 шт ============
  {
    code: 'legend',
    title: 'Легенда',
    description: 'Выдающийся результат!',
    icon: 'legend.png',
    type: 'random',
    rarity: 'legendary',
    order: 19,
  },
  {
    code: 'master',
    title: 'Мастер',
    description: 'Мастерское владение математикой',
    icon: 'master.png',
    type: 'random',
    rarity: 'legendary',
    order: 20,
  },
  {
    code: 'champion',
    title: 'Чемпион',
    description: 'Непревзойденный результат',
    icon: 'champion.png',
    type: 'random',
    rarity: 'legendary',
    order: 21,
  },
  {
    code: 'absolute',
    title: 'Абсолют',
    description: 'Совершенство в математике',
    icon: 'absolute.png',
    type: 'random',
    rarity: 'legendary',
    order: 22,
  },

  // ============ ДОСТИЖЕНИЯ ЗА УСЛОВИЯ - 8 шт ============
  {
    code: 'perfect',
    title: 'Безошибочный',
    description: 'Ответь правильно на все вопросы',
    icon: 'perfect.png',
    type: 'condition',
    condition_type: 'score',
    condition_value: { min: 100 },
    order: 23,
  },
  {
    code: 'first_win',
    title: 'Первая победа',
    description: 'Пройди первый тест',
    icon: 'first_win.png',
    type: 'condition',
    condition_type: 'count',
    condition_value: { attempts: 1 },
    order: 24,
  },
  {
    code: 'marathoner',
    title: 'Марафонец',
    description: 'Пройди 10 тестов',
    icon: 'marathoner.png',
    type: 'condition',
    condition_type: 'count',
    condition_value: { attempts: 10 },
    order: 25,
  },
  {
    code: 'veteran',
    title: 'Ветеран',
    description: 'Пройди 50 тестов',
    icon: 'veteran.png',
    type: 'condition',
    condition_type: 'count',
    condition_value: { attempts: 50 },
    order: 26,
  },
  {
    code: 'speedster',
    title: 'Молния',
    description: 'Пройди тест за 5 минут или быстрее',
    icon: 'speedster.png',
    type: 'condition',
    condition_type: 'speed',
    condition_value: { max_minutes: 5 },
    order: 27,
  },
  {
    code: 'night_owl',
    title: 'Ночной дозор',
    description: 'Пройди тест после 22:00',
    icon: 'night_owl.png',
    type: 'condition',
    condition_type: 'special',
    condition_value: { time_after: '22:00' },
    order: 28,
  },
  {
    code: 'early_bird',
    title: 'Ранняя пташка',
    description: 'Пройди тест до 8:00 утра',
    icon: 'early_bird.png',
    type: 'condition',
    condition_type: 'special',
    condition_value: { time_before: '08:00' },
    order: 29,
  },
  {
    code: 'excellent',
    title: 'Отличник',
    description: 'Набери 90% и больше',
    icon: 'excellent.png',
    type: 'condition',
    condition_type: 'score',
    condition_value: { min: 90 },
    order: 30,
  },
];

async function seed() {
  console.log('🌱 Seeding achievements...');

  try {
    // Авторизоваться как админ (используем временный токен или создаем без auth)
    // Для этого скрипта временно отключим проверку прав
    pb.autoCancellation(false);

    // Проверить существующие достижения
    const existing = await pb.collection('achievements').getFullList();
    console.log(`📊 Found ${existing.length} existing achievements`);

    let created = 0;
    let skipped = 0;

    for (const achievement of achievements) {
      const exists = existing.find(e => e.code === achievement.code);

      if (exists) {
        console.log(`⏭️  Skipping "${achievement.title}" (already exists)`);
        skipped++;
        continue;
      }

      try {
        await pb.collection('achievements').create(achievement);
        console.log(`✅ Created "${achievement.title}" (${achievement.type}, ${achievement.rarity || 'condition'})`);
        created++;
      } catch (err) {
        console.error(`❌ Error creating "${achievement.title}":`, err.message);
      }
    }

    console.log('\n🎉 Seeding complete!');
    console.log(`   Created: ${created}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`   Total: ${created + skipped}`);

  } catch (err) {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  }
}

seed();

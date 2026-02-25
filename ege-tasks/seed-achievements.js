/**
 * Скрипт для заполнения базы данных начальными достижениями
 *
 * Использование:
 * node seed-achievements.js
 */

import PocketBase from 'pocketbase';

const PB_URL = process.env.VITE_PB_URL || process.env.PB_URL || 'https://task-ege.oipav.ru';
const PB_SUPERUSER_EMAIL = process.env.PB_SUPERUSER_EMAIL || '';
const PB_SUPERUSER_PASSWORD = process.env.PB_SUPERUSER_PASSWORD || '';
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

  // ============ ДОПОЛНИТЕЛЬНЫЕ ЗНАЧКИ (icon049..icon073) ============
  // Common
  {
    code: 'navigator',
    title: 'Навигатор',
    description: 'Уверенно держишь курс в мире задач',
    icon: 'icon049.png',
    type: 'random',
    rarity: 'common',
    order: 49,
  },
  {
    code: 'impulse',
    title: 'Импульс',
    description: 'Набираешь скорость в подготовке',
    icon: 'icon050.png',
    type: 'random',
    rarity: 'common',
    order: 50,
  },
  {
    code: 'seeker',
    title: 'Искатель',
    description: 'Находишь верный путь к ответу',
    icon: 'icon051.png',
    type: 'random',
    rarity: 'common',
    order: 51,
  },
  {
    code: 'steady',
    title: 'Стабильный',
    description: 'Держишь ровный темп и прогресс',
    icon: 'icon052.png',
    type: 'random',
    rarity: 'common',
    order: 52,
  },
  {
    code: 'spark',
    title: 'Искра',
    description: 'Каждый тест зажигает интерес к математике',
    icon: 'icon053.png',
    type: 'random',
    rarity: 'common',
    order: 53,
  },
  {
    code: 'guide',
    title: 'Проводник',
    description: 'Уверенно проходишь сложные темы',
    icon: 'icon054.png',
    type: 'random',
    rarity: 'common',
    order: 54,
  },
  {
    code: 'rhythm',
    title: 'Ритм',
    description: 'Работаешь регулярно и без провалов',
    icon: 'icon055.png',
    type: 'random',
    rarity: 'common',
    order: 55,
  },
  {
    code: 'pilot',
    title: 'Пилот',
    description: 'Управляешь своим прогрессом',
    icon: 'icon056.png',
    type: 'random',
    rarity: 'common',
    order: 56,
  },
  {
    code: 'wanderer',
    title: 'Путник',
    description: 'Проходишь путь от простого к сложному',
    icon: 'icon057.png',
    type: 'random',
    rarity: 'common',
    order: 57,
  },
  {
    code: 'progressor',
    title: 'Прогрессор',
    description: 'Становишься сильнее с каждой попыткой',
    icon: 'icon058.png',
    type: 'random',
    rarity: 'common',
    order: 58,
  },

  // Rare
  {
    code: 'architect',
    title: 'Архитектор',
    description: 'Строишь сильную стратегию решения',
    icon: 'icon059.png',
    type: 'random',
    rarity: 'rare',
    order: 59,
  },
  {
    code: 'analyst',
    title: 'Аналитик',
    description: 'Видишь закономерности и детали',
    icon: 'icon060.png',
    type: 'random',
    rarity: 'rare',
    order: 60,
  },
  {
    code: 'innovator',
    title: 'Инноватор',
    description: 'Ищешь нестандартные подходы',
    icon: 'icon061.png',
    type: 'random',
    rarity: 'rare',
    order: 61,
  },
  {
    code: 'tactician',
    title: 'Тактик',
    description: 'Выбираешь точные шаги к результату',
    icon: 'icon062.png',
    type: 'random',
    rarity: 'rare',
    order: 62,
  },
  {
    code: 'visionary',
    title: 'Визионер',
    description: 'Смотришь на задачу шире и глубже',
    icon: 'icon063.png',
    type: 'random',
    rarity: 'rare',
    order: 63,
  },
  {
    code: 'coordinator',
    title: 'Координатор',
    description: 'Точно соединяешь идеи и методы',
    icon: 'icon064.png',
    type: 'random',
    rarity: 'rare',
    order: 64,
  },
  {
    code: 'expert',
    title: 'Эксперт',
    description: 'Уверенно решаешь задачи повышенной сложности',
    icon: 'icon065.png',
    type: 'random',
    rarity: 'rare',
    order: 65,
  },
  {
    code: 'captain',
    title: 'Капитан',
    description: 'Ведёшь себя к высоким результатам',
    icon: 'icon066.png',
    type: 'random',
    rarity: 'rare',
    order: 66,
  },

  // Legendary
  {
    code: 'maestro',
    title: 'Маэстро',
    description: 'Блестяще владеешь математическим инструментарием',
    icon: 'icon067.png',
    type: 'random',
    rarity: 'legendary',
    order: 67,
  },
  {
    code: 'titan',
    title: 'Титан',
    description: 'Покоряешь самые сложные задачи',
    icon: 'icon068.png',
    type: 'random',
    rarity: 'legendary',
    order: 68,
  },
  {
    code: 'phoenix',
    title: 'Феникс',
    description: 'Возвращаешься и показываешь результат снова',
    icon: 'icon069.png',
    type: 'random',
    rarity: 'legendary',
    order: 69,
  },
  {
    code: 'oracle',
    title: 'Оракул',
    description: 'Видишь решение раньше остальных',
    icon: 'icon070.png',
    type: 'random',
    rarity: 'legendary',
    order: 70,
  },
  {
    code: 'cosmos',
    title: 'Космос',
    description: 'Выходишь на орбиту максимальных баллов',
    icon: 'icon072.png',
    type: 'random',
    rarity: 'legendary',
    order: 71,
  },
  {
    code: 'emperor',
    title: 'Император',
    description: 'Абсолютный контроль над задачами',
    icon: 'icon073.png',
    type: 'random',
    rarity: 'legendary',
    order: 72,
  },
];

async function seed() {
  console.log('🌱 Seeding achievements...');

  try {
    pb.autoCancellation(false);

    if (PB_SUPERUSER_EMAIL && PB_SUPERUSER_PASSWORD) {
      console.log(`🔐 Authenticating as superuser: ${PB_SUPERUSER_EMAIL}`);
      await pb.collection('_superusers').authWithPassword(
        PB_SUPERUSER_EMAIL,
        PB_SUPERUSER_PASSWORD
      );
    } else {
      console.log('ℹ️ Superuser credentials not provided; create operations may fail.');
    }

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

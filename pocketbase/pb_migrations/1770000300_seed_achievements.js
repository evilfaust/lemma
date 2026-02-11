/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_achievements")

  const achievements = [
    // COMMON (10)
    { code: 'start', title: 'Старт дан', description: 'Первый шаг к знаниям', icon: 'start.png', type: 'random', rarity: 'common', order: 1 },
    { code: 'novice', title: 'Новичок', description: 'Начинающий математик', icon: 'novice.png', type: 'random', rarity: 'common', order: 2 },
    { code: 'student', title: 'Ученик', description: 'Продолжаешь учиться', icon: 'student.png', type: 'random', rarity: 'common', order: 3 },
    { code: 'explorer', title: 'Следопыт', description: 'Исследуешь математику', icon: 'explorer.png', type: 'random', rarity: 'common', order: 4 },
    { code: 'thinker', title: 'Мыслитель', description: 'Думаешь над задачами', icon: 'thinker.png', type: 'random', rarity: 'common', order: 5 },
    { code: 'solver', title: 'Решатель', description: 'Решаешь задачи', icon: 'solver.png', type: 'random', rarity: 'common', order: 6 },
    { code: 'calculator', title: 'Калькулятор', description: 'Отлично считаешь', icon: 'calculator.png', type: 'random', rarity: 'common', order: 7 },
    { code: 'persistent', title: 'Упорный', description: 'Не сдаешься', icon: 'persistent.png', type: 'random', rarity: 'common', order: 8 },
    { code: 'brave', title: 'Смелый', description: 'Не боишься сложностей', icon: 'brave.png', type: 'random', rarity: 'common', order: 9 },
    { code: 'diligent', title: 'Старательный', description: 'Стараешься изо всех сил', icon: 'diligent.png', type: 'random', rarity: 'common', order: 10 },

    // RARE (8)
    { code: 'smart', title: 'Умница', description: 'Хороший результат', icon: 'smart.png', type: 'random', rarity: 'rare', order: 11 },
    { code: 'erudite', title: 'Эрудит', description: 'Широкие знания', icon: 'erudite.png', type: 'random', rarity: 'rare', order: 12 },
    { code: 'mathematician', title: 'Математик', description: 'Отличное владение математикой', icon: 'mathematician.png', type: 'random', rarity: 'rare', order: 13 },
    { code: 'genius_algebra', title: 'Гений алгебры', description: 'Алгебра — твоя сильная сторона', icon: 'genius_algebra.png', type: 'random', rarity: 'rare', order: 14 },
    { code: 'formula_master', title: 'Мастер формул', description: 'Отлично работаешь с формулами', icon: 'formula_master.png', type: 'random', rarity: 'rare', order: 15 },
    { code: 'logic_lord', title: 'Повелитель логики', description: 'Логическое мышление на высоте', icon: 'logic_lord.png', type: 'random', rarity: 'rare', order: 16 },
    { code: 'quick_mind', title: 'Быстрый ум', description: 'Быстро находишь решения', icon: 'quick_mind.png', type: 'random', rarity: 'rare', order: 17 },
    { code: 'problem_crusher', title: 'Дробитель задач', description: 'Щелкаешь задачи как орешки', icon: 'problem_crusher.png', type: 'random', rarity: 'rare', order: 18 },

    // LEGENDARY (4)
    { code: 'legend', title: 'Легенда', description: 'Выдающийся результат!', icon: 'legend.png', type: 'random', rarity: 'legendary', order: 19 },
    { code: 'master', title: 'Мастер', description: 'Мастерское владение математикой', icon: 'master.png', type: 'random', rarity: 'legendary', order: 20 },
    { code: 'champion', title: 'Чемпион', description: 'Непревзойденный результат', icon: 'champion.png', type: 'random', rarity: 'legendary', order: 21 },
    { code: 'absolute', title: 'Абсолют', description: 'Совершенство в математике', icon: 'absolute.png', type: 'random', rarity: 'legendary', order: 22 },

    // CONDITIONS (8)
    { code: 'perfect', title: 'Безошибочный', description: 'Ответь правильно на все вопросы', icon: 'perfect.png', type: 'condition', condition_type: 'score', condition_value: { min: 100 }, order: 23 },
    { code: 'first_win', title: 'Первая победа', description: 'Пройди первый тест', icon: 'first_win.png', type: 'condition', condition_type: 'count', condition_value: { attempts: 1 }, order: 24 },
    { code: 'marathoner', title: 'Марафонец', description: 'Пройди 10 тестов', icon: 'marathoner.png', type: 'condition', condition_type: 'count', condition_value: { attempts: 10 }, order: 25 },
    { code: 'veteran', title: 'Ветеран', description: 'Пройди 50 тестов', icon: 'veteran.png', type: 'condition', condition_type: 'count', condition_value: { attempts: 50 }, order: 26 },
    { code: 'speedster', title: 'Молния', description: 'Пройди тест за 5 минут или быстрее', icon: 'speedster.png', type: 'condition', condition_type: 'speed', condition_value: { max_minutes: 5 }, order: 27 },
    { code: 'night_owl', title: 'Ночной дозор', description: 'Пройди тест после 22:00', icon: 'night_owl.png', type: 'condition', condition_type: 'special', condition_value: { time_after: '22:00' }, order: 28 },
    { code: 'early_bird', title: 'Ранняя пташка', description: 'Пройди тест до 8:00 утра', icon: 'early_bird.png', type: 'condition', condition_type: 'special', condition_value: { time_before: '08:00' }, order: 29 },
    { code: 'excellent', title: 'Отличник', description: 'Набери 90% и больше', icon: 'excellent.png', type: 'condition', condition_type: 'score', condition_value: { min: 90 }, order: 30 },
  ];

  // Create each achievement
  for (const ach of achievements) {
    const record = new Record(collection, ach);
    app.save(record);
  }

  return null;
}, (app) => {
  // Rollback: delete all seeded achievements
  const collection = app.findCollectionByNameOrId("pbc_achievements")
  const records = app.findRecordsByFilter(collection, "order >= 1 && order <= 30")

  for (const record of records) {
    app.delete(record)
  }

  return null;
})

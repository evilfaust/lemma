/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_achievements")

  // === 1. ДОБАВИТЬ 18 НОВЫХ ДОСТИЖЕНИЙ ===
  const newAchievements = [
    // NEW COMMON +6 (итого будет 16 common)
    { code: 'builder', title: 'Строитель', description: 'Строишь фундамент знаний', icon: 'icon001.png', type: 'random', rarity: 'common', order: 31 },
    { code: 'warrior', title: 'Воин', description: 'Сражаешься с задачами', icon: 'icon002.png', type: 'random', rarity: 'common', order: 32 },
    { code: 'cosmonaut', title: 'Космонавт', description: 'Покоряешь математические просторы', icon: 'icon004.png', type: 'random', rarity: 'common', order: 33 },
    { code: 'cheerful', title: 'Весельчак', description: 'Математика — это весело!', icon: 'icon025.png', type: 'random', rarity: 'common', order: 34 },
    { code: 'strongman', title: 'Силач', description: 'Силой ума побеждаешь сложности', icon: 'icon026.png', type: 'random', rarity: 'common', order: 35 },
    { code: 'creative', title: 'Творец', description: 'Находишь нестандартные решения', icon: 'icon027.png', type: 'random', rarity: 'common', order: 36 },

    // NEW RARE +4 (итого будет 12 rare)
    { code: 'sniper', title: 'Снайпер', description: 'Точные ответы без промаха', icon: 'icon033.png', type: 'random', rarity: 'rare', order: 37 },
    { code: 'strategist', title: 'Стратег', description: 'Продуманный подход к задачам', icon: 'icon036.png', type: 'random', rarity: 'rare', order: 38 },
    { code: 'hacker', title: 'Хакер', description: 'Взламываешь сложные задачи', icon: 'icon037.png', type: 'random', rarity: 'rare', order: 39 },
    { code: 'gamer', title: 'Геймер', description: 'Проходишь тесты как уровни в игре', icon: 'icon038.png', type: 'random', rarity: 'rare', order: 40 },

    // NEW LEGENDARY +4 (итого будет 8 legendary)
    { code: 'ironman', title: 'Железный человек', description: 'Непробиваемая логика!', icon: 'icon003.png', type: 'random', rarity: 'legendary', order: 41 },
    { code: 'jedi', title: 'Джедай', description: 'Сила математики с тобой', icon: 'icon032.png', type: 'random', rarity: 'legendary', order: 42 },
    { code: 'rebel', title: 'Бунтарь', description: 'Рвёшь шаблоны решений', icon: 'icon040.png', type: 'random', rarity: 'legendary', order: 43 },
    { code: 'sheriff', title: 'Шериф', description: 'Закон математики на твоей стороне', icon: 'icon044.png', type: 'random', rarity: 'legendary', order: 44 },

    // NEW CONDITIONS +4 (итого будет 12 condition)
    { code: 'hat_trick', title: 'Хет-трик', description: 'Получи 3 раза подряд 80%+', icon: 'icon031.png', type: 'condition', condition_type: 'count', condition_value: { attempts: 3 }, order: 45 },
    { code: 'weekend_warrior', title: 'Воин выходных', description: 'Пройди тест в субботу или воскресенье', icon: 'icon047.png', type: 'condition', condition_type: 'special', condition_value: { day_of_week: [0, 6] }, order: 46 },
    { code: 'sprinter', title: 'Спринтер', description: 'Пройди тест за 3 минуты или быстрее', icon: 'icon041.png', type: 'condition', condition_type: 'speed', condition_value: { max_minutes: 3 }, order: 47 },
    { code: 'centurion', title: 'Центурион', description: 'Пройди 100 тестов', icon: 'icon048.png', type: 'condition', condition_type: 'count', condition_value: { attempts: 100 }, order: 48 },
  ];

  for (const ach of newAchievements) {
    const record = new Record(collection, ach);
    app.save(record);
  }

  // === 2. ОБНОВИТЬ ИКОНКИ СТАРЫХ ДОСТИЖЕНИЙ (убрать дубликаты) ===
  // Старые legendary и condition использовали дубликаты — присвоим им уникальные иконки
  const iconUpdates = {
    // Старые legendary — были дубликаты, даём уникальные
    'champion': 'icon028.png',    // был icon016 (дубликат rare)
    'absolute': 'icon029.png',    // был icon020 (дубликат rare)

    // Старые condition — были дубликаты, даём уникальные
    'perfect': 'icon030.png',     // был icon024 (дубликат legendary)
    'first_win': 'icon034.png',   // был icon005 (дубликат common)
    'marathoner': 'icon035.png',  // был icon010 (дубликат common)
    'veteran': 'icon039.png',     // был icon023 (дубликат legendary)
    'speedster': 'icon042.png',   // был icon021 (дубликат rare)
    'night_owl': 'icon043.png',   // был icon013 (дубликат common)
    'early_bird': 'icon045.png',  // был icon008 (дубликат common)
    'excellent': 'icon046.png',   // был icon017 (дубликат rare)
  };

  for (const [code, iconFilename] of Object.entries(iconUpdates)) {
    const records = app.findRecordsByFilter(collection, `code = "${code}"`, '-created', 1);
    if (records.length > 0) {
      const record = records[0];
      record.set('icon', iconFilename);
      app.save(record);
    }
  }

  return null;
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_achievements")

  // Rollback: удалить новые достижения
  const newCodes = [
    'builder', 'warrior', 'cosmonaut', 'cheerful', 'strongman', 'creative',
    'sniper', 'strategist', 'hacker', 'gamer',
    'ironman', 'jedi', 'rebel', 'sheriff',
    'hat_trick', 'weekend_warrior', 'sprinter', 'centurion'
  ];

  for (const code of newCodes) {
    try {
      const records = app.findRecordsByFilter(collection, `code = "${code}"`, '-created', 1);
      if (records.length > 0) {
        app.delete(records[0]);
      }
    } catch (e) {
      // ignore if not found
    }
  }

  // Rollback: вернуть старые дублирующие иконки
  const oldIconUpdates = {
    'champion': 'icon016.png',
    'absolute': 'icon020.png',
    'perfect': 'icon024.png',
    'first_win': 'icon005.png',
    'marathoner': 'icon010.png',
    'veteran': 'icon023.png',
    'speedster': 'icon021.png',
    'night_owl': 'icon013.png',
    'early_bird': 'icon008.png',
    'excellent': 'icon017.png',
  };

  for (const [code, iconFilename] of Object.entries(oldIconUpdates)) {
    try {
      const records = app.findRecordsByFilter(collection, `code = "${code}"`, '-created', 1);
      if (records.length > 0) {
        const record = records[0];
        record.set('icon', iconFilename);
        app.save(record);
      }
    } catch (e) {
      // ignore
    }
  }

  return null;
})

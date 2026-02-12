/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_achievements")

  // Маппинг достижений на реальные иконки (icon005.png - icon024.png)
  const iconMapping = {
    // COMMON (10 штук) - icon005 to icon014
    'start': 'icon005.png',
    'novice': 'icon006.png',
    'student': 'icon007.png',
    'explorer': 'icon008.png',
    'thinker': 'icon009.png',
    'solver': 'icon010.png',
    'calculator': 'icon011.png',
    'persistent': 'icon012.png',
    'brave': 'icon013.png',
    'diligent': 'icon014.png',

    // RARE (8 штук) - icon015 to icon022
    'smart': 'icon015.png',
    'erudite': 'icon016.png',
    'mathematician': 'icon017.png',
    'genius_algebra': 'icon018.png',
    'formula_master': 'icon019.png',
    'logic_lord': 'icon020.png',
    'quick_mind': 'icon021.png',
    'problem_crusher': 'icon022.png',

    // LEGENDARY (4 штуки) - используем яркие иконки
    'legend': 'icon023.png',
    'master': 'icon024.png',
    'champion': 'icon016.png', // Повторное использование красивых иконок
    'absolute': 'icon020.png',

    // CONDITIONS (8 штук) - микс из всех
    'perfect': 'icon024.png',
    'first_win': 'icon005.png',
    'marathoner': 'icon010.png',
    'veteran': 'icon023.png',
    'speedster': 'icon021.png',
    'night_owl': 'icon013.png',
    'early_bird': 'icon008.png',
    'excellent': 'icon017.png',
  };

  // Обновить иконки для всех достижений
  for (const [code, iconFilename] of Object.entries(iconMapping)) {
    const records = app.findRecordsByFilter(collection, `code = "${code}"`, '-created', 1)
    if (records.length > 0) {
      const record = records[0]
      record.set('icon', iconFilename)
      app.save(record)
    }
  }

  return null;
}, (app) => {
  // Rollback: вернуть старые названия иконок
  const collection = app.findCollectionByNameOrId("pbc_achievements")

  const oldIconMapping = {
    'start': 'start.png',
    'novice': 'novice.png',
    'student': 'student.png',
    'explorer': 'explorer.png',
    'thinker': 'thinker.png',
    'solver': 'solver.png',
    'calculator': 'calculator.png',
    'persistent': 'persistent.png',
    'brave': 'brave.png',
    'diligent': 'diligent.png',
    'smart': 'smart.png',
    'erudite': 'erudite.png',
    'mathematician': 'mathematician.png',
    'genius_algebra': 'genius_algebra.png',
    'formula_master': 'formula_master.png',
    'logic_lord': 'logic_lord.png',
    'quick_mind': 'quick_mind.png',
    'problem_crusher': 'problem_crusher.png',
    'legend': 'legend.png',
    'master': 'master.png',
    'champion': 'champion.png',
    'absolute': 'absolute.png',
    'perfect': 'perfect.png',
    'first_win': 'first_win.png',
    'marathoner': 'marathoner.png',
    'veteran': 'veteran.png',
    'speedster': 'speedster.png',
    'night_owl': 'night_owl.png',
    'early_bird': 'early_bird.png',
    'excellent': 'excellent.png',
  };

  for (const [code, iconFilename] of Object.entries(oldIconMapping)) {
    const records = app.findRecordsByFilter(collection, `code = "${code}"`, '-created', 1)
    if (records.length > 0) {
      const record = records[0]
      record.set('icon', iconFilename)
      app.save(record)
    }
  }

  return null;
})

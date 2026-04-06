/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const marathons = app.findCollectionByNameOrId("marathons");
  if (marathons) {
    const tasksField = marathons.fields.getByName("tasks");
    if (tasksField) {
      tasksField.maxSelect = 200; // Разрешаем до 200 задач
      app.save(marathons);
      console.log('[migration] Updated marathons tasks limit to 200');
    }
  }
}, (app) => {
  const marathons = app.findCollectionByNameOrId("marathons");
  if (marathons) {
    const tasksField = marathons.fields.getByName("tasks");
    if (tasksField) {
      tasksField.maxSelect = null;
      app.save(marathons);
    }
  }
});

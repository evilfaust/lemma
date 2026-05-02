/// <reference path="../pb_data/types.d.ts" />

// Добавляем поля created/updated в коллекции командного пиксель-арта.
// new Collection() в миграциях не создаёт autodate-поля автоматически.

migrate(
  (app) => {
    for (const name of ['pixel_art_team_sets', 'pixel_art_team_tiles']) {
      const col = app.findCollectionByNameOrId(name);
      col.fields.add(new Field({
        id: `autodate_${name}_created`,
        name: 'created',
        type: 'autodate',
        onCreate: true,
        onUpdate: false,
        presentable: false,
        system: false,
      }));
      col.fields.add(new Field({
        id: `autodate_${name}_updated`,
        name: 'updated',
        type: 'autodate',
        onCreate: true,
        onUpdate: true,
        presentable: false,
        system: false,
      }));
      app.save(col);
    }
  },
  (app) => {
    for (const name of ['pixel_art_team_sets', 'pixel_art_team_tiles']) {
      try {
        const col = app.findCollectionByNameOrId(name);
        col.fields.removeById(`autodate_${name}_created`);
        col.fields.removeById(`autodate_${name}_updated`);
        app.save(col);
      } catch (_) {}
    }
  }
);

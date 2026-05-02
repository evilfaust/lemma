/// <reference path="../pb_data/types.d.ts" />

// PocketBase отклоняет required number field со значением 0 (Go zero value).
// tile_index первой плитки всегда равен 0 — делаем поле не required.

migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('pixel_art_team_tiles');
    const field = col.fields.getByName('tile_index');
    field.required = false;
    app.save(col);
  },
  (app) => {
    const col = app.findCollectionByNameOrId('pixel_art_team_tiles');
    const field = col.fields.getByName('tile_index');
    field.required = true;
    app.save(col);
  }
);

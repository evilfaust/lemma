/// <reference path="../pb_data/types.d.ts" />

// Пересоздаём коллекции командного пиксель-арта с правильным форматом полей.
// Исходная миграция 1772000028 использовала options:{} для relation-полей —
// в PocketBase v0.22+ эти свойства должны быть на верхнем уровне поля.

migrate(
  (app) => {
    // Удаляем старые (некорректные) коллекции
    try { app.delete(app.findCollectionByNameOrId('pixel_art_team_tiles')); } catch (_) {}
    try { app.delete(app.findCollectionByNameOrId('pixel_art_team_sets')); } catch (_) {}

    // ── pixel_art_team_sets ───────────────────────────────────────────────────
    const sets = new Collection({
      id: 'pbc_pixel_art_team_sets',
      name: 'pixel_art_team_sets',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [
        {
          id: 'text_pats_title',
          name: 'title',
          type: 'text',
          required: true,
        },
        {
          id: 'json_pats_matrix',
          name: 'matrix',
          type: 'json',
          required: true,
          maxSize: 5242880,
        },
        {
          id: 'number_pats_grid_cols',
          name: 'grid_cols',
          type: 'number',
          required: true,
        },
        {
          id: 'number_pats_grid_rows',
          name: 'grid_rows',
          type: 'number',
          required: true,
        },
        {
          id: 'number_pats_tile_count',
          name: 'tile_count',
          type: 'number',
          required: true,
        },
        {
          id: 'text_pats_task_mode',
          name: 'task_mode',
          type: 'text',
          required: true,
        },
        {
          id: 'number_pats_threshold',
          name: 'threshold',
          type: 'number',
          required: false,
        },
        {
          id: 'bool_pats_two_sheets',
          name: 'two_sheets',
          type: 'bool',
          required: false,
        },
        {
          id: 'bool_pats_two_columns',
          name: 'two_columns',
          type: 'bool',
          required: false,
        },
        {
          id: 'relation_pats_shared_tasks',
          name: 'shared_tasks',
          type: 'relation',
          required: false,
          collectionId: 'pbc_2602490748',  // tasks collection
          cascadeDelete: false,
          maxSelect: 30,
          minSelect: 0,
          presentable: false,
          hidden: false,
          system: false,
        },
        {
          id: 'json_pats_shared_custom_answers',
          name: 'shared_custom_answers',
          type: 'json',
          required: false,
          maxSize: 65536,
        },
      ],
    });
    app.save(sets);

    // ── pixel_art_team_tiles ──────────────────────────────────────────────────
    const tiles = new Collection({
      id: 'pbc_pixel_art_team_tiles',
      name: 'pixel_art_team_tiles',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [
        {
          id: 'relation_patt_team_set',
          name: 'team_set',
          type: 'relation',
          required: true,
          collectionId: 'pbc_pixel_art_team_sets',
          cascadeDelete: true,
          maxSelect: 1,
          presentable: false,
          hidden: false,
          system: false,
        },
        {
          id: 'number_patt_tile_index',
          name: 'tile_index',
          type: 'number',
          required: true,
        },
        {
          id: 'json_patt_tasks',
          name: 'tasks',
          type: 'json',
          required: false,
          maxSize: 65536,
        },
        {
          id: 'json_patt_custom_answers',
          name: 'custom_answers',
          type: 'json',
          required: false,
          maxSize: 65536,
        },
        {
          id: 'json_patt_grid',
          name: 'grid',
          type: 'json',
          required: false,
          maxSize: 5242880,
        },
      ],
    });
    app.save(tiles);
  },

  (app) => {
    try { app.delete(app.findCollectionByNameOrId('pixel_art_team_tiles')); } catch (_) {}
    try { app.delete(app.findCollectionByNameOrId('pixel_art_team_sets')); } catch (_) {}
  }
);

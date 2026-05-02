/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // ── pixel_art_team_sets ───────────────────────────────────────────────────
    const sets = new Collection({
      type: 'base',
      name: 'pixel_art_team_sets',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [
        { type: 'text',   name: 'title',                required: true },
        { type: 'json',   name: 'matrix',               required: true,  maxSize: 5242880 },
        { type: 'number', name: 'grid_cols',             required: true },
        { type: 'number', name: 'grid_rows',             required: true },
        { type: 'number', name: 'tile_count',            required: true },  // 2, 3 или 4 (плиток на сторону)
        { type: 'text',   name: 'task_mode',             required: true },  // 'same' | 'per_tile'
        { type: 'number', name: 'threshold',             required: false },
        { type: 'bool',   name: 'two_sheets',            required: false },
        { type: 'bool',   name: 'two_columns',           required: false },
        // Задачи для режима 'same' (одинаковые для всех плиток)
        {
          type: 'relation',
          name: 'shared_tasks',
          required: false,
          collectionId: '_pb_users_auth_',  // заменится ниже
          options: { maxSelect: 30 },
        },
        { type: 'json',   name: 'shared_custom_answers', required: false, maxSize: 65536 },
      ],
    });

    // Получаем реальный id коллекции tasks
    const tasksCollection = app.findCollectionByNameOrId('tasks');
    const taskField = sets.fields.find(f => f.name === 'shared_tasks');
    if (taskField) taskField.collectionId = tasksCollection.id;

    app.save(sets);

    // ── pixel_art_team_tiles ──────────────────────────────────────────────────
    const setsCollection = app.findCollectionByNameOrId('pixel_art_team_sets');

    const tiles = new Collection({
      type: 'base',
      name: 'pixel_art_team_tiles',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [
        {
          type: 'relation',
          name: 'team_set',
          required: true,
          collectionId: setsCollection.id,
          options: { maxSelect: 1, cascadeDelete: true },
        },
        { type: 'number', name: 'tile_index',      required: true },   // 0-based, row-major
        { type: 'json',   name: 'tasks',            required: false, maxSize: 65536 },  // массив task ids (per_tile)
        { type: 'json',   name: 'custom_answers',   required: false, maxSize: 65536 },
        { type: 'json',   name: 'grid',             required: false, maxSize: 5242880 }, // Cell[][]
      ],
    });

    app.save(tiles);
  },

  (app) => {
    try { app.delete(app.findCollectionByNameOrId('pixel_art_team_tiles')); } catch (_) {}
    try { app.delete(app.findCollectionByNameOrId('pixel_art_team_sets')); } catch (_) {}
  }
);

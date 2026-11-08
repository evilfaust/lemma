/// <reference path="../pb_data/types.d.ts" />
// Изолированный эксперимент. Все записи доступны только через проверяющие хуки.
migrate((app) => {
  const relation = (name, collection, max = 1) => ({ name, type: 'relation', collectionId: app.findCollectionByNameOrId(collection).id, required: true, minSelect: 1, maxSelect: max, cascadeDelete: false });
  const dates = [
    { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
    { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
  ];
  app.save(new Collection({
    name: 'lab_interval_works', type: 'base',
    listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
    fields: [
      relation('owner', 'teachers'), relation('group', 'teaching_groups'),
      relation('participants', 'students', 500),
      { name: 'title', type: 'text', required: true, max: 200 },
      { name: 'roster', type: 'json', required: true, maxSize: 200000 },
      { name: 'tasks', type: 'json', required: true, maxSize: 500000 },
      { name: 'settings', type: 'json', required: true, maxSize: 10000 },
      { name: 'is_open', type: 'bool' }, ...dates,
    ],
    indexes: ['CREATE INDEX idx_lab_interval_owner ON lab_interval_works (owner)'],
  }));
  app.save(new Collection({
    name: 'lab_interval_attempts', type: 'base',
    listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
    fields: [
      relation('work', 'lab_interval_works'), relation('student', 'students'),
      { name: 'state', type: 'json', required: true, maxSize: 500000 },
      { name: 'status', type: 'select', required: true, values: ['started', 'completed'], maxSelect: 1 },
      ...dates,
    ],
    indexes: ['CREATE UNIQUE INDEX idx_lab_interval_student ON lab_interval_attempts (work, student)'],
  }));
}, (app) => {
  // Down уничтожает только данные эксперимента; применять по DATABASE_SAFETY.md.
  app.delete(app.findCollectionByNameOrId('lab_interval_attempts'));
  app.delete(app.findCollectionByNameOrId('lab_interval_works'));
});

/// <reference path="../pb_data/types.d.ts" />
// Личные шаблоны заметок. Только новая коллекция; существующие заметки и
// остальные данные не изменяются. Down удаляет коллекцию вместе с шаблонами.
migrate((app) => {
  const teacher = '@request.auth.collectionName = "teachers"';
  const owner = 'owner = @request.auth.id';
  const editor = '@request.auth.role != "viewer"';
  app.save(new Collection({
    name: 'teacher_note_templates',
    type: 'base',
    fields: [
      { name: 'owner', type: 'relation', required: true, collectionId: app.findCollectionByNameOrId('teachers').id, maxSelect: 1, minSelect: 1, cascadeDelete: false },
      { name: 'title', type: 'text', required: true, min: 1, max: 200 },
      { name: 'type', type: 'select', maxSelect: 1, values: ['lesson', 'plan', 'idea', 'call', 'obs'] },
      { name: 'body', type: 'json', required: true, maxSize: 2000000 },
      { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
      { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
    ],
    indexes: ['CREATE INDEX idx_note_templates_owner ON teacher_note_templates (owner)'],
    listRule: `${teacher} && ${owner}`,
    viewRule: `${teacher} && ${owner}`,
    createRule: `${teacher} && ${editor} && ${owner}`,
    updateRule: `${teacher} && ${editor} && ${owner} && (@request.body.owner:isset = false || @request.body.owner = owner)`,
    deleteRule: `${teacher} && ${editor} && ${owner}`,
  }));
}, (app) => {
  app.delete(app.findCollectionByNameOrId('teacher_note_templates'));
});

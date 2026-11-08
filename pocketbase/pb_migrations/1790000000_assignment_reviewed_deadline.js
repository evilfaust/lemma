/// <reference path="../pb_data/types.d.ts" />
// Отметка относится к конкретному сроку. Продление возвращает выдачу
// в очередь после наступления нового срока, даже если старый был разобран.
migrate((app) => {
  const collection = app.findCollectionByNameOrId('work_sessions');
  if (!collection.fields.getByName('reviewed_deadline')) {
    collection.fields.add(new DateField({ name: 'reviewed_deadline', id: 'date_reviewed_deadline' }));
    app.save(collection);
  }
}, (app) => {
  const collection = app.findCollectionByNameOrId('work_sessions');
  const field = collection.fields.getByName('reviewed_deadline');
  if (field) {
    collection.fields.removeById(field.id);
    app.save(collection);
  }
});

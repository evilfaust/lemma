/// <reference path="../pb_data/types.d.ts" />
// Старые выдачи сохраняют условный срок (false).
migrate((app) => {
  const collection = app.findCollectionByNameOrId('work_sessions');
  if (!collection.fields.getByName('strict_deadline')) {
    collection.fields.add(new BoolField({ name: 'strict_deadline', id: 'bool_strict_deadline' }));
    app.save(collection);
  }
  const attempts = app.findCollectionByNameOrId('attempts');
  if (!attempts.fields.getByName('started_at')) {
    attempts.fields.add(new DateField({ name: 'started_at', id: 'date_attempt_start' }));
    app.save(attempts);
    // Для старых онлайн-попыток единственная известная отметка — created.
    app.db().newQuery("UPDATE attempts SET started_at = created WHERE source != 'scan'").execute();
  }
}, (app) => {
  const collection = app.findCollectionByNameOrId('work_sessions');
  const field = collection.fields.getByName('strict_deadline');
  if (field) { collection.fields.removeById(field.id); app.save(collection); }
  const attempts = app.findCollectionByNameOrId('attempts');
  const startField = attempts.fields.getByName('started_at');
  if (startField) { attempts.fields.removeById(startField.id); app.save(attempts); }
});

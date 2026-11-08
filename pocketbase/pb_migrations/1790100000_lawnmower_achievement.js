/// <reference path="../pb_data/types.d.ts" />

const CONDITION = 'perfect_after_errors';
const CODE = 'lawnmower';

migrate((app) => {
  const collection = app.findCollectionByNameOrId('achievements');
  const field = collection.fields.getByName('condition_type');
  if (!field.values.includes(CONDITION)) {
    field.values = [...field.values, CONDITION];
    app.save(collection);
  }

  const existing = app.findRecordsByFilter(collection, 'code = {:code}', '', 1, 0, { code: CODE });
  if (!existing.length) {
    app.save(new Record(collection, {
      code: CODE,
      title: 'газонокосильщик',
      description: 'У тебя получилось, Джоуб!',
      icon: 'icon109.jpg',
      type: 'condition',
      condition_type: CONDITION,
      order: 103,
    }));
  }
}, (app) => {
  const collection = app.findCollectionByNameOrId('achievements');
  const seeded = app.findRecordsByFilter(collection, 'code = {:code}', '', 1, 0, { code: CODE });
  if (seeded.length) app.delete(seeded[0]);
  const field = collection.fields.getByName('condition_type');
  field.values = field.values.filter(value => value !== CONDITION);
  app.save(collection);
});

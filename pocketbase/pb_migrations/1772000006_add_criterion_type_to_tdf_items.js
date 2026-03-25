/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const items = app.findCollectionByNameOrId("tdf_items");
  const typeField = items.fields.getByName("type");

  if (!typeField) {
    throw new Error('Field "type" not found in tdf_items');
  }

  const nextValues = Array.isArray(typeField.values) ? [...typeField.values] : [];
  if (!nextValues.includes("criterion")) {
    nextValues.push("criterion");
  }

  typeField.values = nextValues;
  app.save(items);
  console.log('Added "criterion" to tdf_items.type select values');
}, (app) => {
  const items = app.findCollectionByNameOrId("tdf_items");
  const typeField = items.fields.getByName("type");

  if (!typeField) {
    throw new Error('Field "type" not found in tdf_items');
  }

  typeField.values = (Array.isArray(typeField.values) ? typeField.values : [])
    .filter((value) => value !== "criterion");

  app.save(items);
  console.log('Removed "criterion" from tdf_items.type select values');
});

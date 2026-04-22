/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const attempts = app.findCollectionByNameOrId("attempts");

  // 1. Сделать variant опциональным (для MC-попыток variant пустой)
  const variantField = attempts.fields.getByName("variant");
  if (variantField) {
    variantField.required = false;
    if (typeof variantField.minSelect === 'number') variantField.minSelect = 0;
    attempts.fields.add(variantField);
  }

  // 2. Добавить mc_variant — номер варианта внутри mc_tests.variants
  if (!attempts.fields.getByName("mc_variant")) {
    attempts.fields.add(new Field({
      name: "mc_variant",
      type: "number",
      required: false,
      onlyInt: true,
    }));
  }

  app.save(attempts);
  console.log('[migration] attempts: variant→optional, +mc_variant');
}, (app) => {
  const attempts = app.findCollectionByNameOrId("attempts");
  const variantField = attempts.fields.getByName("variant");
  if (variantField) { variantField.required = true; attempts.fields.add(variantField); }
  const mcv = attempts.fields.getByName("mc_variant");
  if (mcv) attempts.fields.removeById(mcv.id);
  app.save(attempts);
});

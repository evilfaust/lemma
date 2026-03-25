/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  for (const name of ["tdf_sets", "tdf_items", "tdf_variants"]) {
    const col = app.findCollectionByNameOrId(name);
    col.listRule = "";
    col.viewRule = "";
    col.createRule = "";
    col.updateRule = "";
    col.deleteRule = "";
    app.save(col);
    console.log(`Fixed all rules for ${name}`);
  }
}, (app) => {
  for (const name of ["tdf_sets", "tdf_items", "tdf_variants"]) {
    const col = app.findCollectionByNameOrId(name);
    col.createRule = null;
    col.updateRule = null;
    col.deleteRule = null;
    app.save(col);
  }
});

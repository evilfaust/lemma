/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  for (const name of ["tdf_sets", "tdf_items", "tdf_variants"]) {
    const col = app.findCollectionByNameOrId(name);
    col.listRule = "";
    col.viewRule = "";
    app.save(col);
    console.log(`Fixed rules for ${name}`);
  }
}, (app) => {
  for (const name of ["tdf_sets", "tdf_items", "tdf_variants"]) {
    const col = app.findCollectionByNameOrId(name);
    col.listRule = null;
    col.viewRule = null;
    app.save(col);
  }
});

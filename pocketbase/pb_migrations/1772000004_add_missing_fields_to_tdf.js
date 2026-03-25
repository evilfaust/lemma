/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // --- tdf_sets: добавить недостающие поля ---
  const sets = app.findCollectionByNameOrId("tdf_sets");

  const setsFields = [
    { type: "text", id: "text_tdf_sets_title", name: "title", required: true, max: 300 },
    { type: "number", id: "number_tdf_sets_class", name: "class_number", onlyInt: true },
    { type: "text", id: "text_tdf_sets_description", name: "description", max: 0 },
    { type: "number", id: "number_tdf_sets_order", name: "order", onlyInt: true },
    { type: "autodate", id: "autodate_tdf_sets_created", name: "created", onCreate: true, onUpdate: false },
    { type: "autodate", id: "autodate_tdf_sets_updated", name: "updated", onCreate: true, onUpdate: true },
  ];

  for (const f of setsFields) {
    if (!sets.fields.getByName(f.name)) {
      if (f.type === "text") {
        sets.fields.add(new TextField({ id: f.id, name: f.name, required: !!f.required, max: f.max || 0 }));
      } else if (f.type === "number") {
        sets.fields.add(new NumberField({ id: f.id, name: f.name, onlyInt: !!f.onlyInt }));
      } else if (f.type === "autodate") {
        sets.fields.add(new AutodateField({ id: f.id, name: f.name, onCreate: f.onCreate, onUpdate: f.onUpdate }));
      }
      console.log(`tdf_sets: added field ${f.name}`);
    }
  }
  app.save(sets);

  // --- tdf_items: добавить все поля ---
  const tdfSetsId = sets.id;
  const items = app.findCollectionByNameOrId("tdf_items");

  const itemFields = [
    { type: "relation", id: "rel_tdf_items_set", name: "tdf_set", collectionId: tdfSetsId, required: true, cascadeDelete: true },
    { type: "number", id: "number_tdf_items_order", name: "order", onlyInt: true },
    { type: "bool", id: "bool_tdf_items_is_section", name: "is_section_header" },
    { type: "text", id: "text_tdf_items_section_title", name: "section_title", max: 300 },
    { type: "select", id: "select_tdf_items_type", name: "type", values: ["theorem","definition","formula","axiom","property"] },
    { type: "text", id: "text_tdf_items_name", name: "name", max: 300 },
    { type: "text", id: "text_tdf_items_question", name: "question_md", max: 0 },
    { type: "text", id: "text_tdf_items_formulation", name: "formulation_md", max: 0 },
    { type: "file", id: "file_tdf_items_drawing", name: "drawing_image", maxSelect: 1, maxSize: 5242880, mimeTypes: ["image/png","image/jpeg","image/webp"] },
    { type: "text", id: "text_tdf_items_ggb_base64", name: "geogebra_base64", max: 0 },
    { type: "text", id: "text_tdf_items_ggb_appname", name: "geogebra_appname", max: 50 },
    { type: "text", id: "text_tdf_items_notation", name: "short_notation_md", max: 0 },
    { type: "autodate", id: "autodate_tdf_items_created", name: "created", onCreate: true, onUpdate: false },
    { type: "autodate", id: "autodate_tdf_items_updated", name: "updated", onCreate: true, onUpdate: true },
  ];

  for (const f of itemFields) {
    if (!items.fields.getByName(f.name)) {
      if (f.type === "relation") {
        items.fields.add(new RelationField({ id: f.id, name: f.name, collectionId: f.collectionId, required: !!f.required, cascadeDelete: !!f.cascadeDelete, maxSelect: 1 }));
      } else if (f.type === "text") {
        items.fields.add(new TextField({ id: f.id, name: f.name, required: !!f.required, max: f.max || 0 }));
      } else if (f.type === "number") {
        items.fields.add(new NumberField({ id: f.id, name: f.name, onlyInt: !!f.onlyInt }));
      } else if (f.type === "bool") {
        items.fields.add(new BoolField({ id: f.id, name: f.name }));
      } else if (f.type === "select") {
        items.fields.add(new SelectField({ id: f.id, name: f.name, values: f.values, maxSelect: 1 }));
      } else if (f.type === "file") {
        items.fields.add(new FileField({ id: f.id, name: f.name, maxSelect: f.maxSelect, maxSize: f.maxSize, mimeTypes: f.mimeTypes }));
      } else if (f.type === "autodate") {
        items.fields.add(new AutodateField({ id: f.id, name: f.name, onCreate: f.onCreate, onUpdate: f.onUpdate }));
      }
      console.log(`tdf_items: added field ${f.name}`);
    }
  }
  app.save(items);
  console.log("Migration 1772000004: all fields added");
}, (app) => {
  // rollback: удалить добавленные поля
  const fieldNames = ["title","class_number","description","order","created","updated"];
  const sets = app.findCollectionByNameOrId("tdf_sets");
  for (const name of fieldNames) {
    const f = sets.fields.getByName(name);
    if (f) sets.fields.removeById(f.id);
  }
  app.save(sets);

  const itemNames = ["tdf_set","order","is_section_header","section_title","type","name","question_md","formulation_md","drawing_image","geogebra_base64","geogebra_appname","short_notation_md","created","updated"];
  const items = app.findCollectionByNameOrId("tdf_items");
  for (const name of itemNames) {
    const f = items.fields.getByName(name);
    if (f) items.fields.removeById(f.id);
  }
  app.save(items);
});

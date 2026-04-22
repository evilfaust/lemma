/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const trigMcTests = app.findCollectionByNameOrId("trig_mc_tests");

  const ws = app.findCollectionByNameOrId("work_sessions");

  const field = new RelationField({
    "id": "rel_ws_trig_mc_test",
    "name": "trig_mc_test",
    "collectionId": trigMcTests.id,
    "presentable": false,
    "required": false,
    "system": false,
    "maxSelect": 1,
  });

  ws.fields.add(field);
  app.save(ws);
  console.log('[migration] work_sessions.trig_mc_test → added');

}, (app) => {
  const ws = app.findCollectionByNameOrId("work_sessions");
  const field = ws.fields.getByName("trig_mc_test");
  if (field) {
    ws.fields.remove(field);
    app.save(ws);
    console.log('[rollback] work_sessions.trig_mc_test → removed');
  }
});

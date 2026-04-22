/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const ws = app.findCollectionByNameOrId("work_sessions");
  const workField = ws.fields.getByName("work");
  if (workField) {
    workField.required = false;
    if (typeof workField.minSelect === 'number') workField.minSelect = 0;
    ws.fields.add(workField);
    app.save(ws);
    console.log('[migration] work_sessions.work → required=false');
  }
}, (app) => {
  const ws = app.findCollectionByNameOrId("work_sessions");
  const workField = ws.fields.getByName("work");
  if (workField) {
    workField.required = true;
    ws.fields.add(workField);
    app.save(ws);
  }
});

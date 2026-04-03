/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = new Collection({
    "createRule": null,
    "deleteRule": null,
    "fields": [
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text_rs_title",
        "max": 300,
        "min": 0,
        "name": "title",
        "pattern": "",
        "presentable": true,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "text"
      },
      {
        "cascadeDelete": false,
        "collectionId": "pbc_2602490748",
        "hidden": false,
        "id": "relation_rs_tasks",
        "maxSelect": 30,
        "minSelect": 0,
        "name": "tasks",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "relation"
      },
      {
        "hidden": false,
        "id": "json_rs_chain_links",
        "maxSize": 0,
        "name": "chain_links",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "json"
      }
    ],
    "indexes": [],
    "listRule": null,
    "name": "route_sheets",
    "type": "base",
    "updateRule": null,
    "viewRule": null
  });

  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("route_sheets");
  app.delete(collection);
});

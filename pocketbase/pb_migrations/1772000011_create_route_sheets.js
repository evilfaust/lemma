/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = new Collection({
    name: "route_sheets",
    type: "base",
    fields: [
      {
        name: "title",
        type: "text",
        required: true,
      },
      {
        name: "tasks",
        type: "relation",
        options: {
          collectionId: "pbc_2602490748",
          maxSelect: null,
          cascadeDelete: false,
        },
      },
      {
        name: "chain_links",
        type: "json",
        options: { maxSize: 100000 },
      },
    ],
    indexes: [],
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
  });

  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("route_sheets");
  app.delete(collection);
});

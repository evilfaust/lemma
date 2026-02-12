/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = new Collection({
    "id": "pbc_students",
    "name": "students",
    "type": "auth",
    "fields": [
      {
        "autogeneratePattern": "[a-z0-9]{15}",
        "hidden": false,
        "id": "text3208210256",
        "max": 15,
        "min": 15,
        "name": "id",
        "pattern": "^[a-z0-9]+$",
        "presentable": false,
        "primaryKey": true,
        "required": true,
        "system": true,
        "type": "text"
      },
      {
        "cost": 12,
        "hidden": true,
        "id": "password",
        "max": 0,
        "min": 4,
        "name": "password",
        "pattern": "",
        "presentable": false,
        "required": true,
        "system": true,
        "type": "password"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text_username",
        "max": 0,
        "min": 3,
        "name": "username",
        "pattern": "^[\\w][\\w\\.\\-]*$",
        "presentable": false,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "text"
      },
      {
        "exceptDomains": [],
        "hidden": false,
        "id": "email",
        "max": 0,
        "min": 0,
        "name": "email",
        "onlyDomains": [],
        "presentable": false,
        "required": false,
        "system": true,
        "type": "email"
      },
      {
        "hidden": false,
        "id": "bool_emailVisibility",
        "name": "emailVisibility",
        "presentable": false,
        "required": false,
        "system": true,
        "type": "bool"
      },
      {
        "hidden": false,
        "id": "bool_verified",
        "name": "verified",
        "presentable": false,
        "required": false,
        "system": true,
        "type": "bool"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text_student_name",
        "max": 100,
        "min": 2,
        "name": "name",
        "pattern": "",
        "presentable": true,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "autodate2990389176",
        "name": "created",
        "onCreate": true,
        "onUpdate": false,
        "presentable": false,
        "system": false,
        "type": "autodate"
      },
      {
        "hidden": false,
        "id": "autodate3332085495",
        "name": "updated",
        "onCreate": true,
        "onUpdate": true,
        "presentable": false,
        "system": false,
        "type": "autodate"
      }
    ],
    "indexes": [
      "CREATE UNIQUE INDEX idx_students_username ON students (username)"
    ],
    "listRule": "",
    "viewRule": "id = @request.auth.id",
    "createRule": "",
    "updateRule": "id = @request.auth.id",
    "deleteRule": null,
    "authRule": "",
    "manageRule": null,
    "oauth2": {
      "enabled": false,
      "mappedFields": {}
    },
    "passwordAuth": {
      "enabled": true,
      "identityFields": ["username"]
    },
    "mfa": {
      "enabled": false,
      "rule": "",
      "duration": 0
    }
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_students");
  return app.delete(collection);
});

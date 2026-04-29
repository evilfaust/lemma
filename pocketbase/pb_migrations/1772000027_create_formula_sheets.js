/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const collection = new Collection({
      id: 'pbc_formula_sheets',
      name: 'formula_sheets',
      type: 'base',
      fields: [
        { name: 'title',        type: 'text',   required: true },
        { name: 'subtitle',     type: 'text',   required: false },
        { name: 'subject',      type: 'text',   required: false },
        { name: 'class_number', type: 'number', required: false },
        {
          name: 'sections',
          type: 'json',
          required: true,
          // JSON: [{ id, title, formulas: [{ id, left, right }] }]
        },
      ],
      listRule:   '',
      viewRule:   '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
    });
    return app.save(collection);
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('formula_sheets');
    return app.delete(collection);
  }
);

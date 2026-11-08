/// <reference path="../pb_data/types.d.ts" />
// Назначение существующей выдачи классам/курсам. Аддитивно: старые выдачи
// и их сроки/попытки не меняются, правила доступа остаются прежними.
migrate((app) => {
  const sessions = app.findCollectionByNameOrId('work_sessions');
  if (!sessions.fields.getByName('groups')) {
    sessions.fields.add(new RelationField({
      id: 'rel_session_groups', name: 'groups',
      collectionId: app.findCollectionByNameOrId('teaching_groups').id,
      cascadeDelete: false, minSelect: 0, maxSelect: 50, required: false,
    }));
    app.save(sessions);
  }
}, (app) => {
  const sessions = app.findCollectionByNameOrId('work_sessions');
  const field = sessions.fields.getByName('groups');
  if (field) { sessions.fields.removeById(field.id); app.save(sessions); }
});

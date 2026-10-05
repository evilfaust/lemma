/// <reference path="../pb_data/types.d.ts" />
// Смена пароля при первом входе (v3.9.294).
//
// students.must_change_password — пароль выдал учитель (карточка с логином и
// простым паролем), ученик при входе видит «Придумай свой пароль». Ставит
// хук students_admin.pb.js (issue-credentials, set-password) и создание
// аккаунта учителем; снимает сам ученик, сменив пароль (updateRule: id =
// @request.auth.id — правила не меняются).

migrate((app) => {
  const students = app.findCollectionByNameOrId("students");
  students.fields.add(new BoolField({
    "id": "bool_students_must_change_pw",
    "name": "must_change_password",
    "required": false,
    "presentable": false,
    "hidden": false,
    "system": false,
  }));
  app.save(students);
  console.log("[1788000000] students.must_change_password");
}, (app) => {
  try {
    const students = app.findCollectionByNameOrId("students");
    students.fields.removeById("bool_students_must_change_pw");
    app.save(students);
  } catch (e) { console.log("[1788000000] откат:", e?.message); }
});

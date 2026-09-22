/// <reference path="../pb_data/types.d.ts" />

// Починка правил со-ведения (v3.9.227): у мульти-relation нужен `.id`.
//
// 🚨 В PocketBase 0.36 `co_teachers ?= @request.auth.id` синтаксически валиден
// (200, не 400), но НЕ СОВПАДАЕТ НИКОГДА — второй учитель получал пустые
// списки классов, уроков, учеников и посещаемости. Правильная форма —
// `co_teachers.id ?= @request.auth.id` (так же для `shared_with` и путей
// `group.co_teachers`, `lesson.group.co_teachers`, `teaching_group.co_teachers`).
// Проверено на синтетическом PB 0.36.5 под токеном второго учителя: без `.id`
// 0 записей, с `.id` — все, включая трёхуровневый `lesson.group.co_teachers.id`.
// Под superadmin ошибку не видно: его пропускает `@request.auth.role = "superadmin"`.
//
// Правила не переписываются целиком — в текущих правилах точечно дописывается
// `.id`, поэтому ручные правки в админке (если были) переживают миграцию.

const COLLECTIONS = [
  'teaching_groups', 'lessons', 'lesson_attendance',
  'students', 'group_memberships', 'teacher_notes',
];
const RULE_KEYS = ['listRule', 'viewRule', 'createRule', 'updateRule', 'deleteRule'];

function rewrite(app, fix) {
  for (const name of COLLECTIONS) {
    const col = app.findCollectionByNameOrId(name);
    let changed = 0;
    for (const key of RULE_KEYS) {
      // Правило в JSVM — Go `*string`: приходит объектом String (typeof
      // 'object'), а null означает «только суперпользователь».
      if (col[key] == null) continue;
      const rule = String(col[key]);
      if (!rule) continue;
      const next = fix(rule);
      if (next !== rule) { col[key] = next; changed++; }
    }
    if (changed) {
      app.save(col);
      console.log(`[1786300000] ${name}: исправлено правил — ${changed}`);
    }
  }
}

migrate((app) => {
  rewrite(app, (r) => r.replace(/\b(co_teachers|shared_with) \?=/g, '$1.id ?='));
}, (app) => {
  rewrite(app, (r) => r.replace(/\b(co_teachers|shared_with)\.id \?=/g, '$1 ?='));
});

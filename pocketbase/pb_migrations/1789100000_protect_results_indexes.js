/// <reference path="../pb_data/types.d.ts" />
// Аудит 25.10.2026, шаг 1: результаты учеников и варианты работ больше не
// стираются анонимом + индексы под частые запросы.
//
// Было: у attempt_answers и variants все правила пустые, у attempts пустые
// create/update/delete — любой без входа мог удалить все попытки, ответы и
// варианты одним запросом.
//
// Стало:
// • attempts / attempt_answers — удаляет только учитель (не viewer). Ученический
//   код ничего не удаляет; удаление попытки — «Результаты» учителя. Создание и
//   правка пока прежние (гость проходит тест по device_id) — шаг 2.
// • variants — пишет только учитель (не viewer), читают все, как раньше
//   (ученик берёт вариант по id и списком по работе).
//
// Индексы — только добавляются, данные не меняются:
// attempts(session) · attempts(student) · attempts(device_id) ·
// attempt_answers(attempt) · attempt_answers(task) · variants(work) ·
// work_sessions(work) · work_sessions(mc_test) · work_sessions(owner) · lessons(group).

const TEACHER_EDIT = '@request.auth.collectionName = "teachers" && @request.auth.role != "viewer"';

const INDEXES = [
  ['attempts', 'idx_attempts_session', '`session`'],
  ['attempts', 'idx_attempts_student', '`student`'],
  ['attempts', 'idx_attempts_device', '`device_id`'],
  ['attempt_answers', 'idx_attempt_answers_attempt', '`attempt`'],
  ['attempt_answers', 'idx_attempt_answers_task', '`task`'],
  ['variants', 'idx_variants_work', '`work`'],
  ['work_sessions', 'idx_work_sessions_work', '`work`'],
  ['work_sessions', 'idx_work_sessions_mc_test', '`mc_test`'],
  ['work_sessions', 'idx_work_sessions_owner', '`owner`'],
  ['lessons', 'idx_lessons_group', '`group`'],
];

migrate((app) => {
  const attempts = app.findCollectionByNameOrId('attempts');
  attempts.deleteRule = TEACHER_EDIT;
  app.save(attempts);

  const answers = app.findCollectionByNameOrId('attempt_answers');
  answers.deleteRule = TEACHER_EDIT;
  app.save(answers);

  const variants = app.findCollectionByNameOrId('variants');
  variants.createRule = TEACHER_EDIT;
  variants.updateRule = TEACHER_EDIT;
  variants.deleteRule = TEACHER_EDIT;
  app.save(variants);

  for (const [name, idx, cols] of INDEXES) {
    const col = app.findCollectionByNameOrId(name);
    col.removeIndex(idx);
    col.addIndex(idx, false, cols, '');
    app.save(col);
  }
  console.log('[1789100000] попытки/ответы/варианты защищены, индексы добавлены');
}, (app) => {
  // Откат — правила как на проде до 25.10.2026 (пустые = открыто всем).
  const attempts = app.findCollectionByNameOrId('attempts');
  attempts.deleteRule = '';
  app.save(attempts);

  const answers = app.findCollectionByNameOrId('attempt_answers');
  answers.deleteRule = '';
  app.save(answers);

  const variants = app.findCollectionByNameOrId('variants');
  variants.createRule = '';
  variants.updateRule = '';
  variants.deleteRule = '';
  app.save(variants);

  for (const [name, idx] of INDEXES) {
    try {
      const col = app.findCollectionByNameOrId(name);
      col.removeIndex(idx);
      app.save(col);
    } catch (e) {
      console.log('[1789100000] откат индекса', idx, e?.message);
    }
  }
});

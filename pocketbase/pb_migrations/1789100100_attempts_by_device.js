/// <reference path="../pb_data/types.d.ts" />
// Аудит 25.10.2026, шаг 2: чужие попытки и ответы больше не читаются и не
// правятся.
//
// Было: попытки (с ФИО и баллами) и ответы любой выдачи читал кто угодно без
// входа, а править мог любой — балл, статус, ответы чужой попытки.
//
// Стало — попытку и её ответы видит и правит:
// • учитель (любой: результаты, исправления, выдача «ещё попытки»);
// • ученик по входу — свои (`student = я`);
// • устройство, на котором попытка начата: запрос несёт `?device=<UUID>`
//   (pb/client.js дописывает его ко всем запросам к attempts/attempt_answers),
//   правило сверяет с device_id попытки. Так продолжают работать гость без
//   аккаунта, привязка гостевой попытки после входа и ученик с истёкшим
//   токеном (PocketBase считает его гостем). 'paper-scan' — общая метка
//   бумажных бланков, по ней доступа нет.
// Создать попытку по-прежнему может любой (гость проходит тест), ответ —
// только к своей попытке. Раздача вариантов по кругу берёт раскладку из хука
// pb_hooks/attempts_load.pb.js (только variant/mc_variant, без людей).
// 🚨 Применять ПОСЛЕ выкладки фронта ≥ 3.9.403 и хука attempts_load.pb.js:
// старый фронт параметр device не шлёт.

const T = '@request.auth.collectionName = "teachers"';
const OWN = '(student != "" && student = @request.auth.id)';
const DEV = '(device_id != "" && device_id != "paper-scan" && device_id = @request.query.device)';
const A_OWN = '(attempt.student != "" && attempt.student = @request.auth.id)';
const A_DEV = '(attempt.device_id != "" && attempt.device_id != "paper-scan" && attempt.device_id = @request.query.device)';

const ATTEMPT_RULE = `${T} || ${OWN} || ${DEV}`;
const ANSWER_RULE = `${T} || ${A_OWN} || ${A_DEV}`;

// Снимок прода до миграции — для отката
const BEFORE = {
  attempts: {
    listRule: "@request.auth.id = '' || @request.auth.collectionName != 'students' || student = @request.auth.id || student = ''",
    viewRule: "@request.auth.id = '' || @request.auth.collectionName != 'students' || student = @request.auth.id || student = ''",
    createRule: '',
    updateRule: '',
  },
  attempt_answers: { listRule: '', viewRule: '', createRule: '', updateRule: '' },
};

migrate((app) => {
  const attempts = app.findCollectionByNameOrId('attempts');
  attempts.listRule = ATTEMPT_RULE;
  attempts.viewRule = ATTEMPT_RULE;
  attempts.updateRule = ATTEMPT_RULE;
  // createRule — прежний (пустой): гость начинает тест без входа
  app.save(attempts);

  const answers = app.findCollectionByNameOrId('attempt_answers');
  answers.listRule = ANSWER_RULE;
  answers.viewRule = ANSWER_RULE;
  answers.createRule = ANSWER_RULE;
  answers.updateRule = ANSWER_RULE;
  app.save(answers);
  console.log('[1789100100] попытки и ответы — только свои (по входу или устройству) и учителю');
}, (app) => {
  for (const name of Object.keys(BEFORE)) {
    const rules = BEFORE[name];
    const col = app.findCollectionByNameOrId(name);
    col.listRule = rules.listRule;
    col.viewRule = rules.viewRule;
    col.createRule = rules.createRule;
    col.updateRule = rules.updateRule;
    app.save(col);
  }
});

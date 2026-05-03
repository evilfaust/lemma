---
name: MC Tests (Тесты с выбором)
description: v3.9.9 — генератор тестов A/B/C/D с авто-дистракторами, выдача через work_sessions.mc_test
type: project
originSessionId: 281ccd9d-311e-4d74-aa41-a83e54f00690
---
# MC Tests — v3.9.9 (2026-04-22)

**Файлы:**
- `components/MCTestGenerator.jsx` + `components/mc-test/{MCOptionsEditor,MCTestPrintLayout(+CSS)}`
- `hooks/useMCTest.js` (state: title, classNumber, topicIds, optionsCount, shuffleMode, variants, savedId)
- `utils/distractorGenerator.js` — `generateDistractors`, `buildOptions`, `shuffleOptionsWithSeed` (Mulberry+FNV-1a)
- `components/student/StudentMCTestPage.jsx` — Radio.Group A/B/C/D, localStorage `ege_student_mc_answers_{attemptId}`

**БД:**
- Коллекция `mc_tests`: title, description, class_number, topics(rel), options_count(2-8), shuffle_mode("fixed"|"per_student"), variants(json)
- Миграция: `1772000017_create_mc_tests.js`
- `work_sessions.mc_test` (rel→mc_tests, optional) — для MC-сессии
- `work_sessions.work` сделано optional миграцией `1772000018_make_work_optional_in_sessions.js`

**Архитектурные решения:**
- Переиспользование work_sessions/attempts/attempt_answers/achievements — MC автоматически получает QR-выдачу + dashboard
- Синтетический variant id `mc-N` (без записи в БД), tasks обогащаются `mc_options` на лету в `useStudentSession.loadMCVariantTasks`
- `attempt.variant` для MC = строка номера варианта ("1"/"2"), не relation
- `attempt_answers.answer_raw` = индекс опции ("0".."3")
- per_student shuffle: seed = `hashStringToSeed(attemptId+taskId)` — стабильно при перезагрузке
- Round-robin выбора варианта по min-count из существующих attempts
- StudentApp dispatch: `session.mc_test ? StudentMCTestPage : StudentTestPage`

**API (7 методов):** getMCTests, getMCTest (getOne+expand), createMCTest, updateMCTest, deleteMCTest, getTasksByIds, createMCTestSession(mcTestId, extra), getSessionsByMCTest

**Pitfall: required=false на work**
- Изначально `work_sessions.work` был required → 400 при создании MC-сессии
- Фикс: миграция меняет `required=false`, `minSelect=0`. После применения `work` остаётся в записи как пустая строка `""`.

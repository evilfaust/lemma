---
name: Тригонометрические MC-тесты (v3.9.12)
description: MC-тесты из тригонометрических генераторов — архитектура выдачи и хранения
type: project
originSessionId: 5c0dcb24-e2eb-4e23-a8ea-b1b672de9d7a
---
MC-тесты, сгенерированные тригонометрическими генераторами (не из банка задач).

**Поддерживаемые генераторы:** trig_expressions, reduction_formulas, addition_formulas, double_angle, inverse_trig, trig_equations, trig_equations_advanced

**Сохранение задач:** TrigMCSaveModal создаёт реальные записи в коллекции `tasks` (source='trig_generator', topic = trig-тема по GENERATOR_TOPIC_TITLES → getTrigTopics() поиск по title)

**Структура варианта:** `{number, tasks: [{task_id, question, answer, options}]}` — question/answer inline для печати

**Выдача ученикам:** `work_sessions.trig_mc_test` (не work_sessions.mc_test!)
- Миграция: `1772000021`
- API: `createTrigMCTestSession`, `getSessionsByTrigMCTest`

**Ученический интерфейс:** `StudentMCTestPage` обрабатывает оба типа (session.mc_test и session.trig_mc_test)
- `wrapOptionText()` для рендеринга сырого LaTeX в опциях

**Редактор:** `TrigMCTestEditor` — Modal с табами «Редактор» / «Выдача»; импорт GENERATOR_LABELS из TrigMCSaveModal

**Удаление каскадное:** при удалении trig_mc_test удаляются связанные tasks (source='trig_generator')

**Why:** Отдельное поле в work_sessions (trig_mc_test) вместо переиспользования mc_test — для чёткого разделения источников и возможности каскадного удаления тригозадач.

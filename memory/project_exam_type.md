---
name: exam_type в topics — архитектура контекстов задач
description: Поле exam_type в topics разделяет задачи по контекстам (ЕГЭ базовый/профильный/триг/ВПР). Миграция 1772000023.
type: project
originSessionId: 4d9693ca-9f38-470f-97e1-3a4e3c73f373
---
Добавлена архитектура контекстов задач (v3.9.14, 2026-04-25).

**Поле `exam_type` в `topics`** — значения: `ege_base` | `ege_profile` | `mordkovich` | `oral` | `vpr` | `trig` | `other`

**Поле `exam_part` в `topics`** — для профильного ЕГЭ: 1 = часть 1 (задания 1–12), 2 = часть 2 (задания 13–19); null для остальных

**Миграция**: `1772000023_add_ege_profile_trig_to_topics.js` — применена на VPS 2026-04-25

**7 тригонометрических тем** (IDs trigtopic000001–trigtopic000007, exam_type='trig'):
- trigtopic000001: Вычисление тригонометрических выражений
- trigtopic000002: Простейшие тригонометрические уравнения
- trigtopic000003: Обратные тригонометрические функции
- trigtopic000004: Формулы двойного аргумента
- trigtopic000005: Уравнения f(kx+b)=a
- trigtopic000006: Формулы приведения
- trigtopic000007: Формулы сложения

**ReferenceDataContext**: добавлены `trigTopics` и `egeProfileTopics` (computed from topics). Кэш v2 → v3.

**TaskFilters**: новый фильтр «Контекст» (exam_type), при выборе — темы в дропдауне фильтруются. Тема отображается как `№N — title` если есть ege_number, иначе просто title — паттерн применён во всех ~16 компонентах.

**_buildTasksFilter**: `filters.exam_type` → `topic.exam_type = "..."` (для trig: `|| source = "trig_generator"` как fallback для старых задач без topic).

**TrigMCSaveModal**: GENERATOR_TOPIC_TITLES маппит generator_type → title темы; при сохранении fetch getTrigTopics() + match by title → topic ID.

**Why:** приложение разрослось, задачи из разных экзаменов/курсов хранятся в одной коллекции. exam_type разделяет их без создания новых коллекций. Профильный ЕГЭ — подготовлено поле exam_part.

**How to apply:** при создании новых типов задач (профильный ЕГЭ) — создавать темы с нужным exam_type и, при необходимости, exam_part. Фильтр в TaskFilters подхватится автоматически.

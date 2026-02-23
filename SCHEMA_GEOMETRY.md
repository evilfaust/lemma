# Geometry Schema (Source Of Truth)

Последняя сверка с production (`task-ege.oipav.ru`): **2026-02-23**  
PocketBase instance: `pocketbase-ege` (`127.0.0.1:8095`, `/opt/pocketbase/pb_data/data.db`)  
Бэкап перед изменениями: `/opt/pocketbase/pb_data/data.db.bak.20260223_164835`

## Коллекции

### `geometry_topics`

| Поле | Тип | Обязательное | Примечание |
|---|---|---|---|
| `id` | `text` | да | PK |
| `title` | `text` | нет | Название темы |
| `order` | `number` | нет | Порядок сортировки |
| `created` | `autodate` | системное |  |
| `updated` | `autodate` | системное |  |

### `geometry_subtopics`

| Поле | Тип | Обязательное | Примечание |
|---|---|---|---|
| `id` | `text` | да | PK |
| `title` | `text` | нет | Название подтемы |
| `topic` | `relation -> geometry_topics` | да | `maxSelect=1` |
| `order` | `number` | нет | Порядок сортировки |
| `created` | `autodate` | системное |  |
| `updated` | `autodate` | системное |  |

### `geometry_tasks`

| Поле | Тип | Обязательное | Примечание |
|---|---|---|---|
| `id` | `text` | да | PK |
| `code` | `text` | да | Код задачи (например `GEO-022`) |
| `title` | `text` | нет | Короткий заголовок |
| `topic` | `relation -> geometry_topics` | нет | `maxSelect=1` |
| `subtopic` | `relation -> geometry_subtopics` | нет | `maxSelect=1` |
| `difficulty` | `number` | нет | Обычно `1..3` |
| `task_type` | `select` | нет | Значения: `ready`, `build`, `mixed` |
| `statement_md` | `text` | нет | Условие (Markdown + LaTeX) |
| `answer` | `text` | нет | Ответ |
| `solution_md` | `text` | нет | Решение |
| `geogebra_base64` | `text` | нет | Состояние `.ggb` для повторного редактирования |
| `geogebra_appname` | `select` | нет | `geometry`, `graphing`, `classic`, `3d` |
| `geogebra_image_base64` | `file` | нет | PNG-чертеж (storage), `maxSelect=1` |
| `drawing_view` | `select` | нет | `image` или `geogebra` |
| `preview_layout` | `json` | нет | Макет карточки (`print`, `student`) |
| `hints` | `json` | нет | Подсказки (часто `[]`) |
| `source` | `text` | нет | Источник |
| `year` | `number` | нет | Год |
| `created` | `autodate` | системное |  |
| `updated` | `autodate` | системное |  |

#### URL PNG файла

`{PB_URL}/api/files/geometry_tasks/{record_id}/{geogebra_image_base64}`

## Практические правила

- Для редактирования задачи всегда использовать полную запись (`getGeometryTask(id)`), а не урезанные поля списка.
- При сохранении:
  - PNG хранить в `geogebra_image_base64` как file upload.
  - GeoGebra-состояние хранить в `geogebra_base64`.
- Быстрый предпросмотр макета пишет в `preview_layout.print`.

## Проверка, что схема не “уплыла”

Минимальная проверка в production:

1. `geometry_tasks` содержит поля: `topic`, `subtopic`, `preview_layout`, `geogebra_image_base64`.
2. `topic/subtopic` имеют тип `relation`.
3. `geogebra_image_base64` имеет тип `file`.
4. `task_type` не блокирует сохранение пустым значением (required = false).

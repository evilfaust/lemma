---
name: Марафон — генератор
description: Новый раздел для подготовки и проведения устной защиты задач в классе (8 класс)
type: project
---

## Что такое «Марафон»

Формат урока: учитель подбирает задачи в порядке возрастания сложности. У каждого ученика всегда 2 карточки на выбор. Задачу нужно защитить устно у учителя в коридоре. При провале — попытка (максимум 3 попытки). После 3 провалов карточка остаётся, выбор сужается до 1 задачи.

## Компоненты (добавлены 2026-04-06)

- `components/MarathonGenerator.jsx` — главный (4 вкладки: Настройка, Карточки, Лист учителя, Рейтинг)
- `components/MarathonGenerator.css` — стили + print CSS
- `components/marathon/MarathonCardsPrint.jsx` — A6 карточки (4 на A4)
- `components/marathon/MarathonTeacherSheet.jsx` — компактная таблица с ответами/решениями
- `components/marathon/MarathonRatingPrint.jsx` — бумажный бланк рейтинга
- `components/marathon/MarathonTracker.jsx` — цифровой трекер прогресса
- `hooks/useMarathon.js` — состояние: задачи, ученики, tracking_data, save/load/delete

## БД

Коллекция `marathons` (Superuser only):
- `title` (text), `class_number` (number)
- `tasks` (relation→tasks, multi), `task_order` (json: [taskId,...])
- `students` (json: [name,...])
- `tracking_data` (json: `{studentName: {taskIndex: {attempts, solved, failed}}}`)
- Миграция: `pocketbase/pb_migrations/1772000014_create_marathons.js` — применена на VPS

## 5 API методов в pocketbase.js
getMarathons, getMarathon, createMarathon, updateMarathon, deleteMarathon

## Печать

Три режима — `printMode` state (`'cards' | 'teacher' | 'rating'`).
При установке `printMode` → `useEffect` инжектирует `@page { size: A4 portrait; margin: 0; }` → через 100ms вызывает `window.print()` → через 1500ms сбрасывает `printMode`.
Только один блок монтируется в DOM одновременно → нет конфликтов при печати.

**Why:** Пользователь хочет инструмент для проведения марафонов (нетипичный формат урока).
**How to apply:** При доработке марафона учитывать, что задачи берутся из основной БД задач и не дублируются.

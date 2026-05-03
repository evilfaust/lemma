---
name: Маршрутный лист
description: Архитектура и особенности компонента RouteSheetGenerator и его печатного вида
type: project
originSessionId: a3dbb96a-7e73-4831-b36a-5c342166b04e
---
AI-генерация цепочек через `/generate-chain` (Pi); редизайн на TrigGeneratorLayout; миграции 1772000025/1772000026.

**Печатный вид (v3.9.17)**: полный редизайн — убраны рамки и стрелочки между задачами. Задачи идут нумерованным списком с тонким разделителем. Плейсхолдеры `[①]` в условиях рендерятся бледно-серыми (ученик видит, что сюда нужно подставить ответ предыдущей задачи, и может вписать число поверх). Добавлена инструкция для ученика двумя предложениями под шапкой.

**RouteStatementRenderer** (`route-sheet/RouteStatementRenderer.jsx`): кастомный рендерер вместо MathRenderer. Разбивает строку на токены через SPLIT_RE, рендерит LaTeX через `katex.renderToString` напрямую. Плейсхолдеры внутри LaTeX заменяются до рендеринга: `[①]` → `\textcolor{#c0c0c0}{\text{①}}`. Требует `trust: true` в katex-опциях.

**Why:** rehype-raw не установлен, поэтому HTML в ReactMarkdown не работает. Кастомный рендерер — единственный чистый способ стилизовать плейсхолдеры внутри LaTeX-формул.

**How to apply:** при необходимости стилизовать части LaTeX-строки — делать предобработку tex перед `katex.renderToString`, а не пытаться добавлять HTML-ноды через remark/rehype.

**fix PocketBase single-expand quirk**: в loadFromSaved нормализовать expand-поля: `const raw = item.expand?.field; const arr = Array.isArray(raw) ? raw : raw ? [raw] : [];`

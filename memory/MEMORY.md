# Memory — EGE Tasks Manager

## 🚨 КРИТИЧЕСКОЕ ПРАВИЛО БД 🚨
**НИКОГДА не удалять/перезаписывать БД без бэкапа!**
`./backup.sh` → проверить дату → спросить пользователя.
Катастрофа 12.02.2026: потеряно ~1000 задач. Команда-убийца: `rm -rf pocketbase/pb_data && tar -xzf old_backup`.

## Index

### Feedback
- [Не запускать dev-сервер](feedback_no_dev_server.md) — после правок только `npm run build`
- [Верификация — только сборка](feedback_verification.md) — не использовать preview_start

### Project
- [Project Facts & Architecture](project_facts.md) — факты, компонентов, архитектурные точки, рефакторинги
- [Features History](features_history.md) — детали фич по версиям: QR, пиксель-арт, ТДФ, ЕГЭ-КИМ, тригонометрия, марафон, AI-define, GeoGebra, ачивки, производительность
- [MC Tests v3.9.9](project_mc_tests.md) — генератор тестов A/B/C/D, `work_sessions.mc_test`, `work` optional
- [Trig MC Tests v3.9.12](trig_mc_tests.md) — MC-тесты из тригогенераторов; `work_sessions.trig_mc_test` (миграция 1772000021)
- [exam_type в topics v3.9.14](project_exam_type.md) — архитектура контекстов задач; 7 тригонометрических тем; exam_part
- [Маршрутный лист v3.9.17](route_sheet.md) — RouteStatementRenderer, плейсхолдеры [①] через \textcolor; миграции 1772000025/26
- [Мобильная навигация v3.9.15](mobile_nav.md) — Grid.useBreakpoint() + Drawer вместо Sider; isDesktop = !!screens.lg
- [Ollama/AI Define](project_ollama_define.md) — Timeweb AI Gateway (deepseek), порт 11435, nginx /define

---
name: Мобильная навигация (v3.9.15)
description: Замена Sider на Drawer для мобильных/iPad — паттерн и причина
type: project
originSessionId: 5c0dcb24-e2eb-4e23-a8ea-b1b672de9d7a
---
**Проблема:** `<Sider breakpoint="lg" collapsedWidth="0">` полностью скрывает меню на мобильном/планшете без возможности открыть. Пользователь не может видеть навигацию.

**Решение:** Заменено на `Grid.useBreakpoint()` + условный рендер:
- `isDesktop = !!screens.lg` (≥992px)
- На десктопе: `<Sider>` (обычный)
- На мобильном/планшете: `<Drawer placement="left">` + кнопка `<MenuOutlined>` в хедере
- Клик по пункту меню закрывает Drawer: `setDrawerOpen(false)` в общем `handleMenuClick`

**Why:** Ant Design Sider с collapsedWidth=0 скрывает меню без возможности открыть на мобильном. Drawer — стандартный UX-паттерн для мобильной навигации.

**How to apply:** При добавлении новых пунктов меню в App.jsx — обновлять оба места (Sider и Drawer items, они используют общий массив menuItems).

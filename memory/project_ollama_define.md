---
name: AI Define Service (Ollama/Timeweb)
description: AI-определения для шифровок — используется Timeweb AI Gateway вместо Ollama
type: project
originSessionId: 5c0dcb24-e2eb-4e23-a8ea-b1b672de9d7a
---
AI-генерация определений в CryptogramGenerator.

**Провайдер:** Timeweb AI Gateway (deepseek/deepseek-v4-flash), ~3-4 сек на ответ.

**Инфраструктура:**
- Wrapper systemd-сервис на порту 11435
- nginx проксирует `/define` → `172.18.0.1:11435`
- Ollama удалена с Pi, сервис полностью на VPS

**Why:** Ollama требует слишком много RAM на Raspberry Pi. Timeweb AI Gateway даёт стабильный результат без локального GPU.

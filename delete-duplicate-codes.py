"""
Скрипт для удаления всех задач с указанным кодом (по умолчанию 30-501).
Использование: python3 delete-duplicate-codes.py [код]
Пример: python3 delete-duplicate-codes.py 30-501
"""

import sys
import requests

PB_URL = "http://127.0.0.1:8090"
ADMIN_EMAIL = "oleg.faust@gmail.com"
ADMIN_PASSWORD = "Zasadazxasqw12#"

# Код для удаления
CODE_TO_DELETE = sys.argv[1] if len(sys.argv) > 1 else "30-501"

# Авторизация
resp = requests.post(
    f"{PB_URL}/api/collections/_superusers/auth-with-password",
    json={"identity": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
)
resp.raise_for_status()
TOKEN = resp.json()["token"]
HEADERS = {"Authorization": f"Bearer {TOKEN}"}
print("✅ Авторизация прошла успешно")

# Ищем все задачи с указанным кодом
print(f"\n🔍 Ищу задачи с кодом '{CODE_TO_DELETE}'...")

resp = requests.get(
    f"{PB_URL}/api/collections/tasks/records",
    headers=HEADERS,
    params={
        "filter": f'code = "{CODE_TO_DELETE}"',
        "perPage": 500,
        "fields": "id,code,statement_md"
    }
)
resp.raise_for_status()
items = resp.json().get("items", [])

if not items:
    print(f"✅ Задачи с кодом '{CODE_TO_DELETE}' не найдены. Нечего удалять.")
    sys.exit(0)

print(f"📋 Найдено задач: {len(items)}")
for i, item in enumerate(items, 1):
    preview = item.get("statement_md", "")[:60].replace("\n", " ")
    print(f"   {i}. [{item['id']}] {preview}...")

# Подтверждение
confirm = input(f"\n⚠️  Удалить {len(items)} задач с кодом '{CODE_TO_DELETE}'? (y/n): ").strip().lower()
if confirm != 'y':
    print("❌ Отменено.")
    sys.exit(0)

# Удаление
deleted = 0
errors = 0
for item in items:
    try:
        r = requests.delete(
            f"{PB_URL}/api/collections/tasks/records/{item['id']}",
            headers=HEADERS
        )
        if r.status_code == 204:
            deleted += 1
            print(f"   🗑️  Удалена задача {item['id']}")
        else:
            errors += 1
            print(f"   ❌ Ошибка при удалении {item['id']}: {r.status_code}")
    except Exception as e:
        errors += 1
        print(f"   ❌ Исключение при удалении {item['id']}: {e}")

print(f"\n📊 Итого: удалено {deleted}, ошибок {errors}")

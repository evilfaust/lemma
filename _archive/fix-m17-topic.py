"""
Скрипт для переноса задач из ошибочного топика «Мордкович §17» (slug M17)
в существующий топик «Мордкович» (slug M43).

Шаги:
1. Создать подтему «Логарифмические уравнения» в правильном топике
2. Перенести все задачи: сменить topic и subtopic
3. Удалить ошибочную подтему
4. Удалить ошибочный топик
"""

import requests
import sys

PB_URL = "http://127.0.0.1:8090"
ADMIN_EMAIL = "oleg.faust@gmail.com"
ADMIN_PASSWORD = "Zasadazxasqw12#"

# ID из базы
WRONG_TOPIC_ID = "3u45hqyqcrtbawi"      # Мордкович §17 (ошибочный)
RIGHT_TOPIC_ID = "hqgrbhacxaglhx9"      # Мордкович (правильный)
WRONG_SUBTOPIC_ID = "yr14o9p89c72y28"    # Логарифмические уравнения (в ошибочном топике)

# Авторизация
resp = requests.post(
    f"{PB_URL}/api/collections/_superusers/auth-with-password",
    json={"identity": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
)
resp.raise_for_status()
TOKEN = resp.json()["token"]
HEADERS = {"Authorization": f"Bearer {TOKEN}"}
print("✅ Авторизация прошла успешно")

# 1. Создаём подтему «Логарифмические уравнения» в правильном топике
print("\n📝 Создаю подтему «Логарифмические уравнения» в топике «Мордкович»...")

# Проверяем, не существует ли уже
resp = requests.get(
    f"{PB_URL}/api/collections/subtopics/records",
    headers=HEADERS,
    params={"filter": f'name = "Логарифмические уравнения" && topic = "{RIGHT_TOPIC_ID}"', "perPage": 1}
)
resp.raise_for_status()
items = resp.json().get("items", [])

if items:
    new_subtopic_id = items[0]["id"]
    print(f"   ✓ Подтема уже существует: {new_subtopic_id}")
else:
    resp = requests.post(
        f"{PB_URL}/api/collections/subtopics/records",
        headers=HEADERS,
        json={"name": "Логарифмические уравнения", "topic": RIGHT_TOPIC_ID, "order": 0}
    )
    if resp.status_code == 200:
        new_subtopic_id = resp.json()["id"]
        print(f"   ✓ Создана подтема: {new_subtopic_id}")
    else:
        print(f"   ❌ Ошибка: {resp.text}")
        sys.exit(1)

# 2. Получаем все задачи из ошибочного топика
print(f"\n📋 Получаю задачи из ошибочного топика...")
all_tasks = []
page = 1
while True:
    resp = requests.get(
        f"{PB_URL}/api/collections/tasks/records",
        headers=HEADERS,
        params={"filter": f'topic = "{WRONG_TOPIC_ID}"', "perPage": 200, "page": page}
    )
    resp.raise_for_status()
    data = resp.json()
    all_tasks.extend(data["items"])
    if len(all_tasks) >= data["totalItems"]:
        break
    page += 1

print(f"   Найдено задач: {len(all_tasks)}")

# 3. Переносим задачи
print(f"\n📤 Переношу задачи в топик «Мордкович» с подтемой «Логарифмические уравнения»...")
success = 0
errors = 0

for task in all_tasks:
    resp = requests.patch(
        f"{PB_URL}/api/collections/tasks/records/{task['id']}",
        headers=HEADERS,
        json={
            "topic": RIGHT_TOPIC_ID,
            "subtopic": [new_subtopic_id]
        }
    )
    if resp.status_code == 200:
        success += 1
    else:
        print(f"   ❌ Ошибка при переносе {task.get('code', '?')}: {resp.text}")
        errors += 1

print(f"   ✅ Перенесено: {success}")
if errors:
    print(f"   ❌ Ошибок: {errors}")

# 4. Удаляем ошибочную подтему
print(f"\n🗑️  Удаляю ошибочную подтему «Логарифмические уравнения» (ID: {WRONG_SUBTOPIC_ID})...")
resp = requests.delete(
    f"{PB_URL}/api/collections/subtopics/records/{WRONG_SUBTOPIC_ID}",
    headers=HEADERS
)
if resp.status_code == 204:
    print("   ✓ Подтема удалена")
else:
    print(f"   ⚠️ Статус: {resp.status_code} {resp.text}")

# 5. Удаляем ошибочный топик
print(f"\n🗑️  Удаляю ошибочный топик «Мордкович §17» (ID: {WRONG_TOPIC_ID})...")
resp = requests.delete(
    f"{PB_URL}/api/collections/topics/records/{WRONG_TOPIC_ID}",
    headers=HEADERS
)
if resp.status_code == 204:
    print("   ✓ Топик удалён")
else:
    print(f"   ⚠️ Статус: {resp.status_code} {resp.text}")

# 6. Итог
print(f"\n{'='*50}")
print(f"📊 ИТОГ:")
print(f"   ✅ Задач перенесено: {success}")
print(f"   📁 Новый топик: Мордкович ({RIGHT_TOPIC_ID})")
print(f"   📂 Подтема: Логарифмические уравнения ({new_subtopic_id})")
print(f"   🗑️  Удалён топик: Мордкович §17")

"""
Скрипт для замены тега "6кл" на "7кл" во всех задачах.
Использование: python3 fix-tag-6kl-to-7kl.py
"""

import requests

PB_URL = "http://127.0.0.1:8090"
ADMIN_EMAIL = "oleg.faust@gmail.com"
ADMIN_PASSWORD = "Zasadazxasqw12#"

# Авторизация
resp = requests.post(
    f"{PB_URL}/api/collections/_superusers/auth-with-password",
    json={"identity": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
)
resp.raise_for_status()
TOKEN = resp.json()["token"]
HEADERS = {"Authorization": f"Bearer {TOKEN}"}
print("✅ Авторизация прошла успешно")

# Находим ID тега "6кл"
resp = requests.get(
    f"{PB_URL}/api/collections/tags/records",
    headers=HEADERS,
    params={"filter": 'title = "6кл"', "perPage": 1}
)
resp.raise_for_status()
items_6 = resp.json().get("items", [])

if not items_6:
    print("❌ Тег '6кл' не найден в базе")
    exit(1)

tag_6kl_id = items_6[0]["id"]
print(f"🏷️  Тег '6кл': {tag_6kl_id}")

# Находим или создаём тег "7кл"
resp = requests.get(
    f"{PB_URL}/api/collections/tags/records",
    headers=HEADERS,
    params={"filter": 'title = "7кл"', "perPage": 1}
)
resp.raise_for_status()
items_7 = resp.json().get("items", [])

if items_7:
    tag_7kl_id = items_7[0]["id"]
    print(f"🏷️  Тег '7кл': {tag_7kl_id}")
else:
    # Создаём тег "7кл"
    resp = requests.post(
        f"{PB_URL}/api/collections/tags/records",
        headers=HEADERS,
        json={"title": "7кл", "color": "#45B7D1"}
    )
    resp.raise_for_status()
    tag_7kl_id = resp.json()["id"]
    print(f"🏷️  Создан тег '7кл': {tag_7kl_id}")

# Ищем все задачи с тегом "6кл" (постранично)
print(f"\n🔍 Ищу задачи с тегом '6кл'...")
all_tasks = []
page = 1
while True:
    resp = requests.get(
        f"{PB_URL}/api/collections/tasks/records",
        headers=HEADERS,
        params={
            "filter": f'tags ~ "{tag_6kl_id}"',
            "perPage": 500,
            "page": page,
            "fields": "id,code,tags"
        }
    )
    resp.raise_for_status()
    data = resp.json()
    all_tasks.extend(data.get("items", []))
    if page >= data.get("totalPages", 1):
        break
    page += 1

if not all_tasks:
    print("✅ Задачи с тегом '6кл' не найдены. Нечего менять.")
    exit(0)

print(f"📋 Найдено задач с тегом '6кл': {len(all_tasks)}")

# Заменяем тег
updated = 0
errors = 0
for task in all_tasks:
    task_id = task["id"]
    tags = task.get("tags", [])

    # Убираем "6кл", добавляем "7кл" (если ещё нет)
    new_tags = [t for t in tags if t != tag_6kl_id]
    if tag_7kl_id not in new_tags:
        new_tags.append(tag_7kl_id)

    try:
        r = requests.patch(
            f"{PB_URL}/api/collections/tasks/records/{task_id}",
            headers=HEADERS,
            json={"tags": new_tags}
        )
        if r.status_code == 200:
            updated += 1
            print(f"   ✅ {task.get('code', task_id)}: тег заменён")
        else:
            errors += 1
            print(f"   ❌ {task.get('code', task_id)}: ошибка {r.status_code} — {r.text}")
    except Exception as e:
        errors += 1
        print(f"   ❌ {task.get('code', task_id)}: {e}")

print(f"\n📊 Итого: обновлено {updated}, ошибок {errors}")

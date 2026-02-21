#!/usr/bin/env python3
"""
Скрипт для:
1. Замены тега "График" на "Графики" во всех задачах
2. Удаления тега "График"
3. Добавления цветов тегам без цвета
"""

import requests

# --------------------------
# Настройки
# --------------------------
PB_URL = "http://127.0.0.1:8090"
ADMIN_EMAIL = "oleg.faust@gmail.com"
ADMIN_PASSWORD = "Zasadazxasqw12#"

# Красивые цвета для тегов
TAG_COLORS = [
    "#FF6B6B",  # Коралловый
    "#4ECDC4",  # Бирюзовый
    "#45B7D1",  # Голубой
    "#96CEB4",  # Мятный
    "#FFEAA7",  # Лимонный
    "#DDA0DD",  # Сливовый
    "#98D8C8",  # Аквамарин
    "#F7DC6F",  # Золотой
    "#BB8FCE",  # Лавандовый
    "#85C1E2",  # Небесный
    "#F8B500",  # Янтарный
    "#52BE80",  # Изумрудный
    "#E74C3C",  # Красный
    "#3498DB",  # Синий
    "#9B59B6",  # Фиолетовый
    "#1ABC9C",  # Морской
    "#F39C12",  # Оранжевый
    "#E91E63",  # Розовый
    "#00BCD4",  # Циан
    "#8BC34A",  # Зелёный лайм
]

# --------------------------
# Авторизация
# --------------------------
def admin_login():
    resp = requests.post(
        f"{PB_URL}/api/collections/_superusers/auth-with-password",
        json={"identity": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    resp.raise_for_status()
    return resp.json()["token"]

print("🔐 Авторизация в PocketBase...")
TOKEN = admin_login()
HEADERS = {"Authorization": f"Bearer {TOKEN}"}
print("✅ Авторизация прошла успешно\n")

# --------------------------
# Шаг 1: Получаем все теги
# --------------------------
print("📦 Загружаю все теги...")
resp = requests.get(
    f"{PB_URL}/api/collections/tags/records",
    headers=HEADERS,
    params={"perPage": 500}
)
resp.raise_for_status()
all_tags = resp.json().get("items", [])
print(f"✓ Найдено тегов: {len(all_tags)}")

# Выводим все теги
print("\n📋 Список тегов:")
for tag in all_tags:
    print(f"   - '{tag['title']}' (id={tag['id']}, color={tag.get('color', 'нет')})")

# Находим теги "График" и "Графики" (с учётом регистра)
tag_график = None
tag_графики = None

for tag in all_tags:
    title_lower = tag["title"].lower()
    if title_lower == "график":
        tag_график = tag
    elif title_lower == "графики":
        tag_графики = tag

print(f"\n🔍 Тег 'График': {tag_график['id'] if tag_график else 'не найден'} ({tag_график['title'] if tag_график else ''})")
print(f"🔍 Тег 'Графики': {tag_графики['id'] if tag_графики else 'не найден'} ({tag_графики['title'] if tag_графики else ''})")

# --------------------------
# Шаг 2: Заменяем тег "График" на "Графики" в задачах
# --------------------------
if tag_график:
    print(f"\n🔄 Ищу задачи с тегом '{tag_график['title']}' (id={tag_график['id']})...")

    # Получаем все задачи с тегом "График"
    tasks_resp = requests.get(
        f"{PB_URL}/api/collections/tasks/records",
        headers=HEADERS,
        params={
            "perPage": 500,
            "filter": f'tags ~ "{tag_график["id"]}"'
        }
    )
    tasks_resp.raise_for_status()
    tasks_with_old_tag = tasks_resp.json().get("items", [])
    print(f"✓ Найдено задач с тегом '{tag_график['title']}': {len(tasks_with_old_tag)}")

    if tasks_with_old_tag:
        updated_count = 0
        for task in tasks_with_old_tag:
            task_tags = task.get("tags", []) or []

            # Убираем "График", добавляем "Графики" если его нет
            new_tags = [t for t in task_tags if t != tag_график["id"]]
            if tag_графики and tag_графики["id"] not in new_tags:
                new_tags.append(tag_графики["id"])

            # Обновляем задачу
            update_resp = requests.patch(
                f"{PB_URL}/api/collections/tasks/records/{task['id']}",
                headers=HEADERS,
                json={"tags": new_tags}
            )
            if update_resp.status_code == 200:
                updated_count += 1
                print(f"   ✅ Задача {task['id']}: тег заменён")
            else:
                print(f"   ❌ Задача {task['id']}: ошибка {update_resp.status_code}")

        print(f"\n✓ Обновлено задач: {updated_count}")

    # Удаляем тег "График"
    print(f"\n🗑️  Удаляю тег '{tag_график['title']}' (id={tag_график['id']})...")
    delete_resp = requests.delete(
        f"{PB_URL}/api/collections/tags/records/{tag_график['id']}",
        headers=HEADERS
    )
    if delete_resp.status_code == 204:
        print(f"✅ Тег '{tag_график['title']}' удалён")
    else:
        print(f"❌ Ошибка удаления: {delete_resp.status_code} - {delete_resp.text}")
else:
    print("\n⚠️  Тег 'График' не найден, пропускаю замену")

# --------------------------
# Итог
# --------------------------
print("\n" + "="*60)
print("📊 ГОТОВО!")
print("="*60)

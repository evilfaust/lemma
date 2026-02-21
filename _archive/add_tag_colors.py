#!/usr/bin/env python3
"""
Скрипт для добавления цветов тегам без цвета в PocketBase
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
# Получаем все теги
# --------------------------
print("📦 Загружаю все теги...")
resp = requests.get(
    f"{PB_URL}/api/collections/tags/records",
    headers=HEADERS,
    params={"perPage": 500}
)
resp.raise_for_status()
all_tags = resp.json().get("items", [])
print(f"✓ Найдено тегов: {len(all_tags)}\n")

# --------------------------
# Добавляем цвета
# --------------------------
print("🎨 Проверяю цвета тегов...")
print("="*60)

color_index = 0
tags_colored = 0

for tag in all_tags:
    tag_color = tag.get("color", "")

    # Проверяем, есть ли цвет (пустой, None или чёрный)
    if not tag_color or tag_color.strip() == "" or tag_color == "#000000":
        new_color = TAG_COLORS[color_index % len(TAG_COLORS)]
        color_index += 1

        # Обновляем цвет
        update_resp = requests.patch(
            f"{PB_URL}/api/collections/tags/records/{tag['id']}",
            headers=HEADERS,
            json={"color": new_color}
        )
        if update_resp.status_code == 200:
            tags_colored += 1
            print(f"   🎨 '{tag['title']}': добавлен цвет {new_color}")
        else:
            print(f"   ❌ '{tag['title']}': ошибка {update_resp.status_code}")
    else:
        print(f"   ✓ '{tag['title']}': уже есть цвет {tag_color}")

print("="*60)
print(f"\n📊 Итого:")
print(f"   ✓ Тегов с цветом: {len(all_tags) - tags_colored}")
print(f"   🎨 Добавлено цветов: {tags_colored}")

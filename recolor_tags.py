#!/usr/bin/env python3
"""
Перекрашивает все теги в PocketBase в разные цвета.
Цвета генерируются детерминированно по порядку названий.
"""

import colorsys
import requests

PB_URL = "http://127.0.0.1:8090"
ADMIN_EMAIL = "oleg.faust@gmail.com"
ADMIN_PASSWORD = "Zasadazxasqw12#"

# Базовая палитра (приятные тона)
BASE_COLORS = [
    "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7",
    "#DDA0DD", "#98D8C8", "#F7DC6F", "#BB8FCE", "#85C1E2",
    "#F8B500", "#52BE80", "#E74C3C", "#3498DB", "#9B59B6",
    "#1ABC9C", "#F39C12", "#E91E63", "#00BCD4", "#8BC34A",
    "#FF8A65", "#A1887F", "#90A4AE", "#9575CD",
]


def admin_login():
    resp = requests.post(
        f"{PB_URL}/api/collections/_superusers/auth-with-password",
        json={"identity": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    resp.raise_for_status()
    return resp.json()["token"]


def hsl_to_hex(h, s, l):
    r, g, b = colorsys.hls_to_rgb(h, l, s)
    return "#{:02X}{:02X}{:02X}".format(int(r * 255), int(g * 255), int(b * 255))


def generate_palette(n):
    colors = list(BASE_COLORS)
    if n <= len(colors):
        return colors[:n]

    # Генерируем дополнительные цвета в HSL
    remaining = n - len(colors)
    for i in range(remaining):
        # равномерно по кругу, сатурация/яркость фикс
        h = (i / max(1, remaining))
        colors.append(hsl_to_hex(h, 0.6, 0.55))
    return colors


print("🔐 Авторизация в PocketBase...")
TOKEN = admin_login()
HEADERS = {"Authorization": f"Bearer {TOKEN}"}
print("✅ Авторизация прошла успешно\n")

print("📦 Загружаю все теги...")
resp = requests.get(
    f"{PB_URL}/api/collections/tags/records",
    headers=HEADERS,
    params={"perPage": 500}
)
resp.raise_for_status()
all_tags = resp.json().get("items", [])
print(f"✓ Найдено тегов: {len(all_tags)}\n")

# Сортируем по названию для стабильности
all_tags.sort(key=lambda t: (t.get("title") or "").lower())

palette = generate_palette(len(all_tags))

print("🎨 Обновляю цвета тегов...")
print("=" * 60)

updated = 0
for tag, color in zip(all_tags, palette):
    update_resp = requests.patch(
        f"{PB_URL}/api/collections/tags/records/{tag['id']}",
        headers=HEADERS,
        json={"color": color}
    )
    if update_resp.status_code == 200:
        updated += 1
        print(f"   🎨 '{tag['title']}': {color}")
    else:
        print(f"   ❌ '{tag['title']}': ошибка {update_resp.status_code}")

print("=" * 60)
print(f"\n📊 Итого: обновлено {updated} тегов")

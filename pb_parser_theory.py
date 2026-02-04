import re
import os
import sys
import yaml
import requests
from pathlib import Path

# --------------------------
# Настройки
# --------------------------
PB_URL = "http://127.0.0.1:8090"
ADMIN_EMAIL = "oleg.faust@gmail.com"
ADMIN_PASSWORD = "Zasadazxasqw12#"
SOURCE_FOLDER = "source/theory"

# --------------------------
# 1. Авторизация
# --------------------------
def admin_login():
    resp = requests.post(
        f"{PB_URL}/api/collections/_superusers/auth-with-password",
        json={"identity": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    resp.raise_for_status()
    return resp.json()["token"]

# --------------------------
# 2. Работа с категориями
# --------------------------
def get_or_create_category(title, headers):
    """Найти категорию по названию или создать новую"""
    # Поиск существующей
    resp = requests.get(
        f"{PB_URL}/api/collections/theory_categories/records",
        headers=headers,
        params={"filter": f'title = "{title}"', "perPage": 1}
    )
    resp.raise_for_status()
    items = resp.json().get("items", [])

    if items:
        print(f"  📂 Категория найдена: {title} (id: {items[0]['id']})")
        return items[0]["id"]

    # Создание новой
    colors = {
        "Алгебра": "#1890ff",
        "Геометрия": "#52c41a",
        "Тригонометрия": "#722ed1",
        "Теория вероятностей": "#fa8c16",
        "Математический анализ": "#eb2f96",
        "Комбинаторика": "#13c2c2",
    }

    resp = requests.post(
        f"{PB_URL}/api/collections/theory_categories/records",
        headers=headers,
        json={
            "title": title,
            "color": colors.get(title, "#1890ff"),
            "order": 0,
        }
    )
    resp.raise_for_status()
    new_id = resp.json()["id"]
    print(f"  📂 Категория создана: {title} (id: {new_id})")
    return new_id

# --------------------------
# 3. Проверка дубликатов
# --------------------------
def article_exists(title, headers):
    """Проверить, существует ли статья с таким названием"""
    resp = requests.get(
        f"{PB_URL}/api/collections/theory_articles/records",
        headers=headers,
        params={"filter": f'title = "{title}"', "perPage": 1}
    )
    resp.raise_for_status()
    items = resp.json().get("items", [])
    return len(items) > 0

# --------------------------
# 4. Парсинг YAML frontmatter
# --------------------------
def parse_frontmatter(content):
    """Парсить YAML frontmatter из markdown файла"""
    if content.startswith("---"):
        parts = content.split("---", 2)
        if len(parts) >= 3:
            try:
                meta = yaml.safe_load(parts[1])
                body = parts[2].strip()
                return meta or {}, body
            except yaml.YAMLError as e:
                print(f"  ⚠️ Ошибка YAML: {e}")

    # Fallback: извлекаем title из первого заголовка
    lines = content.strip().split("\n")
    title = "Без названия"
    for line in lines:
        if line.startswith("# "):
            title = line[2:].strip()
            break

    return {"title": title}, content

# --------------------------
# 5. Загрузка статьи
# --------------------------
def upload_article(meta, content, headers):
    """Загрузить статью в PocketBase"""
    title = meta.get("title", "Без названия")

    # Проверка дубликата
    if article_exists(title, headers):
        print(f"  ⏩ Пропуск (дубликат): {title}")
        return False

    # Получить/создать категорию
    category_name = meta.get("category", "Алгебра")
    category_id = get_or_create_category(category_name, headers)

    # Подготовка данных
    data = {
        "title": title,
        "content_md": content,
        "category": category_id,
        "order": meta.get("order", 0),
        "summary": meta.get("summary", ""),
        "tags": meta.get("tags", []),
    }

    resp = requests.post(
        f"{PB_URL}/api/collections/theory_articles/records",
        headers=headers,
        json=data
    )
    if resp.status_code != 200:
        print(f"  ❌ Ошибка {resp.status_code}: {resp.text}")
        return False
    article_id = resp.json()["id"]
    print(f"  ✅ Статья создана: {title} (id: {article_id})")
    return True

# --------------------------
# Main
# --------------------------
def main():
    # Определяем режим работы
    if len(sys.argv) >= 2:
        # Загрузка конкретного файла
        filename = sys.argv[1]
        if not filename.endswith('.md'):
            filename = f"{filename}.md"
        files = [os.path.join(SOURCE_FOLDER, filename)]
    else:
        # Загрузка всех .md файлов из source/theory/
        if not os.path.exists(SOURCE_FOLDER):
            print(f"❌ Папка не найдена: {SOURCE_FOLDER}")
            sys.exit(1)
        files = sorted([
            os.path.join(SOURCE_FOLDER, f)
            for f in os.listdir(SOURCE_FOLDER)
            if f.endswith('.md')
        ])

    if not files:
        print(f"❌ Нет .md файлов в {SOURCE_FOLDER}")
        sys.exit(1)

    # Авторизация
    print("🔐 Авторизация в PocketBase...")
    token = admin_login()
    headers = {"Authorization": f"Bearer {token}"}
    print("✅ Авторизация успешна\n")

    # Обработка файлов
    created = 0
    skipped = 0

    for filepath in files:
        if not os.path.exists(filepath):
            print(f"❌ Файл не найден: {filepath}")
            continue

        print(f"📄 Обработка: {filepath}")

        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()

        meta, body = parse_frontmatter(content)

        if upload_article(meta, body, headers):
            created += 1
        else:
            skipped += 1

    print(f"\n📊 Итого: создано {created}, пропущено {skipped}")

if __name__ == "__main__":
    main()

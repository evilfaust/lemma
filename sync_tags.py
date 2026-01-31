#!/usr/bin/env python3
"""
Скрипт для синхронизации тегов из MD-файлов с базой данных PocketBase.
Находит задачи по statement_md и добавляет недостающие теги.
"""

import re
import os
import sys
import yaml
import requests
from collections import defaultdict

# --------------------------
# Настройки
# --------------------------
PB_URL = "http://127.0.0.1:8090"
ADMIN_EMAIL = "oleg.faust@gmail.com"
ADMIN_PASSWORD = "Zasadazxasqw12#"
SOURCE_FOLDER = "source"

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
try:
    TOKEN = admin_login()
    HEADERS = {"Authorization": f"Bearer {TOKEN}"}
    print("✅ Авторизация прошла успешно\n")
except Exception as e:
    print(f"❌ Ошибка авторизации: {e}")
    print("   Убедитесь, что PocketBase запущен: cd pocketbase && ./pocketbase serve")
    sys.exit(1)

# --------------------------
# Кэш тегов
# --------------------------
tags_cache = {}  # title -> id

def get_all_tags():
    """Загружает все теги из базы в кэш."""
    global tags_cache
    resp = requests.get(
        f"{PB_URL}/api/collections/tags/records",
        headers=HEADERS,
        params={"perPage": 500}
    )
    resp.raise_for_status()
    for tag in resp.json().get("items", []):
        tags_cache[tag["title"]] = tag["id"]
    print(f"📦 Загружено {len(tags_cache)} тегов из базы")

def get_or_create_tag(tag_title: str):
    """Получает ID тега или создаёт новый."""
    tag_title = tag_title.strip()
    if not tag_title:
        return None

    # Проверяем кэш
    if tag_title in tags_cache:
        return tags_cache[tag_title]

    # Создаём новый тег
    import random
    colors = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#FFA07A", "#98D8C8",
              "#F7DC6F", "#BB8FCE", "#85C1E2", "#F8B500", "#52BE80"]

    resp = requests.post(
        f"{PB_URL}/api/collections/tags/records",
        headers=HEADERS,
        json={
            "title": tag_title,
            "color": random.choice(colors)
        }
    )

    if resp.status_code == 200:
        tag_id = resp.json()["id"]
        tags_cache[tag_title] = tag_id
        print(f"   ✨ Создан новый тег: {tag_title}")
        return tag_id
    else:
        print(f"   ⚠️ Не удалось создать тег '{tag_title}': {resp.text}")
        return None

def parse_tags(tags_input):
    """Парсит теги из строки или списка."""
    if not tags_input:
        return []

    if isinstance(tags_input, list):
        return [str(t).strip() for t in tags_input if str(t).strip()]

    if isinstance(tags_input, str):
        tags_input = tags_input.strip()
        if tags_input.startswith('[') and tags_input.endswith(']'):
            tags_input = tags_input[1:-1]
        return [t.strip() for t in tags_input.split(",") if t.strip()]

    return []

# --------------------------
# Парсинг MD файлов
# --------------------------
def parse_md_file(filepath):
    """Парсит MD файл и возвращает список задач с тегами."""
    with open(filepath, "r", encoding="utf-8") as f:
        md_text = f.read()

    tasks = []

    # Парсим YAML-блок для глобальных тегов
    yaml_block = re.search(r"^---\s*\n(.*?)\n---", md_text, re.DOTALL | re.MULTILINE)
    global_tags = []
    if yaml_block:
        try:
            metadata = yaml.safe_load(yaml_block.group(1))
            global_tags = parse_tags(metadata.get("tags", ""))
        except:
            pass

    # Убираем YAML блок и заголовки
    content = re.sub(r"^---\s*\n.*?\n---\s*\n", "", md_text, flags=re.DOTALL | re.MULTILINE)
    content = re.sub(r"^#.*$", "", content, flags=re.MULTILINE)
    content = re.sub(r"^###.*$", "", content, flags=re.MULTILINE)

    lines = content.split('\n')

    current_task_num = None
    current_statement = []
    current_tags = []
    in_statement = False

    for line in lines:
        line_stripped = line.strip()

        # Начало нового задания
        match = re.match(r'^\*\*(\d+)\*\*\s+\[(\d+)\]\s+(.*)$', line_stripped)
        if match:
            # Сохраняем предыдущее задание
            if current_task_num and current_statement:
                statement = "\n".join(current_statement).strip()
                all_tags = list(set(global_tags + current_tags))
                tasks.append({
                    "num": current_task_num,
                    "statement_md": statement,
                    "tags": all_tags
                })

            current_task_num = int(match.group(1))
            first_line = match.group(3).strip()

            # Убираем картинки из текста
            first_line = re.sub(r'!\[image\]\(https?://[^\)]+\)', '', first_line).strip()

            current_statement = [first_line] if first_line else []
            current_tags = []
            in_statement = True
            continue

        # Ответ - конец условия
        if line_stripped.startswith("ответ:"):
            in_statement = False
            continue

        # Теги задачи
        if line_stripped.startswith("tags:"):
            tags_str = line_stripped.replace("tags:", "").strip()
            current_tags = parse_tags(tags_str)
            continue

        # Собираем условие
        if in_statement and line_stripped:
            line_clean = re.sub(r'!\[image\]\(https?://[^\)]+\)', '', line_stripped).strip()
            if line_clean:
                current_statement.append(line_clean)

    # Сохраняем последнее задание
    if current_task_num and current_statement:
        statement = "\n".join(current_statement).strip()
        all_tags = list(set(global_tags + current_tags))
        tasks.append({
            "num": current_task_num,
            "statement_md": statement,
            "tags": all_tags
        })

    return tasks

# --------------------------
# Работа с базой данных
# --------------------------
def get_all_tasks_from_db():
    """Загружает все задачи из базы."""
    all_tasks = []
    page = 1
    per_page = 200

    while True:
        resp = requests.get(
            f"{PB_URL}/api/collections/tasks/records",
            headers=HEADERS,
            params={
                "perPage": per_page,
                "page": page,
                "fields": "id,statement_md,tags"
            }
        )
        resp.raise_for_status()
        data = resp.json()
        items = data.get("items", [])
        all_tasks.extend(items)

        if len(items) < per_page:
            break
        page += 1

    return all_tasks

def update_task_tags(task_id, new_tags):
    """Обновляет теги задачи."""
    resp = requests.patch(
        f"{PB_URL}/api/collections/tasks/records/{task_id}",
        headers=HEADERS,
        json={"tags": new_tags}
    )
    return resp.status_code == 200

# --------------------------
# Основная логика
# --------------------------
def main():
    # Определяем какие файлы обрабатывать
    if len(sys.argv) > 1:
        # Конкретные файлы из аргументов
        md_files = []
        for arg in sys.argv[1:]:
            if not arg.endswith('.md'):
                arg = f"{arg}.md"
            filepath = os.path.join(SOURCE_FOLDER, arg)
            if os.path.exists(filepath):
                md_files.append(filepath)
            else:
                print(f"⚠️ Файл не найден: {filepath}")
    else:
        # Все MD файлы в папке source
        md_files = [
            os.path.join(SOURCE_FOLDER, f)
            for f in os.listdir(SOURCE_FOLDER)
            if f.endswith('.md')
        ]

    if not md_files:
        print("❌ Нет файлов для обработки")
        sys.exit(1)

    print(f"📁 Файлов для обработки: {len(md_files)}")
    for f in md_files:
        print(f"   - {os.path.basename(f)}")

    # Загружаем теги
    print("\n" + "="*60)
    get_all_tags()

    # Парсим все MD файлы
    print("\n📝 Парсинг MD файлов...")
    all_md_tasks = []
    for filepath in md_files:
        filename = os.path.basename(filepath)
        tasks = parse_md_file(filepath)
        print(f"   {filename}: {len(tasks)} задач")
        all_md_tasks.extend(tasks)

    print(f"\n✓ Всего задач в MD файлах: {len(all_md_tasks)}")

    # Создаём индекс по statement_md
    md_index = {}
    for task in all_md_tasks:
        # Нормализуем statement для сравнения
        normalized = task["statement_md"].strip()
        if normalized:
            md_index[normalized] = task["tags"]

    # Загружаем задачи из базы
    print("\n📦 Загрузка задач из базы данных...")
    db_tasks = get_all_tasks_from_db()
    print(f"✓ Загружено задач из базы: {len(db_tasks)}")

    # Сопоставляем и обновляем
    print("\n🔄 Синхронизация тегов...")
    print("="*60)

    updated_count = 0
    matched_count = 0
    not_found_count = 0

    for db_task in db_tasks:
        db_statement = db_task.get("statement_md", "").strip()
        db_tags = db_task.get("tags", []) or []
        task_id = db_task["id"]

        if not db_statement:
            continue

        # Ищем в MD индексе
        if db_statement in md_index:
            matched_count += 1
            md_tag_titles = md_index[db_statement]

            # Получаем ID тегов из MD
            md_tag_ids = []
            for tag_title in md_tag_titles:
                tag_id = get_or_create_tag(tag_title)
                if tag_id:
                    md_tag_ids.append(tag_id)

            # Проверяем, нужно ли обновление
            current_tags_set = set(db_tags)
            new_tags_set = set(md_tag_ids)

            # Добавляем недостающие теги (не заменяем, а дополняем)
            combined_tags = list(current_tags_set | new_tags_set)

            if len(combined_tags) > len(db_tags):
                # Есть недостающие теги
                added_count = len(combined_tags) - len(db_tags)
                if update_task_tags(task_id, combined_tags):
                    updated_count += 1
                    # Находим названия добавленных тегов
                    added_tag_ids = new_tags_set - current_tags_set
                    added_names = [k for k, v in tags_cache.items() if v in added_tag_ids]
                    print(f"✅ {task_id}: +{added_count} тегов ({', '.join(added_names)})")

    print("\n" + "="*60)
    print(f"📊 ИТОГОВАЯ СТАТИСТИКА:")
    print(f"   🔗 Сопоставлено задач: {matched_count}")
    print(f"   ✅ Обновлено задач: {updated_count}")
    print(f"   📦 Всего в базе: {len(db_tasks)}")
    print("="*60)

if __name__ == "__main__":
    main()

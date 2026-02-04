import re
import os
import sys
import yaml
import requests

# --------------------------
# Настройки
# --------------------------
PB_URL = "http://127.0.0.1:8090"
ADMIN_EMAIL = "oleg.faust@gmail.com"
ADMIN_PASSWORD = "Zasadazxasqw12#"
COLLECTION_NAME = "tasks"
SOURCE_FOLDER = "source/mordkovich"

# Получаем имя файла из аргументов (например: M43)
if len(sys.argv) < 2:
    print("❌ Использование: python3 pb_parser_mordkovich.py <имя_файла>")
    print("   Пример: python3 pb_parser_mordkovich.py M43")
    sys.exit(1)

file_arg = sys.argv[1]
# Убираем .md если пользователь его добавил
if file_arg.endswith('.md'):
    file_arg = file_arg[:-3]

filename = f"{file_arg}.md"
MD_FILE = os.path.join(SOURCE_FOLDER, filename)

# Извлекаем номер параграфа из имени файла (M43 -> 43)
paragraph_match = re.match(r'M?(\d+)', file_arg)
if not paragraph_match:
    print(f"❌ Не удалось извлечь номер параграфа из: {file_arg}")
    sys.exit(1)
paragraph_num = paragraph_match.group(1)

# Проверяем существование файла
if not os.path.exists(MD_FILE):
    print(f"❌ Файл не найден: {MD_FILE}")
    print(f"\n📁 Доступные файлы в папке {SOURCE_FOLDER}:")
    if os.path.exists(SOURCE_FOLDER):
        for f in sorted(os.listdir(SOURCE_FOLDER)):
            if f.endswith('.md'):
                print(f"   - {f}")
    sys.exit(1)

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

TOKEN = admin_login()
HEADERS = {"Authorization": f"Bearer {TOKEN}"}
print("✅ Авторизация прошла успешно")

# --------------------------
# Работа с тегами
# --------------------------
def get_or_create_tag(tag_title: str):
    """Получает или создает тег по названию"""
    tag_title = tag_title.strip()
    if not tag_title:
        return None

    try:
        resp = requests.get(
            f"{PB_URL}/api/collections/tags/records",
            headers=HEADERS,
            params={"filter": f'title = "{tag_title}"', "perPage": 1}
        )
        resp.raise_for_status()
        items = resp.json().get("items", [])

        if items:
            return items[0]["id"]

        import random
        colors = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#FFA07A", "#98D8C8",
                  "#F7DC6F", "#BB8FCE", "#85C1E2", "#F8B500", "#52BE80"]

        create_resp = requests.post(
            f"{PB_URL}/api/collections/tags/records",
            headers=HEADERS,
            json={"title": tag_title, "color": random.choice(colors)}
        )

        if create_resp.status_code == 200:
            tag_id = create_resp.json()["id"]
            print(f"   ✓ Создан новый тег: {tag_title}")
            return tag_id

    except Exception as e:
        print(f"   ⚠️ Ошибка при работе с тегом '{tag_title}': {e}")
        return None

def get_or_create_tags(tags_list):
    """Получает или создает теги по списку"""
    if not tags_list:
        return []

    # Если передана строка, разбиваем по запятой
    if isinstance(tags_list, str):
        tags_list = [t.strip() for t in tags_list.split(",") if t.strip()]

    tag_ids = []
    for tag_title in tags_list:
        tag_id = get_or_create_tag(tag_title)
        if tag_id:
            tag_ids.append(tag_id)

    return tag_ids

# --------------------------
# Работа с подтемами (subtopics)
# --------------------------
def get_or_create_subtopic(subtopic_name: str, topic_id: str):
    """Получает или создает подтему по названию"""
    if not subtopic_name or not subtopic_name.strip():
        return None

    subtopic_name = subtopic_name.strip()

    try:
        # Ищем существующую подтему для данного топика
        resp = requests.get(
            f"{PB_URL}/api/collections/subtopics/records",
            headers=HEADERS,
            params={"filter": f'name = "{subtopic_name}" && topic = "{topic_id}"', "perPage": 1}
        )
        resp.raise_for_status()
        items = resp.json().get("items", [])

        if items:
            print(f"✓ Подтема уже существует: {subtopic_name}")
            return items[0]["id"]

        # Создаём новую подтему
        create_resp = requests.post(
            f"{PB_URL}/api/collections/subtopics/records",
            headers=HEADERS,
            json={"name": subtopic_name, "topic": topic_id, "order": 0}
        )

        if create_resp.status_code == 200:
            subtopic_id = create_resp.json()["id"]
            print(f"   ✓ Создана новая подтема: {subtopic_name}")
            return subtopic_id
        else:
            print(f"   ⚠️ Ошибка создания подтемы: {create_resp.text}")
            return None

    except Exception as e:
        print(f"   ⚠️ Ошибка при работе с подтемой '{subtopic_name}': {e}")
        return None

# --------------------------
# Получение/создание топика
# --------------------------
def get_or_create_topic(paragraph_num: str, title: str, description: str = ""):
    """Получает или создает топик для параграфа Мордковича.

    Все задачи Мордковича загружаются в ЕДИНЫЙ топик «Мордкович».
    Разделение по параграфам — через подтемы (subtopics).

    Поиск по приоритету:
    1. По названию из YAML (title) — например, «Мордкович»
    2. По slug M{paragraph} — для обратной совместимости
    3. Создание нового топика, если ничего не найдено
    """
    # 1. Ищем существующий топик по названию из YAML
    resp = requests.get(
        f"{PB_URL}/api/collections/topics/records",
        headers=HEADERS,
        params={"filter": f'title = "{title}"', "perPage": 1}
    )
    resp.raise_for_status()
    items = resp.json().get("items", [])

    if items:
        print(f"✓ Топик найден по названию: {items[0]['title']} (ID: {items[0]['id']})")
        return items[0]["id"]

    # 2. Ищем по slug «mordkovich» или «M{paragraph}» (обратная совместимость)
    for slug_candidate in ["mordkovich", f"M{paragraph_num}"]:
        resp = requests.get(
            f"{PB_URL}/api/collections/topics/records",
            headers=HEADERS,
            params={"filter": f'slug = "{slug_candidate}"', "perPage": 1}
        )
        resp.raise_for_status()
        items = resp.json().get("items", [])

        if items:
            print(f"✓ Топик найден по slug «{slug_candidate}»: {items[0]['title']} (ID: {items[0]['id']})")
            return items[0]["id"]

    # 3. Создаем новый топик
    print(f"🆕 Создаю новый топик «{title}»...")
    create_resp = requests.post(
        f"{PB_URL}/api/collections/topics/records",
        headers=HEADERS,
        json={
            "title": title,
            "slug": "mordkovich",
            "description": description or f"Задачник Мордкович"
        }
    )

    if create_resp.status_code == 200:
        topic_id = create_resp.json()["id"]
        print(f"✓ Создан новый топик: {title}")
        return topic_id
    else:
        raise Exception(f"Не удалось создать топик: {create_resp.text}")

# --------------------------
# Генерация кода задачи
# --------------------------
def generate_code(topic_id: str, paragraph_num: str):
    """Генерирует код задачи в формате M{параграф}-{номер}"""
    tasks_resp = requests.get(
        f"{PB_URL}/api/collections/tasks/records",
        headers=HEADERS,
        params={"filter": f'topic = "{topic_id}"', "fields": "code", "perPage": 500}
    )
    tasks_resp.raise_for_status()

    counters = []
    prefix = f"M{paragraph_num}-"

    for t in tasks_resp.json().get("items", []):
        code = t.get("code", "")
        if code.startswith(prefix):
            try:
                num = code.replace(prefix, "")
                counters.append(int(num))
            except:
                continue

    next_num = max(counters, default=0) + 1
    return f"{prefix}{str(next_num).zfill(3)}"

# --------------------------
# Парсинг MD файла
# --------------------------
print(f"\n📄 Читаю файл: {MD_FILE}")
with open(MD_FILE, "r", encoding="utf-8") as f:
    md_text = f.read()

# Парсим YAML-блок
yaml_block = re.search(r"^---\s*\n(.*?)\n---", md_text, re.DOTALL | re.MULTILINE)

if not yaml_block:
    print("❌ YAML-блок не найден!")
    sys.exit(1)

yaml_content = yaml_block.group(1)
metadata = yaml.safe_load(yaml_content)

print("\n📊 Метаданные из YAML:")
for key, value in metadata.items():
    print(f"   {key}: {value}")

topic_name = metadata.get("topic", "Мордкович")
subtopic_name = metadata.get("subtopic", "")
default_difficulty = str(metadata.get("difficulty", "1"))
source_prefix = metadata.get("source", "Мордкович")
year = metadata.get("year")
yaml_tags = metadata.get("tags", [])

# --------------------------
# Получаем/создаём топик и подтему
# --------------------------
TOPIC_ID = get_or_create_topic(paragraph_num, topic_name)
SUBTOPIC_ID = get_or_create_subtopic(subtopic_name, TOPIC_ID) if subtopic_name else None

# --------------------------
# Парсинг заданий в новом формате
# --------------------------
print(f"\n📝 Парсинг заданий...")

# Убираем YAML блок из текста
content_text = re.sub(r'^---\s*\n.*?\n---\s*\n', '', md_text, flags=re.DOTALL)

# Паттерн для парсинга заданий:
# **043.9a** [2]
# Условие задачи
# Ответ: ответ
# tags: [тег1, тег2, ...]
task_pattern = re.compile(
    r'\*\*(\d+)\.(\d+)([a-z]?)\*\*\s*(?:\[(\d+)\])?\s*\n'  # **043.9a** [2]
    r'(.*?)\n'                                              # Условие
    r'Ответ:\s*(.*?)\n'                                     # Ответ
    r'tags:\s*\[(.*?)\]',                                   # tags: [...]
    re.DOTALL
)

tasks = []
for match in task_pattern.finditer(content_text):
    paragraph_from_task = match.group(1)  # 043
    task_number = match.group(2)          # 9
    letter = match.group(3) or ''         # a, b, c, d или пусто
    difficulty = match.group(4)           # сложность из [2] или None
    statement = match.group(5).strip()    # условие
    answer = match.group(6).strip()       # ответ
    tags_str = match.group(7).strip()     # теги

    # Парсим теги
    task_tags = [t.strip() for t in tags_str.split(',') if t.strip()]

    # Формируем номер для source: 43.9 (без буквы, без ведущего нуля)
    clean_paragraph = paragraph_from_task.lstrip('0') or '0'
    source_task_num = f"{clean_paragraph}.{task_number}"

    # Полный номер задания для отображения
    full_task_name = f"{paragraph_from_task}.{task_number}{letter}"

    tasks.append({
        'full_name': full_task_name,
        'source_num': source_task_num,
        'statement': statement,
        'answer': answer,
        'difficulty': difficulty or default_difficulty,
        'tags': task_tags
    })

print(f"✓ Найдено заданий: {len(tasks)}")

if not tasks:
    print("❌ Задания не найдены! Проверьте формат файла.")
    sys.exit(1)

# --------------------------
# Проверка дубликатов
# --------------------------
print(f"\n🔍 Проверяю дубликаты в базе...")
existing_statements = set()
existing_tasks_resp = requests.get(
    f"{PB_URL}/api/collections/tasks/records",
    headers=HEADERS,
    params={"perPage": 1000, "filter": f'topic = "{TOPIC_ID}"', "fields": "statement_md"}
)
existing_tasks_resp.raise_for_status()

for t in existing_tasks_resp.json().get("items", []):
    existing_statements.add(t.get("statement_md", "").strip())

# --------------------------
# Загрузка в PocketBase
# --------------------------
print(f"\n📤 Начинаю загрузку задач...")
print("="*60)

added_count = 0
skipped_count = 0
error_count = 0

for task in tasks:
    if task['statement'] in existing_statements:
        print(f"⚠️  {task['full_name']}: пропущено (дубликат)")
        skipped_count += 1
        continue

    code = generate_code(TOPIC_ID, paragraph_num)

    # Формируем source: Мордкович+43.9
    task_source = f"{source_prefix}+{task['source_num']}"

    # Получаем ID тегов
    tag_ids = get_or_create_tags(task['tags'])

    record_data = {
        "code": code,
        "topic": TOPIC_ID,
        "difficulty": task['difficulty'],
        "statement_md": task['statement'],
        "answer": task['answer'],
        "source": task_source,
    }

    if SUBTOPIC_ID:
        record_data["subtopic"] = [SUBTOPIC_ID]

    if year:
        record_data["year"] = year

    if tag_ids:
        record_data["tags"] = tag_ids

    try:
        r = requests.post(
            f"{PB_URL}/api/collections/{COLLECTION_NAME}/records",
            headers=HEADERS,
            json=record_data
        )
        if r.status_code == 200:
            print(f"✅ {task['full_name']}: добавлено ({code}), сложность: {task['difficulty']}, source: {task_source}")
            added_count += 1
        else:
            print(f"❌ {task['full_name']}: ошибка {r.status_code} - {r.text}")
            error_count += 1
    except Exception as e:
        print(f"❌ {task['full_name']}: исключение - {e}")
        error_count += 1

print("\n" + "="*60)
print(f"📊 ИТОГОВАЯ СТАТИСТИКА:")
print(f"   ✅ Добавлено: {added_count}")
print(f"   ⚠️  Пропущено: {skipped_count}")
print(f"   ❌ Ошибки: {error_count}")

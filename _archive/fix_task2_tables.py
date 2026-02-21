#!/usr/bin/env python3
"""
Исправляет задачи с кодом 2-xxx: заменяет блоки
"ВЕЛИЧИНЫ" / "ВОЗМОЖНЫЕ ЗНАЧЕНИЯ" на Markdown-таблицу.
Обрабатывает только tasks.code начинающиеся с "2-".
"""

import re
import requests

PB_URL = "http://127.0.0.1:8090"
ADMIN_EMAIL = "oleg.faust@gmail.com"
ADMIN_PASSWORD = "Zasadazxasqw12#"

MARKER_LEFT = re.compile(r"ВЕЛИЧИНЫ", re.IGNORECASE)
MARKER_RIGHT = re.compile(r"ВОЗМОЖНЫЕ\s+ЗНАЧЕНИЯ", re.IGNORECASE)

# A) Б) В) Г) ... (кириллица/латиница)
LEFT_ITEM = re.compile(r"([А-ЯA-Z])\)\s*(.*?)(?=(?:[А-ЯA-Z]\)|ВОЗМОЖНЫЕ\s+ЗНАЧЕНИЯ|$))", re.IGNORECASE | re.DOTALL)
# 1) 2) 3) ...
RIGHT_ITEM = re.compile(r"(\d+)\)\s*(.*?)(?=(?:\d+\)|$))", re.IGNORECASE | re.DOTALL)


def admin_login():
    resp = requests.post(
        f"{PB_URL}/api/collections/_superusers/auth-with-password",
        json={"identity": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    resp.raise_for_status()
    return resp.json()["token"]


def normalize_space(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def clean_invisible(text: str) -> str:
    if not text:
        return ""
    # Убираем мягкие переносы и неразрывные пробелы
    return text.replace("\u00ad", "").replace("\u00a0", " ")


def build_table(left_items, right_items):
    # Максимум по длине
    max_len = max(len(left_items), len(right_items))
    rows = []
    for i in range(max_len):
        left = left_items[i] if i < len(left_items) else ""
        right = right_items[i] if i < len(right_items) else ""
        rows.append((left, right))
    lines = [
        "| ВЕЛИЧИНЫ | ВОЗМОЖНЫЕ ЗНАЧЕНИЯ |",
        "|---|---|",
    ]
    for left, right in rows:
        lines.append(f"| {left} | {right} |")
    return "\n".join(lines)


def extract_items(text, pattern):
    items = []
    for m in pattern.finditer(text):
        label = m.group(1)
        body = normalize_space(m.group(2))
        if body:
            items.append(f"{label}) {body}")
    return items


def extract_items_with_spans(text, pattern):
    items = []
    spans = []
    for m in pattern.finditer(text):
        label = m.group(1)
        body = normalize_space(m.group(2))
        if body:
            items.append(f"{label}) {body}")
            spans.append(m.span())
    return items, spans


def transform(statement):
    if not statement:
        return None

    cleaned = clean_invisible(statement)

    # 1) Попытка по маркерам
    left_match = MARKER_LEFT.search(cleaned)
    right_match = MARKER_RIGHT.search(cleaned)
    if left_match and right_match and right_match.start() > left_match.start():
        before = cleaned[:left_match.start()]
        middle = cleaned[left_match.end():]
        right_index = middle.lower().find("возможные значения")
        if right_index != -1:
            left_block = middle[:right_index]
            right_block = middle[right_index + len("возможные значения"):]

            left_items = extract_items(left_block, LEFT_ITEM)
            right_items = extract_items(right_block, RIGHT_ITEM)

            if left_items and right_items:
                table_md = build_table(left_items, right_items)
                after = re.sub(r"\b[А-ЯA-Z]{2,}\b\s*$", "", right_block, flags=re.IGNORECASE).strip()
                parts = [normalize_space(before), table_md, normalize_space(after)]
                new_statement = "\n\n".join([p for p in parts if p])
                return new_statement

    # 2) Fallback: без маркеров, ищем блоки A)/1)
    left_items, left_spans = extract_items_with_spans(cleaned, LEFT_ITEM)
    right_items, right_spans = extract_items_with_spans(cleaned, RIGHT_ITEM)

    if len(left_items) >= 3 and len(right_items) >= 3 and left_spans and right_spans:
        # первый блок букв, первый блок цифр после букв
        left_start = left_spans[0][0]
        left_end = left_spans[-1][1]
        right_start = right_spans[0][0]
        right_end = right_spans[-1][1]

        if right_start > left_start:
            before = cleaned[:left_start]
            after = cleaned[right_end:]
            table_md = build_table(left_items, right_items)
            after = re.sub(r"\b[А-ЯA-Z]{2,}\b\s*$", "", after, flags=re.IGNORECASE).strip()
            parts = [normalize_space(before), table_md, normalize_space(after)]
            new_statement = "\n\n".join([p for p in parts if p])
            return new_statement

    return None


def main():
    print("🔐 Авторизация...")
    token = admin_login()
    headers = {"Authorization": f"Bearer {token}"}

    print("📦 Загружаю задачи с кодом 2-...")
    resp = requests.get(
        f"{PB_URL}/api/collections/tasks/records",
        headers=headers,
        params={"perPage": 500, "filter": 'code ~ "2-"', "fields": "id,code,statement_md"}
    )
    resp.raise_for_status()
    items = resp.json().get("items", [])
    print(f"✓ Найдено: {len(items)}")

    updated = 0
    skipped = 0

    for task in items:
        new_statement = transform(task.get("statement_md") or "")
        if not new_statement:
            skipped += 1
            continue

        if new_statement.strip() == clean_invisible(task.get("statement_md") or "").strip():
            skipped += 1
            continue

        patch = requests.patch(
            f"{PB_URL}/api/collections/tasks/records/{task['id']}",
            headers=headers,
            json={"statement_md": new_statement}
        )
        if patch.status_code == 200:
            updated += 1
            print(f"✅ {task['code']} обновлена")
        else:
            print(f"❌ {task['code']} ошибка {patch.status_code}")

    print("=" * 60)
    print(f"Обновлено: {updated}")
    print(f"Пропущено: {skipped}")


if __name__ == "__main__":
    main()

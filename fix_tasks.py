#!/usr/bin/env python3
"""
Скрипт исправления задач типа «соответствие» в БД PocketBase.
Конвертирует плоский текст в Markdown-таблицу.

Использование:
  python3 fix_tasks.py                   # dry run
  python3 fix_tasks.py --apply           # применить
  python3 fix_tasks.py --code 7-003      # одна задача
  python3 fix_tasks.py --verbose         # показать непризнанные тексты
"""

import sqlite3, re, sys

DB_PATH = '/opt/pocketbase/pb_data/data.db'
APPLY   = '--apply'   in sys.argv
VERBOSE = '--verbose' in sys.argv
TARGET  = None
if '--code' in sys.argv:
    idx = sys.argv.index('--code')
    if idx + 1 < len(sys.argv):
        TARGET = sys.argv[idx + 1]

# ── Заголовки ──────────────────────────────────────────────────────────────

LEFT_HEADERS = [
    'ИНТЕРВАЛЫ', 'ТОЧКИ', 'ПЕРИОДЫ ВРЕМЕНИ', 'ПРОМЕЖУТКИ',
    'ГРАФИКИ', 'ФУНКЦИИ', 'УТВЕРЖДЕНИЯ', 'ВЫРАЖЕНИЯ',
]
RIGHT_HEADERS = [
    'ЗНАЧЕНИЯ ПРОИЗВОДНОЙ',
    'ЗНАЧЕНИЯ ПРОИЗВОДНЫХ',           # родительный падеж
    'ХАРАКТЕРИСТИКИ ФУНКЦИИ ИЛИ ПРОИЗВОДНОЙ',
    'ХАРАКТЕРИСТИКИ ФУНКЦИИ',
    'ХАРАКТЕРИСТИКИ',
    'ЗНАЧЕНИЯ ФУНКЦИИ',
    'УГЛОВЫЕ КОЭФФИЦИЕНТЫ',
    'КОЭФФИЦИЕНТЫ',
    'ЗНАЧЕНИЯ',
]

_lh = '|'.join(re.escape(h) for h in sorted(LEFT_HEADERS, key=len, reverse=True))
_rh = '|'.join(re.escape(h) for h in sorted(RIGHT_HEADERS, key=len, reverse=True))
# БЕЗ re.IGNORECASE — заголовки таблицы всегда CAPS; без флага не ловим
# «функции», «значения производной» и т.п. из вводного предложения
LEFT_H_RE  = re.compile(_lh)
RIGHT_H_RE = re.compile(_rh)
FOOTER_RE  = re.compile(r'(Запишите\b|В\s+таблице\b)', re.IGNORECASE)

# ── Разбор пунктов ──────────────────────────────────────────────────────────

def split_cyrillic(text):
    """'А) foo Б) bar В) baz Г) qux' → ['А) foo', 'Б) bar', ...]"""
    parts = re.split(r'(?=\b[АБВГ]\))', text)
    return [p.strip() for p in parts if re.match(r'[АБВГ]\)', p.strip())]

def split_numeric(text):
    """'1) foo 2) bar' или '1. foo; 2. bar;' → ['1) foo', '2) bar', ...]"""
    # Поддержка обоих разделителей: 1) и 1. (с пробелом после точки)
    parts = re.split(r'(?=\b[1-9]\)|\b[1-9]\.\s)', text)
    result = []
    for p in parts:
        p = p.strip().rstrip(';').strip()
        if re.match(r'^[1-9][.)]', p):
            p = re.sub(r'^([1-9])\.', r'\1)', p)   # нормализуем "1." → "1)"
            result.append(p)
    return result

def extract_latin(text):
    """'A B C D' → ['A)', 'B)', 'C)', 'D)']  (только изолированные)"""
    letters = re.findall(r'(?<!\w)([A-D])(?!\w)', text)
    return [f'{l})' for l in letters] if len(letters) >= 2 else []

def build_table(left_h, left_items, right_h, right_items):
    lh = (left_h or 'Левый столбец').strip()
    rh = (right_h or 'Правый столбец').strip()
    rows = max(len(left_items), len(right_items))
    lines = [f'| {lh} | {rh} |', '|---|---|']
    for i in range(rows):
        l = left_items[i].strip() if i < len(left_items) else ''
        r = right_items[i].strip() if i < len(right_items) else ''
        lines.append(f'| {l} | {r} |')
    return '\n'.join(lines)

# ── Паттерн 1: список (- А) ...) ───────────────────────────────────────────

def fix_list_format(text):
    """
    ТОЧКИ          ← заголовок на отдельной строке
    - А) K
    - Б) L
    ЗНАЧЕНИЯ       ← заголовок на отдельной строке
    - 1) -4
    - 2) 3
    """
    lines = text.split('\n')
    lh_idx = rh_idx = None

    for i, line in enumerate(lines):
        s = line.strip()
        if LEFT_H_RE.fullmatch(s) and s == s.upper():
            lh_idx = i
        elif rh_idx is None and lh_idx is not None and RIGHT_H_RE.match(s) and not s.startswith('-'):
            rh_idx = i

    if lh_idx is None or rh_idx is None or lh_idx >= rh_idx:
        return None

    left_h  = lines[lh_idx].strip()
    right_h = RIGHT_H_RE.match(lines[rh_idx].strip()).group(0)

    left_items = [re.sub(r'^[-•]\s*', '', l.strip())
                  for l in lines[lh_idx+1:rh_idx] if l.strip()]
    right_items, footer_idx = [], None
    for i, line in enumerate(lines[rh_idx+1:], start=rh_idx+1):
        clean = re.sub(r'^[-•]\s*', '', line.strip())
        if FOOTER_RE.search(clean):
            footer_idx = i; break
        if clean:
            right_items.append(clean)

    if not left_items or not right_items:
        return None

    table = build_table(left_h, left_items, right_h, right_items)
    parts = []
    prefix = '\n'.join(lines[:lh_idx]).rstrip()
    if prefix:
        parts.append(prefix)
    parts.append(table)
    if footer_idx is not None:
        suffix = '\n'.join(lines[footer_idx:]).strip()
        if suffix:
            parts.append(suffix)
    return '\n\n'.join(parts)

# ── Паттерн 2: строчный (+ латинские буквы, + ГРАФИКИ с пустыми строками) ──

def fix_inline_format(text):
    """
    Стратегия: найти LEFT_H в тексте, затем RIGHT_H *после* него.
    Это избегает ложного срабатывания на «значения производной» во вступлении.
    """
    # 1. Найти LEFT_H
    lm = LEFT_H_RE.search(text)
    if not lm:
        return None

    left_h = lm.group(0)
    prefix = text[:lm.start()].rstrip()
    after_lh = text[lm.end():]

    # 2. Найти RIGHT_H после LEFT_H
    rm = RIGHT_H_RE.search(after_lh)
    if not rm:
        return None

    right_h         = rm.group(0)
    left_items_text = after_lh[:rm.start()]
    after_rh        = after_lh[rm.end():]

    # 3. Footer
    fm = FOOTER_RE.search(after_rh)
    right_items_text = after_rh[:fm.start()].strip() if fm else after_rh.strip()
    suffix           = after_rh[fm.start():].strip()  if fm else ''

    # 4. Левые пункты: кириллица → голые буквы на строках → латиница
    left_items = split_cyrillic(left_items_text)
    if not left_items:
        bare = re.findall(r'(?m)^([АБВГ]\))\s*$', left_items_text)
        left_items = bare if bare else extract_latin(left_items_text)

    # 5. Правые пункты
    right_items = split_numeric(right_items_text)

    if not left_items or not right_items:
        return None

    table = build_table(left_h, left_items, right_h, right_items)
    parts = []
    if prefix:
        parts.append(prefix)
    parts.append(table)
    if suffix:
        parts.append(suffix)
    return '\n\n'.join(parts)

# ── Главная функция ─────────────────────────────────────────────────────────

def fix_statement(statement_md):
    if '|' in statement_md:
        return None, None

    # Паттерн 1: список с тире
    if re.search(r'(?m)^-\s*[АБВГ]\)', statement_md):
        r = fix_list_format(statement_md)
        if r:
            return r, 'list'

    # Паттерн 2/3: строчный / ГРАФИКИ / латиница — работаем по всему тексту
    r = fix_inline_format(statement_md)
    if r:
        return r, 'inline'

    return None, None

# ── Запуск ──────────────────────────────────────────────────────────────────

def main():
    conn = sqlite3.connect(DB_PATH)
    cur  = conn.cursor()

    if TARGET:
        cur.execute("SELECT id, code, statement_md FROM tasks WHERE code = ?", (TARGET,))
    else:
        cur.execute("""
            SELECT t.id, t.code, t.statement_md
            FROM tasks t JOIN topics tp ON t.topic = tp.id
            WHERE tp.title LIKE '%Анализ%'
              AND t.statement_md NOT LIKE '%|%'
            ORDER BY t.code
        """)

    tasks = cur.fetchall()
    print(f'Задач на обработку: {len(tasks)}')
    print('=' * 60)

    fixed_count = skipped_count = 0

    for task_id, code, statement in tasks:
        result, method = fix_statement(statement)

        if result and result != statement:
            fixed_count += 1
            print(f'\n[{code}] ✅ ({method})')
            for line in result.split('\n'):
                if line.startswith('|'):
                    print(f'  {line}')
            if APPLY:
                cur.execute('UPDATE tasks SET statement_md = ? WHERE id = ?',
                            (result, task_id))
        else:
            skipped_count += 1
            if VERBOSE or TARGET:
                print(f'\n[{code}] ⚠️  не распознан')
                print('  ' + statement[:300].replace('\n', ' ↵ '))

    if APPLY:
        conn.commit()
        print(f'\n✅ Применено: {fixed_count}, пропущено: {skipped_count}')
    else:
        print(f'\n🔍 DRY RUN — исправлено: {fixed_count}, не распознано: {skipped_count}')
        print('Для применения: python3 fix_tasks.py --apply')

    conn.close()

if __name__ == '__main__':
    main()

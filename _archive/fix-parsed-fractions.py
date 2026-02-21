"""
Скрипт для исправления плохо спарсенных дробей в md файлах.
Заменяет текстовые описания вида:
  "целая часть: 3, дроб­ная часть: чис­ли­тель: 1, зна­ме­на­тель: 8"
на корректный LaTeX:
  "3\dfrac{1}{8}"

Также исправляет:
  - \frac{5}{} 12  → \frac{5}{12}
  - лишние { и } в формулах
  - \frac{{}{3}}{40} → \frac{3}{40}

Использование: python3 fix-parsed-fractions.py [файл]
По умолчанию: source/14-1.md
"""

import re
import sys

FILE = sys.argv[1] if len(sys.argv) > 1 else "source/14-1.md"

with open(FILE, "r", encoding="utf-8") as f:
    content = f.read()

original = content

# 1. Замена "целая часть: X, дроб­ная часть: чис­ли­тель: Y, зна­ме­на­тель: Z"
# Учитываем мягкий перенос (­ = \u00AD) и обычный дефис
# Паттерн: "целая часть: <число>, дроб[­-]ная часть: чис[­-]ли[­-]тель: <число>, зна[­-]ме[­-]на[­-]тель: <число>"
pattern_mixed = re.compile(
    r'целая\s+часть:\s*(\d+),\s*дроб[\u00AD\-]?ная\s+часть:\s*чис[\u00AD\-]?ли[\u00AD\-]?тель:\s*(\d+),\s*зна[\u00AD\-]?ме[\u00AD\-]?на[\u00AD\-]?тель:\s*(\d+)'
)

def replace_mixed(m):
    whole = m.group(1)
    num = m.group(2)
    den = m.group(3)
    return f'{whole}\\dfrac{{{num}}}{{{den}}}'

content = pattern_mixed.sub(replace_mixed, content)

# 2. Исправление \frac{5}{} 12 → \frac{5}{12} (пустые скобки + число через пробел)
pattern_empty_frac = re.compile(r'\\frac\{(\d+)\}\{\}\s*(\d+)')
content = pattern_empty_frac.sub(r'\\frac{\1}{\2}', content)

# 3. Исправление \frac{{}{3}}{40} → \frac{3}{40} (лишние фигурные скобки)
pattern_broken_frac = re.compile(r'\\frac\{\{[}\s]*\{?(\d+)\}?\}\{(\d+)\}')
content = pattern_broken_frac.sub(r'\\frac{\1}{\2}', content)

# 4. Удаление лишних ${ в начале формул → $(
content = content.replace('${ (', '$(')
content = content.replace('${(', '$(')

# 5. Удаление лишних } в конце перед точкой, если это остаток от парсинга
# Паттерн: "...число }." → "...число ."
# Но аккуратно - только если } не закрывает \frac или другую конструкцию
# Лучше сделать конкретные замены для видимых проблем

# 6. Исправление лишнего } в задаче 46: "целая часть: 3... }" → убрать }
# После замены mixed числа, ищем паттерн "3\dfrac{4}{7} }." → "3\dfrac{4}{7} ."
pattern_trailing_brace = re.compile(r'(\\dfrac\{\d+\}\{\d+\})\s*\}')
content = pattern_trailing_brace.sub(r'\1', content)

# Подсчёт изменений
changes = 0
for i, (a, b) in enumerate(zip(original.split('\n'), content.split('\n'))):
    if a != b:
        changes += 1

print(f"📄 Файл: {FILE}")
print(f"📝 Изменено строк: {changes}")

with open(FILE, "w", encoding="utf-8") as f:
    f.write(content)

print(f"✅ Файл сохранён")

# Показать примеры изменений (первые 5)
shown = 0
for i, (a, b) in enumerate(zip(original.split('\n'), content.split('\n'))):
    if a != b and shown < 10:
        print(f"\n  Строка {i+1}:")
        print(f"  БЫЛО:  {a.strip()[:120]}")
        print(f"  СТАЛО: {b.strip()[:120]}")
        shown += 1

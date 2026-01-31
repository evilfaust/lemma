#!/usr/bin/env python3
import re
import sys

def fix_latex_braces(text):
    """Исправляет круглые скобки на фигурные в LaTeX выражениях"""

    # 1. Степени: ^(выражение) -> ^{выражение}
    text = re.sub(r'\^(\([^)]+\))', lambda m: '^{' + m.group(1)[1:-1] + '}', text)

    # 2. Нижние индексы: _(выражение) -> _{выражение}
    text = re.sub(r'_(\([^)]+\))', lambda m: '_{' + m.group(1)[1:-1] + '}', text)

    # 3. Дроби: \frac(числитель)(знаменатель) -> \frac{числитель}{знаменатель}
    text = re.sub(r'\\frac(\([^)]+\))(\([^)]+\))',
                  lambda m: '\\frac{' + m.group(1)[1:-1] + '}{' + m.group(2)[1:-1] + '}', text)

    # 4. Корни: \sqrt(выражение) -> \sqrt{выражение}
    text = re.sub(r'\\sqrt(\([^)]+\))', lambda m: '\\sqrt{' + m.group(1)[1:-1] + '}', text)

    # 5. Корни степени n: \sqrt[n](выражение) -> \sqrt[n]{выражение}
    text = re.sub(r'\\sqrt\[([^\]]+)\](\([^)]+\))',
                  lambda m: '\\sqrt[' + m.group(1) + ']{' + m.group(2)[1:-1] + '}', text)

    return text

def main():
    if len(sys.argv) < 2:
        print("Использование: python3 fix-markdown-latex.py <файл>")
        sys.exit(1)

    filename = sys.argv[1]

    print(f"📄 Читаю файл: {filename}")

    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()

    original_content = content
    fixed_content = fix_latex_braces(content)

    if original_content == fixed_content:
        print("✓ Файл не требует изменений")
        return

    # Создаем резервную копию
    backup_filename = filename + '.backup'
    with open(backup_filename, 'w', encoding='utf-8') as f:
        f.write(original_content)

    print(f"📋 Создана резервная копия: {backup_filename}")

    # Сохраняем исправленный файл
    with open(filename, 'w', encoding='utf-8') as f:
        f.write(fixed_content)

    # Подсчитываем количество замен
    changes = sum(1 for a, b in zip(original_content, fixed_content) if a != b)

    print(f"✅ Файл исправлен ({changes} символов изменено)")

if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""
Скрипт для сквозной нумерации задач в файлах ustno-1.md - ustno-5.md
"""

import re
import os

def process_files():
    source_dir = '/Users/evilfaust/Documents/APP/generation-test/source'
    files = ['ustno-1.md', 'ustno-2.md', 'ustno-3.md', 'ustno-4.md', 'ustno-5.md']

    global_counter = 0
    all_tags = set()

    # Паттерн для номера задачи вида **N** [N] или **N** [N]
    task_pattern = re.compile(r'^\*\*(\d+)\*\*\s+\[(\d+)\]')
    # Паттерн для тегов
    tags_pattern = re.compile(r'^tags:\s*\[([^\]]+)\]')

    for filename in files:
        filepath = os.path.join(source_dir, filename)
        print(f"\nОбрабатываю файл: {filename}")

        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        lines = content.split('\n')
        new_lines = []
        file_task_count = 0

        for line in lines:
            # Ищем теги
            tags_match = tags_pattern.match(line)
            if tags_match:
                tags_str = tags_match.group(1)
                tags = [t.strip() for t in tags_str.split(',')]
                all_tags.update(tags)

            # Ищем строку с номером задачи
            task_match = task_pattern.match(line)
            if task_match:
                global_counter += 1
                file_task_count += 1
                difficulty = task_match.group(2)
                # Заменяем номер на глобальный
                new_line = re.sub(r'^\*\*\d+\*\*', f'**{global_counter}**', line)
                new_lines.append(new_line)
            else:
                new_lines.append(line)

        print(f"  Задач в файле: {file_task_count}")
        print(f"  Текущий счетчик: {global_counter}")

        # Записываем файл
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write('\n'.join(new_lines))

    print(f"\n\nВсего задач: {global_counter}")
    print(f"\n\nВсе уникальные теги ({len(all_tags)}):")
    for tag in sorted(all_tags):
        print(f"  - {tag}")

    return all_tags

if __name__ == '__main__':
    tags = process_files()

#!/usr/bin/env python3
"""
Сканер и автоисправление задач, повреждённых при старом импорте.

По умолчанию запускается безопасный scan (без записи в БД).
Для применения исправлений используйте --apply.
"""

import argparse
import os
import re
import shutil
import sqlite3
from dataclasses import dataclass
from datetime import datetime


DB_PATH_DEFAULT = "pocketbase/pb_data/data.db"
TEXT_FIELDS = ("statement_md", "answer", "solution_md", "explanation_md")


@dataclass
class RepairStats:
    total_tasks: int = 0
    suspicious_tasks: int = 0
    tasks_with_br_marker: int = 0
    tasks_with_soft_hyphen: int = 0
    tasks_with_split_latex_cmd: int = 0
    tasks_with_unbalanced_dollars: int = 0
    updated_tasks: int = 0


class TaskRepairer:
    isolated_latex_cmd_pattern = re.compile(
        r"\$\s*\\(sin|cos|tan|cot|log|sqrt|frac|pi|alpha|beta|gamma|delta|cdot|in|geq|leq)\s*\$"
    )
    broken_split_math_pattern = re.compile(
        r"\$\s*[^$\n]+?\s+\$\s*\\(sin|cos|tan|cot|log|sqrt|frac)\s*\$\s*[^$\n]+?\$"
    )

    def __init__(self, db_path: str):
        self.db_path = db_path
        self.stats = RepairStats()

    @staticmethod
    def count_unescaped_dollars(text: str) -> int:
        count = 0
        escaped = False
        for ch in text:
            if escaped:
                escaped = False
                continue
            if ch == "\\":
                escaped = True
                continue
            if ch == "$":
                count += 1
        return count

    def normalize_text(self, text: str, fix_split_latex: bool) -> str:
        if not text:
            return text
        fixed = text
        fixed = fixed.replace("___BR___", "\n")
        fixed = fixed.replace("\u00AD", "")  # soft hyphen
        fixed = fixed.replace("\u200B", "")  # zero-width space
        if fix_split_latex:
            # Потенциально рискованная правка; включается только флагом.
            fixed = self.isolated_latex_cmd_pattern.sub(r"\\\1", fixed)
        fixed = re.sub(r"\n{3,}", "\n\n", fixed).strip()
        return fixed

    def collect_reasons(self, text: str):
        reasons = []
        if "___BR___" in text:
            reasons.append("BR_MARKER")
        if "\u00AD" in text or "\u200B" in text:
            reasons.append("SOFT_HYPHEN")
        if self.broken_split_math_pattern.search(text):
            reasons.append("SPLIT_LATEX_CMD")
        dollars = self.count_unescaped_dollars(text)
        if dollars % 2 == 1:
            reasons.append("UNBALANCED_DOLLARS")
        return reasons

    def backup_db(self):
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_path = f"{self.db_path}.backup_before_repair_{ts}"
        shutil.copy2(self.db_path, backup_path)
        return backup_path

    def run(self, apply_changes: bool, source_filter: str, fix_split_latex: bool):
        if not os.path.exists(self.db_path):
            raise FileNotFoundError(f"DB not found: {self.db_path}")

        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()

        query = "SELECT id, code, source, statement_md, answer, solution_md, explanation_md FROM tasks"
        params = []
        if source_filter:
            query += " WHERE source LIKE ?"
            params.append(f"%{source_filter}%")

        rows = cur.execute(query, params).fetchall()
        self.stats.total_tasks = len(rows)

        to_update = []
        examples = []

        for row in rows:
            combined_reasons = set()
            updated_fields = {}

            for field in TEXT_FIELDS:
                original = row[field] or ""
                reasons = self.collect_reasons(original)
                for reason in reasons:
                    combined_reasons.add(reason)

                fixed = self.normalize_text(original, fix_split_latex=fix_split_latex)
                if fixed != original:
                    updated_fields[field] = fixed

            if combined_reasons:
                self.stats.suspicious_tasks += 1
                if "BR_MARKER" in combined_reasons:
                    self.stats.tasks_with_br_marker += 1
                if "SOFT_HYPHEN" in combined_reasons:
                    self.stats.tasks_with_soft_hyphen += 1
                if "SPLIT_LATEX_CMD" in combined_reasons:
                    self.stats.tasks_with_split_latex_cmd += 1
                if "UNBALANCED_DOLLARS" in combined_reasons:
                    self.stats.tasks_with_unbalanced_dollars += 1

                if len(examples) < 15:
                    examples.append(
                        (
                            row["code"],
                            row["id"],
                            ",".join(sorted(combined_reasons)),
                            (row["statement_md"] or "")[:140].replace("\n", " "),
                        )
                    )

            if updated_fields:
                to_update.append((row["id"], updated_fields))

        backup_path = None
        if apply_changes and to_update:
            backup_path = self.backup_db()
            for task_id, fields in to_update:
                set_clause = ", ".join([f"{k} = ?" for k in fields.keys()])
                values = list(fields.values()) + [task_id]
                cur.execute(f"UPDATE tasks SET {set_clause} WHERE id = ?", values)
            conn.commit()
            self.stats.updated_tasks = len(to_update)

        conn.close()
        return examples, backup_path


def main():
    parser = argparse.ArgumentParser(
        description="Scan/repair imported tasks with known parser artifacts."
    )
    parser.add_argument("--db", default=DB_PATH_DEFAULT, help="Path to PocketBase SQLite DB")
    parser.add_argument("--apply", action="store_true", help="Apply fixes to DB (with auto-backup)")
    parser.add_argument(
        "--source-filter",
        default="РЕШУ ЕГЭ",
        help="Filter by source substring (default: РЕШУ ЕГЭ). Empty string scans all tasks.",
    )
    parser.add_argument(
        "--fix-split-latex",
        action="store_true",
        help="Также чинить паттерн $\\sin$/$\\tan$ и т.п. (может задеть валидные записи).",
    )
    args = parser.parse_args()

    repairer = TaskRepairer(args.db)
    examples, backup_path = repairer.run(
        apply_changes=args.apply,
        source_filter=args.source_filter,
        fix_split_latex=args.fix_split_latex,
    )
    s = repairer.stats

    mode = "APPLY" if args.apply else "SCAN"
    print(f"[{mode}] DB: {args.db}")
    print(f"Total tasks scanned: {s.total_tasks}")
    print(f"Suspicious tasks: {s.suspicious_tasks}")
    print(f" - with ___BR___ marker: {s.tasks_with_br_marker}")
    print(f" - with soft hyphen / zero-width chars: {s.tasks_with_soft_hyphen}")
    print(f" - with possible split LaTeX commands ($\\\\sin$ style): {s.tasks_with_split_latex_cmd}")
    print(f" - with unbalanced dollars: {s.tasks_with_unbalanced_dollars}")
    if args.apply:
        print(f"Updated tasks: {s.updated_tasks}")
        if backup_path:
            print(f"Backup created: {backup_path}")

    print("\nExamples:")
    if not examples:
        print(" - none")
    for code, task_id, reasons, snippet in examples:
        print(f" - {code} ({task_id}) [{reasons}] {snippet}")


if __name__ == "__main__":
    main()

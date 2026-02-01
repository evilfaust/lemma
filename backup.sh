#!/bin/bash
# ============================================
# PocketBase Database Backup Script
# Ежедневный бэкап с ротацией (хранит 10 последних)
# ============================================

PROJECT_DIR="/Users/evilfaust/Documents/APP/generation-test"
PB_DATA="$PROJECT_DIR/pocketbase/pb_data"
BACKUP_DIR="$PROJECT_DIR/backups"
MAX_BACKUPS=10
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_NAME="backup_$TIMESTAMP"
CURRENT_BACKUP="$BACKUP_DIR/$BACKUP_NAME"

# Создаём папку для текущего бэкапа
mkdir -p "$CURRENT_BACKUP"

# Используем sqlite3 .backup для безопасного копирования
# (корректно работает даже если PocketBase запущен)
if command -v sqlite3 &> /dev/null; then
    sqlite3 "$PB_DATA/data.db" ".backup '$CURRENT_BACKUP/data.db'"
    sqlite3 "$PB_DATA/auxiliary.db" ".backup '$CURRENT_BACKUP/auxiliary.db'"
else
    # Fallback: обычное копирование (если sqlite3 нет)
    cp "$PB_DATA/data.db" "$CURRENT_BACKUP/data.db"
    cp "$PB_DATA/auxiliary.db" "$CURRENT_BACKUP/auxiliary.db"
fi

# Копируем storage (если появятся файлы)
if [ -d "$PB_DATA/storage" ] && [ "$(ls -A "$PB_DATA/storage" 2>/dev/null)" ]; then
    cp -r "$PB_DATA/storage" "$CURRENT_BACKUP/storage"
fi

# Сжимаем бэкап
cd "$BACKUP_DIR"
tar -czf "$BACKUP_NAME.tar.gz" "$BACKUP_NAME"
rm -rf "$CURRENT_BACKUP"

# Ротация: удаляем старые бэкапы, оставляем последние MAX_BACKUPS
BACKUP_COUNT=$(ls -1 "$BACKUP_DIR"/backup_*.tar.gz 2>/dev/null | wc -l | tr -d ' ')
if [ "$BACKUP_COUNT" -gt "$MAX_BACKUPS" ]; then
    ls -1t "$BACKUP_DIR"/backup_*.tar.gz | tail -n +$((MAX_BACKUPS + 1)) | xargs rm -f
fi

# Лог
SIZE=$(du -sh "$BACKUP_DIR/$BACKUP_NAME.tar.gz" | cut -f1)
echo "[$(date)] Бэкап создан: $BACKUP_NAME.tar.gz ($SIZE) | Всего бэкапов: $(ls -1 "$BACKUP_DIR"/backup_*.tar.gz 2>/dev/null | wc -l | tr -d ' ')/$MAX_BACKUPS"

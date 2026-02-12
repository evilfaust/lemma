#!/bin/bash
# ============================================
# PocketBase Database SAFE Restore Script
#
# ⚠️  ВНИМАНИЕ! ⚠️
# Этот скрипт УДАЛИТ текущую базу данных!
# ВСЕГДА создает бэкап текущего состояния
# перед восстановлением!
# ============================================

set -e  # Выход при ошибке

PROJECT_DIR="/Users/evilfaust/Documents/APP/generation-test"
PB_DATA="$PROJECT_DIR/pocketbase/pb_data"
BACKUP_DIR="$PROJECT_DIR/backups"

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${RED}"
echo "=========================================="
echo "⚠️  ВНИМАНИЕ: ВОССТАНОВЛЕНИЕ ИЗ БЭКАПА  ⚠️"
echo "=========================================="
echo -e "${NC}"

# Проверка наличия бэкапов
if [ ! -d "$BACKUP_DIR" ] || [ -z "$(ls -A "$BACKUP_DIR"/*.tar.gz 2>/dev/null)" ]; then
    echo -e "${RED}❌ Нет доступных бэкапов в $BACKUP_DIR${NC}"
    exit 1
fi

# Показать доступные бэкапы
echo -e "${GREEN}Доступные бэкапы:${NC}"
echo ""
ls -lht "$BACKUP_DIR"/*.tar.gz | head -10 | awk '{print NR". " $9 " (" $6 " " $7 " " $8 ")"}'
echo ""

# Запросить выбор бэкапа
read -p "Введите номер бэкапа для восстановления (или 'q' для выхода): " choice

if [ "$choice" = "q" ] || [ "$choice" = "Q" ]; then
    echo "Отменено."
    exit 0
fi

# Получить путь к выбранному бэкапу
SELECTED_BACKUP=$(ls -1t "$BACKUP_DIR"/*.tar.gz | sed -n "${choice}p")

if [ -z "$SELECTED_BACKUP" ]; then
    echo -e "${RED}❌ Неверный выбор${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}Выбран бэкап: $(basename "$SELECTED_BACKUP")${NC}"
echo ""

# Показать информацию о текущей БД
if [ -f "$PB_DATA/data.db" ]; then
    echo -e "${GREEN}Текущее состояние БД:${NC}"
    CURRENT_TASKS=$(sqlite3 "$PB_DATA/data.db" "SELECT COUNT(*) FROM tasks;" 2>/dev/null || echo "?")
    CURRENT_ATTEMPTS=$(sqlite3 "$PB_DATA/data.db" "SELECT COUNT(*) FROM attempts;" 2>/dev/null || echo "?")
    CURRENT_STUDENTS=$(sqlite3 "$PB_DATA/data.db" "SELECT COUNT(*) FROM students;" 2>/dev/null || echo "?")

    echo "  - Задач: $CURRENT_TASKS"
    echo "  - Попыток студентов: $CURRENT_ATTEMPTS"
    echo "  - Студентов: $CURRENT_STUDENTS"
    echo ""
fi

# Извлечь дату из имени бэкапа
BACKUP_DATE=$(basename "$SELECTED_BACKUP" .tar.gz | sed 's/backup_//')
echo -e "${YELLOW}⚠️  Восстановление удалит ВСЕ изменения после $BACKUP_DATE${NC}"
echo ""

# Подтверждение 1
read -p "Вы уверены? Это удалит текущую БД! (yes/no): " confirm1
if [ "$confirm1" != "yes" ]; then
    echo "Отменено."
    exit 0
fi

# Подтверждение 2
echo ""
echo -e "${RED}ПОСЛЕДНЕЕ ПРЕДУПРЕЖДЕНИЕ!${NC}"
read -p "Введите 'RESTORE' (заглавными) для подтверждения: " confirm2
if [ "$confirm2" != "RESTORE" ]; then
    echo "Отменено."
    exit 0
fi

echo ""
echo -e "${GREEN}=========================================="
echo "Начинаю восстановление..."
echo "==========================================${NC}"
echo ""

# ШАГ 1: Создать аварийный бэкап текущего состояния
echo -e "${GREEN}[1/5] Создание аварийного бэкапа текущего состояния...${NC}"
EMERGENCY_BACKUP="$BACKUP_DIR/EMERGENCY_before_restore_$(date +%Y-%m-%d_%H-%M-%S).tar.gz"
cd "$PROJECT_DIR/pocketbase"
tar -czf "$EMERGENCY_BACKUP" pb_data/
echo -e "${GREEN}✓ Аварийный бэкап создан: $(basename "$EMERGENCY_BACKUP")${NC}"
echo ""

# ШАГ 2: Остановить PocketBase
echo -e "${GREEN}[2/5] Остановка PocketBase...${NC}"
pkill -f pocketbase || true
sleep 2
echo -e "${GREEN}✓ PocketBase остановлен${NC}"
echo ""

# ШАГ 3: Удалить текущую БД
echo -e "${YELLOW}[3/5] Удаление текущей БД...${NC}"
rm -rf "$PB_DATA"
echo -e "${GREEN}✓ Текущая БД удалена${NC}"
echo ""

# ШАГ 4: Восстановить из бэкапа
echo -e "${GREEN}[4/5] Восстановление из бэкапа...${NC}"
cd "$PROJECT_DIR/pocketbase"
tar -xzf "$SELECTED_BACKUP"
# Переименовать извлеченную папку в pb_data
EXTRACTED_DIR=$(tar -tzf "$SELECTED_BACKUP" | head -1 | cut -f1 -d"/")
if [ -d "$EXTRACTED_DIR" ]; then
    mv "$EXTRACTED_DIR" pb_data
elif [ -d "pb_data" ]; then
    # Уже извлечено в pb_data
    echo "pb_data извлечен"
else
    echo -e "${RED}❌ Ошибка извлечения бэкапа${NC}"
    echo -e "${YELLOW}Восстанавливаю из аварийного бэкапа...${NC}"
    tar -xzf "$EMERGENCY_BACKUP"
    exit 1
fi
echo -e "${GREEN}✓ Бэкап восстановлен${NC}"
echo ""

# ШАГ 5: Проверить восстановленную БД
echo -e "${GREEN}[5/5] Проверка восстановленной БД...${NC}"
if [ -f "$PB_DATA/data.db" ]; then
    RESTORED_TASKS=$(sqlite3 "$PB_DATA/data.db" "SELECT COUNT(*) FROM tasks;" 2>/dev/null || echo "?")
    RESTORED_ATTEMPTS=$(sqlite3 "$PB_DATA/data.db" "SELECT COUNT(*) FROM attempts;" 2>/dev/null || echo "?")
    RESTORED_STUDENTS=$(sqlite3 "$PB_DATA/data.db" "SELECT COUNT(*) FROM students;" 2>/dev/null || echo "?")

    echo "Восстановленные данные:"
    echo "  - Задач: $RESTORED_TASKS"
    echo "  - Попыток студентов: $RESTORED_ATTEMPTS"
    echo "  - Студентов: $RESTORED_STUDENTS"
else
    echo -e "${RED}❌ ОШИБКА: data.db не найден!${NC}"
    echo -e "${YELLOW}Восстанавливаю из аварийного бэкапа...${NC}"
    rm -rf "$PB_DATA"
    tar -xzf "$EMERGENCY_BACKUP"
    exit 1
fi
echo ""

echo -e "${GREEN}"
echo "=========================================="
echo "✅ ВОССТАНОВЛЕНИЕ ЗАВЕРШЕНО УСПЕШНО"
echo "=========================================="
echo -e "${NC}"
echo "Восстановлено из: $(basename "$SELECTED_BACKUP")"
echo "Аварийный бэкап сохранен: $(basename "$EMERGENCY_BACKUP")"
echo ""
echo -e "${YELLOW}⚠️  Не забудьте запустить PocketBase:${NC}"
echo "cd pocketbase && ./pocketbase serve"
echo ""

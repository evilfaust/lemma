# 🚨 КРИТИЧЕСКИЕ ПРАВИЛА РАБОТЫ С БАЗОЙ ДАННЫХ

## ⛔ НИКОГДА НЕ ДЕЛАЙ ЭТО БЕЗ БЭКАПА

### Запрещенные команды без предварительного бэкапа:

```bash
# ОПАСНО! НЕ ЗАПУСКАТЬ!
rm -rf pocketbase/pb_data
./pocketbase migrate down
git checkout -- pocketbase/pb_data/
```

---

## ✅ Правильная процедура работы с БД

### 1. Перед любыми изменениями - СОЗДАЙ БЭКАП

```bash
# Вариант 1: Использовать скрипт
./backup.sh

# Вариант 2: Вручную
cd pocketbase
tar -czf ~/Desktop/emergency_backup_$(date +%Y%m%d_%H%M%S).tar.gz pb_data/

# Вариант 3: Бэкап с описанием
cd pocketbase
tar -czf ~/Desktop/before_migration_$(date +%Y%m%d_%H%M%S).tar.gz pb_data/
```

### 2. Проверь дату последнего бэкапа

```bash
ls -lht backups/ | head -5
```

**⚠️ Если последний бэкап старше 1 дня - СОЗДАЙ НОВЫЙ!**

### 3. Проверь размер БД

```bash
du -sh pocketbase/pb_data/data.db
sqlite3 pocketbase/pb_data/data.db "SELECT COUNT(*) FROM tasks;"
```

### 4. Только после бэкапа выполняй операции

```bash
# Теперь можно
./pocketbase migrate up
# или другие операции
```

---

## 🔥 История катастроф

### Катастрофа 1: 12 февраля 2026

**Что произошло:**
- Удалена папка `pocketbase/pb_data`
- Восстановление из старого бэкапа (9 февраля)
- **НЕ СОЗДАН** новый бэкап перед удалением

**Потери:**
- ~1000 задач (добавлены 10-12 февраля)
- Все результаты тестов студентов за 3 дня
- Все данные системы достижений
- Все записи о прохождении работ

**Команда-убийца:**
```bash
rm -rf pocketbase/pb_data  # ← КАТАСТРОФА!
tar -xzf backups/backup_2026-02-09_20-31-40.tar.gz
```

**Урок:**
1. Всегда проверяй дату бэкапа ПЕРЕД восстановлением
2. Всегда создавай новый бэкап ПЕРЕД деструктивными операциями
3. Спрашивай пользователя о подтверждении

---

## 📋 Чеклист безопасности

Перед любыми операциями с БД:

- [ ] Создан свежий бэкап (меньше 1 часа назад)
- [ ] Проверена дата последнего бэкапа в `backups/`
- [ ] Проверено количество задач в текущей БД
- [ ] Получено подтверждение пользователя (для критичных операций)
- [ ] Бэкап сохранен в безопасное место (не только в `backups/`)

---

## 🛡️ Автоматические бэкапы

### Настроить cron для автоматических бэкапов:

```bash
# Редактировать crontab
crontab -e

# Добавить строку (бэкап каждые 6 часов)
0 */6 * * * cd /Users/evilfaust/Documents/APP/generation-test && ./backup.sh

# Или каждый день в 3:00
0 3 * * * cd /Users/evilfaust/Documents/APP/generation-test && ./backup.sh
```

### Проверить настроенные задачи:

```bash
crontab -l
```

---

## 💾 Восстановление из бэкапа (правильно)

### 1. СОЗДАЙ БЭКАП ТЕКУЩЕГО СОСТОЯНИЯ!

```bash
cd pocketbase
tar -czf ~/Desktop/current_state_before_restore_$(date +%Y%m%d_%H%M%S).tar.gz pb_data/
```

### 2. Проверь дату бэкапа, из которого восстанавливаешь

```bash
ls -lht backups/
tar -tzf backups/backup_2026-02-XX_XX-XX-XX.tar.gz
```

### 3. Спроси пользователя о подтверждении

**"Последний бэкап от [ДАТА]. Восстановление удалит все изменения после этой даты. Продолжить?"**

### 4. Только после подтверждения - восстанавливай

```bash
cd pocketbase
rm -rf pb_data
tar -xzf ../backups/backup_2026-02-XX_XX-XX-XX.tar.gz
mv backup_2026-02-XX_XX-XX-XX pb_data
```

---

## 🔍 Полезные команды для проверки

### Проверить содержимое БД

```bash
sqlite3 pocketbase/pb_data/data.db "SELECT COUNT(*) as tasks FROM tasks;"
sqlite3 pocketbase/pb_data/data.db "SELECT COUNT(*) as attempts FROM attempts;"
sqlite3 pocketbase/pb_data/data.db "SELECT COUNT(*) as students FROM students;"
```

### Проверить последние изменения

```bash
sqlite3 pocketbase/pb_data/data.db "SELECT created FROM tasks ORDER BY created DESC LIMIT 5;"
```

### Размер БД

```bash
du -h pocketbase/pb_data/*.db
```

---

## ⚠️ Помни

**База данных содержит:**
- Тысячи задач (часы/дни работы)
- Результаты тестов студентов
- Достижения студентов
- Варианты контрольных работ
- Теоретические статьи

**Потеря данных = потеря многих часов работы пользователя**

**ВСЕГДА ДЕЛАЙ БЭКАП ПЕРЕД ИЗМЕНЕНИЯМИ!**

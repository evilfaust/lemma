# 📦 Руководство по резервному копированию

## 🚨 ВАЖНО: ЧИТАЙ ЭТО ПЕРЕД РАБОТОЙ С БД!

База данных содержит критически важные данные:
- Тысячи задач
- Результаты тестов студентов
- Достижения студентов
- Контрольные работы

**Потеря данных = потеря многих часов работы!**

---

## ✅ Создание бэкапа (ДЕЛАЙ ЭТО ЧАСТО!)

### Автоматический бэкап

```bash
./backup.sh
```

Скрипт:
- Безопасно копирует БД (даже если PocketBase запущен)
- Сжимает в `.tar.gz`
- Сохраняет в `backups/`
- Показывает статистику (количество задач, попыток, студентов)
- Автоматически удаляет старые бэкапы (хранит 10 последних)

### Ручной бэкап

```bash
cd pocketbase
tar -czf ~/Desktop/backup_$(date +%Y%m%d_%H%M%S).tar.gz pb_data/
```

---

## 📋 Когда создавать бэкап?

### ✅ ОБЯЗАТЕЛЬНО перед:
- Миграциями БД (`./pocketbase migrate`)
- Обновлением PocketBase
- Любыми экспериментами с БД
- Запуском скриптов изменения данных
- Восстановлением из старого бэкапа

### ✅ РЕКОМЕНДУЕТСЯ:
- Каждый день (настрой cron)
- Перед добавлением большого количества задач
- Перед тестированием новых функций
- Перед деплоем на продакшн

---

## 🔄 Автоматические бэкапы (cron)

### Настройка

```bash
# Открыть crontab
crontab -e

# Добавить одну из строк:

# Каждые 6 часов
0 */6 * * * cd /Users/evilfaust/Documents/APP/generation-test && ./backup.sh >> /tmp/backup.log 2>&1

# Каждый день в 3:00 ночи
0 3 * * * cd /Users/evilfaust/Documents/APP/generation-test && ./backup.sh >> /tmp/backup.log 2>&1

# Каждый час
0 * * * * cd /Users/evilfaust/Documents/APP/generation-test && ./backup.sh >> /tmp/backup.log 2>&1
```

### Проверить настроенные задачи

```bash
crontab -l
```

### Проверить лог

```bash
tail -f /tmp/backup.log
```

---

## 📤 Восстановление из бэкапа

### ⚠️ ВНИМАНИЕ! Восстановление УДАЛИТ текущую БД!

### Безопасный способ (рекомендуется)

```bash
./restore.sh
```

Скрипт:
1. Показывает все доступные бэкапы
2. Показывает текущее состояние БД
3. Просит подтверждение (дважды!)
4. Создает аварийный бэкап текущего состояния
5. Останавливает PocketBase
6. Восстанавливает из выбранного бэкапа
7. Проверяет восстановленную БД

### Ручной способ (опасно!)

```bash
# 1. ОБЯЗАТЕЛЬНО создай бэкап текущего состояния!
./backup.sh

# 2. Останови PocketBase
pkill -f pocketbase

# 3. Удали текущую БД
cd pocketbase
rm -rf pb_data

# 4. Распакуй бэкап
tar -xzf ../backups/backup_2026-02-XX_XX-XX-XX.tar.gz
mv backup_2026-02-XX_XX-XX-XX pb_data

# 5. Запусти PocketBase
./pocketbase serve
```

---

## 📊 Проверка бэкапов

### Список всех бэкапов

```bash
ls -lht backups/
```

### Просмотр содержимого бэкапа

```bash
tar -tzf backups/backup_2026-02-12_15-00-00.tar.gz
```

### Проверка размера

```bash
du -sh backups/*.tar.gz
```

### Извлечь бэкап во временную папку (без восстановления)

```bash
mkdir /tmp/backup_preview
cd /tmp/backup_preview
tar -xzf ~/Documents/APP/generation-test/backups/backup_2026-02-XX_XX-XX-XX.tar.gz

# Проверить содержимое
sqlite3 backup_*/data.db "SELECT COUNT(*) FROM tasks;"

# Удалить временную папку
cd ~
rm -rf /tmp/backup_preview
```

---

## 🔍 Проверка текущей БД

### Количество записей

```bash
cd pocketbase
sqlite3 pb_data/data.db "SELECT COUNT(*) as tasks FROM tasks;"
sqlite3 pb_data/data.db "SELECT COUNT(*) as attempts FROM attempts;"
sqlite3 pb_data/data.db "SELECT COUNT(*) as students FROM students;"
sqlite3 pb_data/data.db "SELECT COUNT(*) as achievements FROM achievements;"
```

### Последние изменения

```bash
sqlite3 pb_data/data.db "SELECT created FROM tasks ORDER BY created DESC LIMIT 5;"
sqlite3 pb_data/data.db "SELECT created FROM attempts ORDER BY created DESC LIMIT 5;"
```

### Размер БД

```bash
du -sh pb_data/*.db
```

### Целостность БД

```bash
sqlite3 pb_data/data.db "PRAGMA integrity_check;"
```

---

## 💾 Хранение бэкапов

### Локальные бэкапы

По умолчанию бэкапы сохраняются в `backups/` (хранится 10 последних).

### Внешние копии (рекомендуется!)

Периодически копируй бэкапы в безопасное место:

```bash
# На внешний диск
cp backups/backup_*.tar.gz /Volumes/External/ege-backups/

# В облако (Dropbox/Google Drive)
cp backups/backup_*.tar.gz ~/Dropbox/ege-backups/

# На другой компьютер (rsync)
rsync -avz backups/ user@server:/path/to/backups/
```

### Создать архив всех бэкапов

```bash
tar -czf ~/Desktop/all_backups_$(date +%Y%m%d).tar.gz backups/
```

---

## 🛡️ Стратегия бэкапов (рекомендуется)

### 3-2-1 правило

- **3** копии данных (оригинал + 2 бэкапа)
- **2** разных типа носителей (жесткий диск + облако)
- **1** копия за пределами местонахождения (удаленный сервер/облако)

### Пример стратегии

1. **Автоматические локальные бэкапы** - каждые 6 часов (cron)
2. **Ручные бэкапы перед критичными операциями** - всегда
3. **Копия на внешний диск** - раз в неделю
4. **Копия в облако** - раз в день
5. **Архив всех бэкапов** - раз в месяц

---

## 📝 Чеклист безопасности

Перед любыми операциями с БД:

- [ ] Создан свежий бэкап (меньше 1 часа назад)
- [ ] Проверена дата последнего бэкапа в `backups/`
- [ ] Бэкап сохранен в безопасное место (не только `backups/`)
- [ ] Проверено количество задач: `sqlite3 pb_data/data.db "SELECT COUNT(*) FROM tasks;"`
- [ ] Получено подтверждение (для критичных операций)

---

## 🚨 В случае катастрофы

### Если потеряны данные

1. **НЕ ПАНИКУЙ**
2. **НЕ ЗАПУСКАЙ PocketBase** (не перезаписывай данные)
3. Проверь `backups/` - может быть есть свежий бэкап
4. Проверь корзину macOS: `~/.Trash/`
5. Проверь Time Machine (если включен)
6. Используй `./restore.sh` для восстановления

### Если бэкапы старые

1. Проверь другие места (Desktop, Downloads, облако)
2. Проверь lsof/activity monitor - может PocketBase еще держит файл
3. Попробуй восстановить из WAL файлов SQLite (если есть)

---

## 🔗 Дополнительные ресурсы

- [DATABASE_SAFETY.md](./DATABASE_SAFETY.md) - Критические правила безопасности
- [CLAUDE.md](./CLAUDE.md) - Контекст проекта
- [README.md](./README.md) - Общая документация

# Wi-Fi Configuration на Raspberry Pi

## 📡 Настроенные сети

Raspberry Pi настроен на автоматическое подключение к следующим Wi-Fi сетям (в порядке приоритета):

| Приоритет | Имя сети | Частота | Пароль | Назначение |
|-----------|----------|---------|---------|------------|
| **20** (высший) | VZMAKH_5G | 5 GHz | V3m@h-TR | Школьная сеть (быстрая) |
| **10** | VZMAKH_2G | 2.4 GHz | V3m@h-TR | Школьная сеть (надежная) |
| **0** | Keenetic-1965 | - | (сохранен) | Домашняя сеть |

> **Приоритет**: чем выше число, тем выше приоритет. Raspberry Pi сначала попытается подключиться к VZMAKH_5G.

## 🔧 NetworkManager

На Raspberry Pi используется **NetworkManager** для управления сетевыми подключениями.

### Полезные команды

#### Просмотр всех Wi-Fi подключений
```bash
sudo nmcli connection show
```

#### Просмотр доступных Wi-Fi сетей
```bash
sudo nmcli device wifi list
```

#### Текущий статус подключения
```bash
sudo nmcli connection show --active
```

#### Добавить новую Wi-Fi сеть
```bash
# Создать подключение
sudo nmcli connection add type wifi con-name 'ИМЯ_СЕТИ' ifname wlan0 ssid 'ИМЯ_СЕТИ'

# Установить пароль
sudo nmcli connection modify 'ИМЯ_СЕТИ' wifi-sec.key-mgmt wpa-psk wifi-sec.psk 'ПАРОЛЬ'

# Включить автоподключение с приоритетом
sudo nmcli connection modify 'ИМЯ_СЕТИ' connection.autoconnect yes connection.autoconnect-priority 15
```

#### Удалить Wi-Fi сеть
```bash
sudo nmcli connection delete 'ИМЯ_СЕТИ'
```

#### Подключиться к сети вручную
```bash
sudo nmcli connection up 'ИМЯ_СЕТИ'
```

#### Отключиться от сети
```bash
sudo nmcli connection down 'ИМЯ_СЕТИ'
```

#### Изменить приоритет существующей сети
```bash
sudo nmcli connection modify 'ИМЯ_СЕТИ' connection.autoconnect-priority 25
```

## 🏠 Сценарии использования

### Дома (Keenetic-1965)
Raspberry Pi автоматически подключается к домашней сети. IP-адрес обычно: **192.168.1.68**

### В школе (VZMAKH_5G или VZMAKH_2G)
1. Принести Raspberry Pi в школу
2. Включить питание
3. Raspberry Pi автоматически подключится к VZMAKH_5G (если доступна) или к VZMAKH_2G
4. Узнать новый IP-адрес:
   ```bash
   # С Mac в той же сети:
   ping raspberrypi.local
   # Или найти в списке подключенных устройств роутера
   ```

### Узнать текущий IP-адрес
```bash
# На самой Raspberry Pi:
hostname -I

# Или через NetworkManager:
nmcli device show wlan0 | grep IP4.ADDRESS
```

## 🔄 Автоматическое переключение между сетями

NetworkManager автоматически выбирает лучшую доступную сеть:
1. Если доступна **VZMAKH_5G** — подключится к ней (приоритет 20)
2. Если нет — попробует **VZMAKH_2G** (приоритет 10)
3. Если нет школьных сетей — подключится к **Keenetic-1965** (приоритет 0)

## 🛠️ Устранение проблем

### Wi-Fi не подключается
```bash
# Проверить статус Wi-Fi
sudo nmcli radio wifi

# Включить Wi-Fi (если выключен)
sudo nmcli radio wifi on

# Перезапустить NetworkManager
sudo systemctl restart NetworkManager

# Просмотреть логи
sudo journalctl -u NetworkManager -f
```

### Забыл пароль от сети
```bash
# Посмотреть пароль сохраненной сети
sudo nmcli --show-secrets connection show 'ИМЯ_СЕТИ' | grep psk
```

### Изменить пароль существующей сети
```bash
sudo nmcli connection modify 'ИМЯ_СЕТИ' wifi-sec.psk 'НОВЫЙ_ПАРОЛЬ'
```

## 📋 Резервная копия конфигурации Wi-Fi

Все настройки Wi-Fi хранятся в `/etc/NetworkManager/system-connections/`

### Создать резервную копию
```bash
sudo tar -czf ~/wifi-backup-$(date +%Y%m%d).tar.gz /etc/NetworkManager/system-connections/
```

### Восстановить из резервной копии
```bash
sudo tar -xzf ~/wifi-backup-YYYYMMDD.tar.gz -C /
sudo systemctl restart NetworkManager
```

## 🔐 Безопасность

⚠️ **Важно**: Пароли Wi-Fi хранятся в открытом виде в системных файлах (доступны только root).

Файлы конфигурации:
```bash
ls -la /etc/NetworkManager/system-connections/
```

Права доступа должны быть `600` (только root может читать):
```bash
sudo chmod 600 /etc/NetworkManager/system-connections/*
```

## 📖 Дополнительная информация

- [NetworkManager Documentation](https://networkmanager.dev/)
- [nmcli Examples](https://developer.gnome.org/NetworkManager/stable/nmcli-examples.html)

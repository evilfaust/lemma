#!/usr/bin/env node

/**
 * Telegram Bot для мониторинга Raspberry Pi
 * Отправляет уведомления о статусе при загрузке и по командам
 */

const https = require('https');
const { execSync } = require('child_process');

// ============================================================================
// Конфигурация
// ============================================================================
const BOT_TOKEN = '8094410045:AAGD7DID-odRPOdwEpk85GhhTtsqQgRPZO4';
const CHAT_ID = 328497552; // Число, а не строка!
const API_URL = `https://api.telegram.org/bot${BOT_TOKEN}`;

// ============================================================================
// Утилиты для работы с системой
// ============================================================================

function execCommand(command) {
  try {
    return execSync(command, { encoding: 'utf8' }).trim();
  } catch (error) {
    return null;
  }
}

function getIPAddress() {
  const fullIP = execCommand("hostname -I");
  if (!fullIP) return 'Не определен';
  const ip = fullIP.split(' ')[0];
  return ip || 'Не определен';
}

function getWiFiNetwork() {
  const network = execCommand("nmcli -t -f active,ssid dev wifi | grep '^yes' | cut -d':' -f2");
  return network || 'Не подключен';
}

function getServiceStatus(serviceName) {
  const status = execCommand(`systemctl is-active ${serviceName} 2>/dev/null`);
  return status === 'active';
}

function getSystemStats() {
  const memRaw = execCommand("free -h | grep Mem");
  let memory = 'N/A';
  if (memRaw) {
    const parts = memRaw.split(/\s+/);
    memory = `${parts[2]}/${parts[1]}`;
  }

  const cpuTemp = execCommand("vcgencmd measure_temp 2>/dev/null | cut -d'=' -f2");

  const diskRaw = execCommand("df -h / | tail -1");
  let disk = 'N/A';
  if (diskRaw) {
    const parts = diskRaw.split(/\s+/);
    disk = `${parts[2]}/${parts[1]} (${parts[4]})`;
  }

  const uptime = execCommand("uptime -p");

  return {
    memory: memory,
    temperature: cpuTemp || 'N/A',
    disk: disk,
    uptime: uptime || 'N/A'
  };
}

function getServicesStatus() {
  return {
    pocketbase: getServiceStatus('pocketbase'),
    pdf: getServiceStatus('pdf-service'),
    nginx: getServiceStatus('nginx')
  };
}

// ============================================================================
// Telegram API
// ============================================================================

function sendTelegramMessage(text, parseMode = null) {
  const payload = {
    chat_id: CHAT_ID,
    text: text
  };

  if (parseMode) {
    payload.parse_mode = parseMode;
  }

  const data = JSON.stringify(payload);

  const options = {
    hostname: 'api.telegram.org',
    path: `/bot${BOT_TOKEN}/sendMessage`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data)
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(body));
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function getUpdates(offset = 0) {
  return new Promise((resolve, reject) => {
    const url = `${API_URL}/getUpdates?offset=${offset}&timeout=30`;

    https.get(url, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          resolve(data.result || []);
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', reject);
  });
}

// ============================================================================
// Форматирование сообщений
// ============================================================================

function formatStartupMessage() {
  const ip = getIPAddress();
  const network = getWiFiNetwork();
  const services = getServicesStatus();

  const statusEmoji = (status) => status ? '✅' : '❌';
  const statusText = (status) => status ? 'running' : 'stopped';

  let message = '🟢 *Raspberry Pi подключен!*\n\n';
  message += `📡 *Сеть:* ${network}\n`;
  message += `🌐 *IP:* \`${ip}\`\n\n`;
  message += '*Статус сервисов:*\n';
  message += `${statusEmoji(services.pocketbase)} PocketBase: ${statusText(services.pocketbase)}\n`;
  message += `${statusEmoji(services.pdf)} PDF Service: ${statusText(services.pdf)}\n`;
  message += `${statusEmoji(services.nginx)} Nginx: ${statusText(services.nginx)}\n\n`;

  if (ip !== 'Не определен') {
    message += `🔗 *Приложение:* http://${ip}\n`;
    message += `⚙️ *Admin:* http://${ip}/\\_/\n\n`;
  }

  message += '_Доступные команды:_ /status, /ip, /stats, /restart';

  return message;
}

function formatStatusMessage() {
  const services = getServicesStatus();
  const stats = getSystemStats();

  const statusEmoji = (status) => status ? '✅' : '❌';
  const statusText = (status) => status ? 'running' : 'stopped';

  let message = '📊 *Статус Raspberry Pi*\n\n';
  message += '*Сервисы:*\n';
  message += `${statusEmoji(services.pocketbase)} PocketBase: ${statusText(services.pocketbase)}\n`;
  message += `${statusEmoji(services.pdf)} PDF Service: ${statusText(services.pdf)}\n`;
  message += `${statusEmoji(services.nginx)} Nginx: ${statusText(services.nginx)}\n\n`;
  message += '*Система:*\n';
  message += `💾 RAM: ${stats.memory}\n`;
  message += `🌡 Температура: ${stats.temperature}\n`;
  message += `💿 Диск: ${stats.disk}\n`;
  message += `⏱ Uptime: ${stats.uptime}`;

  return message;
}

function formatIPMessage() {
  const ip = getIPAddress();
  const network = getWiFiNetwork();

  let message = '🌐 *Сетевая информация*\n\n';
  message += `📡 *Wi-Fi:* ${network}\n`;
  message += `🌐 *IP:* \`${ip}\`\n\n`;

  if (ip !== 'Не определен') {
    message += `🔗 http://${ip}`;
  }

  return message;
}

function formatStatsMessage() {
  const stats = getSystemStats();

  let message = '📈 *Использование ресурсов*\n\n';
  message += `💾 *Память:* ${stats.memory}\n`;
  message += `🌡 *Температура CPU:* ${stats.temperature}\n`;
  message += `💿 *Диск:* ${stats.disk}\n`;
  message += `⏱ *Время работы:* ${stats.uptime}`;

  return message;
}

// ============================================================================
// Обработка команд
// ============================================================================

function restartServices() {
  const results = {
    pocketbase: execCommand('sudo systemctl restart pocketbase 2>&1'),
    pdf: execCommand('sudo systemctl restart pdf-service 2>&1'),
    nginx: execCommand('sudo systemctl restart nginx 2>&1')
  };

  // Даем время на перезапуск
  execCommand('sleep 2');

  const services = getServicesStatus();
  const statusEmoji = (status) => status ? '✅' : '❌';

  let message = '🔄 *Сервисы перезапущены*\n\n';
  message += `${statusEmoji(services.pocketbase)} PocketBase\n`;
  message += `${statusEmoji(services.pdf)} PDF Service\n`;
  message += `${statusEmoji(services.nginx)} Nginx`;

  return message;
}

async function handleCommand(command, messageId) {
  let response = '';

  try {
    switch (command) {
      case '/start':
      case '/help':
        response = '🤖 *Telegram Bot для Raspberry Pi*\n\n';
        response += '*Доступные команды:*\n';
        response += '/status - Статус сервисов и системы\n';
        response += '/ip - Текущий IP-адрес\n';
        response += '/stats - Использование ресурсов\n';
        response += '/restart - Перезапустить сервисы\n';
        response += '/notify - Отправить статус (как при загрузке)';
        break;

      case '/status':
        response = formatStatusMessage();
        break;

      case '/ip':
        response = formatIPMessage();
        break;

      case '/stats':
        response = formatStatsMessage();
        break;

      case '/restart':
        response = restartServices();
        break;

      case '/notify':
        response = formatStartupMessage();
        break;

      default:
        response = '❓ Неизвестная команда. Используйте /help для списка команд.';
    }

    console.log(`Отправка ответа (${response.length} символов)`);
    await sendTelegramMessage(response, 'Markdown');
    console.log(`✅ Ответ отправлен на команду ${command}`);
  } catch (error) {
    console.error(`❌ Ошибка обработки команды ${command}:`, error.message);
  }
}

// ============================================================================
// Long Polling (прослушивание команд)
// ============================================================================

let lastUpdateId = 0;

async function pollUpdates() {
  try {
    const updates = await getUpdates(lastUpdateId + 1);

    for (const update of updates) {
      lastUpdateId = update.update_id;

      if (update.message && update.message.text) {
        const command = update.message.text.trim();
        const messageId = update.message.message_id;
        const chatId = update.message.chat.id;

        console.log(`Получена команда: ${command} от ${chatId}`);

        // Проверяем, что сообщение от нужного пользователя
        if (chatId === CHAT_ID) {
          console.log(`Обработка команды: ${command}`);
          await handleCommand(command, messageId);
        } else {
          console.log(`Игнорируем команду от неизвестного пользователя: ${chatId}`);
        }
      }
    }
  } catch (error) {
    console.error('Error polling updates:', error.message);
  }
}

// ============================================================================
// Главная функция
// ============================================================================

async function main() {
  const mode = process.argv[2] || 'startup';

  if (mode === 'startup') {
    // Режим отправки уведомления при загрузке
    const message = formatStartupMessage();

    try {
      await sendTelegramMessage(message, 'Markdown');
      console.log('✅ Уведомление отправлено в Telegram');
    } catch (error) {
      console.error('❌ Ошибка отправки:', error.message);
      process.exit(1);
    }
  } else if (mode === 'daemon') {
    // Режим демона (прослушивание команд)
    console.log('🤖 Telegram Bot запущен в режиме демона');
    console.log('Прослушивание команд...');

    // Запускаем polling каждые 2 секунды
    setInterval(pollUpdates, 2000);

    // Первый запрос сразу
    pollUpdates();
  } else {
    console.error('Неизвестный режим. Используйте: startup или daemon');
    process.exit(1);
  }
}

// Запуск
main().catch((error) => {
  console.error('Критическая ошибка:', error);
  process.exit(1);
});

#!/usr/bin/env node

/**
 * Telegram Bot для мониторинга VPS (EGE Tasks Manager)
 * Мониторит сервисы, БД, бэкапы. Работает на VPS.
 *
 * Режимы: startup (уведомление при запуске) | daemon (long polling)
 */

const https = require('https');
const http = require('http');
const { execSync } = require('child_process');

// ============================================================================
// Конфигурация
// ============================================================================
const BOT_TOKEN = '8094410045:AAGD7DID-odRPOdwEpk85GhhTtsqQgRPZO4';
const CHAT_ID = 328497552;
const API_URL = `https://api.telegram.org/bot${BOT_TOKEN}`;

const PB_DATA_PATH = '/opt/pocketbase/pb_data/data.db';
const BACKUP_DIR = '/opt/pocketbase/backups';
const PUBLIC_URL = 'https://task-ege.oipav.ru';

// Имена systemd-сервисов на VPS
const SERVICES = {
  pocketbase: 'pocketbase-ege',
  pdf: 'pdf-service-ege',
  nginx: 'nginx',
  bot: 'telegram-bot-ege',
};

// ============================================================================
// Утилиты
// ============================================================================

function exec(command) {
  try {
    return execSync(command, { encoding: 'utf8', timeout: 10000 }).trim();
  } catch {
    return null;
  }
}

function statusIcon(ok) { return ok ? '✅' : '❌'; }
function statusWord(ok) { return ok ? 'running' : 'stopped'; }

function isServiceActive(name) {
  return exec(`systemctl is-active ${name} 2>/dev/null`) === 'active';
}

// ============================================================================
// Сбор данных — VPS
// ============================================================================

function getVPSServices() {
  return {
    pocketbase: isServiceActive(SERVICES.pocketbase),
    pdf: isServiceActive(SERVICES.pdf),
    nginx: isServiceActive(SERVICES.nginx),
    bot: isServiceActive(SERVICES.bot),
  };
}

function getVPSStats() {
  const memRaw = exec("free -h | grep Mem");
  let memory = 'N/A';
  if (memRaw) {
    const p = memRaw.split(/\s+/);
    memory = `${p[2]} / ${p[1]}`;
  }

  const diskRaw = exec("df -h / | tail -1");
  let disk = 'N/A';
  if (diskRaw) {
    const p = diskRaw.split(/\s+/);
    disk = `${p[2]} / ${p[1]} (${p[4]})`;
  }

  const load = exec("cat /proc/loadavg | awk '{print $1, $2, $3}'") || 'N/A';
  const uptime = exec("uptime -p") || 'N/A';

  return { memory, disk, load, uptime };
}

// ============================================================================
// Сбор данных — База данных
// ============================================================================

function getDBStats() {
  const q = (sql) => exec(`sqlite3 '${PB_DATA_PATH}' "${sql}" 2>/dev/null`);

  const tasks = q('SELECT COUNT(*) FROM tasks') || '?';
  const topics = q('SELECT COUNT(*) FROM topics') || '?';
  const students = q('SELECT COUNT(*) FROM students') || '?';
  const attempts = q('SELECT COUNT(*) FROM attempts') || '?';
  const works = q('SELECT COUNT(*) FROM works') || '?';
  const sessions = q('SELECT COUNT(*) FROM work_sessions') || '?';
  const articles = q('SELECT COUNT(*) FROM theory_articles') || '?';

  // Топ-3 темы по количеству задач
  const topTopics = q(
    "SELECT t.title || ': ' || COUNT(*) FROM tasks tk JOIN topics t ON tk.topic = t.id GROUP BY tk.topic ORDER BY COUNT(*) DESC LIMIT 3"
  );

  // Последняя попытка
  const lastAttempt = q(
    "SELECT datetime(submitted_at, 'localtime') || ' — ' || student_name || ' (' || score || '/' || total || ')' FROM attempts WHERE status='submitted' ORDER BY submitted_at DESC LIMIT 1"
  );

  return { tasks, topics, students, attempts, works, sessions, articles, topTopics, lastAttempt };
}

// ============================================================================
// Сбор данных — Бэкапы
// ============================================================================

function getBackupInfo() {
  const count = exec(`ls -1 ${BACKUP_DIR}/backup_*.tar.gz 2>/dev/null | wc -l`) || '0';
  const latest = exec(`ls -t ${BACKUP_DIR}/backup_*.tar.gz 2>/dev/null | head -1`);
  let latestInfo = 'нет бэкапов';

  if (latest) {
    const name = latest.split('/').pop();
    const size = exec(`du -sh "${latest}" | cut -f1`) || '?';
    // Извлекаем дату из имени: backup_2026-02-17_21-04-28.tar.gz
    const match = name.match(/backup_(\d{4}-\d{2}-\d{2})_(\d{2})-(\d{2})-(\d{2})/);
    const dateStr = match ? `${match[1]} ${match[2]}:${match[3]}:${match[4]}` : name;
    latestInfo = `${dateStr} (${size})`;
  }

  // Список последних 5
  const list = exec(`ls -t ${BACKUP_DIR}/backup_*.tar.gz 2>/dev/null | head -5 | while read f; do
    name=$(basename "$f")
    size=$(du -sh "$f" | cut -f1)
    echo "  • $name ($size)"
  done`);

  return { count, latestInfo, list: list || '  нет бэкапов' };
}

// ============================================================================
// HTTP health checks
// ============================================================================

function httpGet(url) {
  return new Promise((resolve) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { timeout: 5000 }, (res) => {
      let body = '';
      res.on('data', (c) => body += c);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', () => resolve({ status: 0, body: 'connection failed' }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, body: 'timeout' }); });
  });
}

async function healthCheck() {
  const pb = await httpGet('http://127.0.0.1:8095/api/health');
  const pdf = await httpGet('http://127.0.0.1:3001/health');
  const ext = await httpGet(`${PUBLIC_URL}/api/health`);

  return {
    pbLocal: pb.status === 200,
    pdfLocal: pdf.status === 200,
    external: ext.status === 200,
  };
}

// ============================================================================
// Telegram API
// ============================================================================

function sendMessage(text, parseMode = 'Markdown') {
  const payload = JSON.stringify({
    chat_id: CHAT_ID,
    text,
    parse_mode: parseMode,
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${BOT_TOKEN}/sendMessage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    }, (res) => {
      let body = '';
      res.on('data', (c) => body += c);
      res.on('end', () => {
        res.statusCode === 200 ? resolve(JSON.parse(body)) : reject(new Error(`HTTP ${res.statusCode}: ${body}`));
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function getUpdates(offset = 0) {
  return new Promise((resolve, reject) => {
    https.get(`${API_URL}/getUpdates?offset=${offset}&timeout=30`, (res) => {
      let body = '';
      res.on('data', (c) => body += c);
      res.on('end', () => {
        try { resolve(JSON.parse(body).result || []); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

// ============================================================================
// Форматирование сообщений
// ============================================================================

function fmtStartup() {
  const services = getVPSServices();
  const stats = getVPSStats();
  const ip = exec("hostname -I | awk '{print $1}'") || '?';

  let msg = '🟢 *VPS EGE Tasks запущен!*\n\n';
  msg += `🌐 *IP:* \`${ip}\`\n`;
  msg += `🔗 ${PUBLIC_URL}\n\n`;
  msg += '*Сервисы:*\n';
  msg += `${statusIcon(services.pocketbase)} PocketBase: ${statusWord(services.pocketbase)}\n`;
  msg += `${statusIcon(services.pdf)} PDF Service: ${statusWord(services.pdf)}\n`;
  msg += `${statusIcon(services.nginx)} Nginx: ${statusWord(services.nginx)}\n\n`;
  msg += `💾 RAM: ${stats.memory}\n`;
  msg += `💿 Диск: ${stats.disk}\n`;
  msg += `⏱ ${stats.uptime}\n\n`;
  msg += '_Команды:_ /status /db /backups /health /restart /help';
  return msg;
}

function fmtStatus() {
  const svc = getVPSServices();
  const stats = getVPSStats();

  let msg = '📊 *Статус VPS*\n\n';
  msg += '*Сервисы:*\n';
  msg += `${statusIcon(svc.pocketbase)} PocketBase (pocketbase-ege)\n`;
  msg += `${statusIcon(svc.pdf)} PDF Service (pdf-service-ege)\n`;
  msg += `${statusIcon(svc.nginx)} Nginx\n`;
  msg += `${statusIcon(svc.bot)} Telegram Bot\n\n`;
  msg += '*Система:*\n';
  msg += `💾 RAM: ${stats.memory}\n`;
  msg += `💿 Диск: ${stats.disk}\n`;
  msg += `📈 Load: ${stats.load}\n`;
  msg += `⏱ ${stats.uptime}`;
  return msg;
}

function fmtDB() {
  const db = getDBStats();

  let msg = '🗃 *Статистика базы данных*\n\n';
  msg += `📝 Задач: *${db.tasks}*\n`;
  msg += `📚 Тем: *${db.topics}*\n`;
  msg += `📖 Статей теории: *${db.articles}*\n`;
  msg += `📋 Работ: *${db.works}*\n`;
  msg += `🎯 Сессий: *${db.sessions}*\n`;
  msg += `👨‍🎓 Студентов: *${db.students}*\n`;
  msg += `✏️ Попыток: *${db.attempts}*\n`;

  if (db.topTopics) {
    msg += '\n*Топ-3 темы:*\n';
    db.topTopics.split('\n').forEach((line) => {
      msg += `  • ${line}\n`;
    });
  }

  if (db.lastAttempt) {
    msg += `\n🕐 *Последняя попытка:*\n  ${db.lastAttempt}`;
  }

  return msg;
}

function fmtBackups() {
  const info = getBackupInfo();

  let msg = '💾 *Бэкапы*\n\n';
  msg += `Всего: *${info.count}* (макс 20)\n`;
  msg += `Последний: ${info.latestInfo}\n`;
  msg += `Расписание: каждые 6 часов (cron)\n\n`;
  msg += '*Последние 5:*\n';
  msg += info.list;
  return msg;
}

async function fmtHealth() {
  const h = await healthCheck();

  let msg = '🏥 *Health Check*\n\n';
  msg += `${statusIcon(h.pbLocal)} PocketBase (localhost:8095)\n`;
  msg += `${statusIcon(h.pdfLocal)} PDF Service (localhost:3001)\n`;
  msg += `${statusIcon(h.external)} External (${PUBLIC_URL})\n`;
  return msg;
}

function fmtRestart(target) {
  const validTargets = {
    all: [SERVICES.pocketbase, SERVICES.pdf, SERVICES.nginx],
    pocketbase: [SERVICES.pocketbase],
    pb: [SERVICES.pocketbase],
    pdf: [SERVICES.pdf],
    nginx: [SERVICES.nginx],
  };

  const services = validTargets[target || 'all'];
  if (!services) {
    return '❓ Укажите сервис: /restart all | pocketbase | pdf | nginx';
  }

  services.forEach((s) => exec(`systemctl restart ${s} 2>&1`));
  exec('sleep 2');

  const svc = getVPSServices();
  let msg = '🔄 *Сервисы перезапущены*\n\n';
  if (services.includes(SERVICES.pocketbase)) msg += `${statusIcon(svc.pocketbase)} PocketBase\n`;
  if (services.includes(SERVICES.pdf)) msg += `${statusIcon(svc.pdf)} PDF Service\n`;
  if (services.includes(SERVICES.nginx)) msg += `${statusIcon(svc.nginx)} Nginx\n`;
  return msg;
}

function fmtLogs(service) {
  const svcMap = {
    pocketbase: SERVICES.pocketbase,
    pb: SERVICES.pocketbase,
    pdf: SERVICES.pdf,
    nginx: 'nginx',
    bot: SERVICES.bot,
  };

  const svcName = svcMap[service || 'pocketbase'];
  if (!svcName) {
    return '❓ Укажите сервис: /logs pocketbase | pdf | nginx | bot';
  }

  const logs = exec(`journalctl -u ${svcName} --no-pager -n 20 --no-hostname 2>/dev/null`) ||
               exec(`tail -20 /var/log/${svcName}.log 2>/dev/null`) ||
               'Логи недоступны';

  // Ограничиваем длину для Telegram (4096 символов макс)
  const trimmed = logs.length > 3500 ? '...' + logs.slice(-3500) : logs;

  return `📋 *Логи: ${svcName}* (последние 20 строк)\n\n\`\`\`\n${trimmed}\n\`\`\``;
}

function fmtHelp() {
  let msg = '🤖 *EGE Tasks Bot (VPS)*\n\n';
  msg += '*Мониторинг:*\n';
  msg += '/status — статус сервисов и системы\n';
  msg += '/health — health-check эндпоинтов\n';
  msg += '/db — статистика базы данных\n';
  msg += '/backups — информация о бэкапах\n\n';
  msg += '*Управление:*\n';
  msg += '/restart \\[all|pb|pdf|nginx\\] — перезапуск\n';
  msg += '/logs \\[pb|pdf|nginx|bot\\] — логи сервиса\n\n';
  msg += '*Ссылки:*\n';
  msg += `🔗 [Приложение](${PUBLIC_URL})\n`;
  msg += `⚙️ [Admin](${PUBLIC_URL}/_/)`;
  return msg;
}

// ============================================================================
// Обработка команд
// ============================================================================

async function handleCommand(text) {
  const parts = text.trim().split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const arg = parts[1]?.toLowerCase();

  let response;

  switch (cmd) {
    case '/start':
    case '/help':
      response = fmtHelp();
      break;
    case '/status':
      response = fmtStatus();
      break;
    case '/db':
      response = fmtDB();
      break;
    case '/backups':
      response = fmtBackups();
      break;
    case '/health':
      response = await fmtHealth();
      break;
    case '/restart':
      response = fmtRestart(arg);
      break;
    case '/logs':
      response = fmtLogs(arg);
      break;
    case '/notify':
      response = fmtStartup();
      break;
    default:
      response = '❓ Неизвестная команда. /help — список команд';
  }

  try {
    await sendMessage(response);
    console.log(`✅ Ответ на ${cmd}`);
  } catch (error) {
    console.error(`❌ Ошибка ответа на ${cmd}:`, error.message);
  }
}

// ============================================================================
// Long Polling
// ============================================================================

let lastUpdateId = 0;

async function pollUpdates() {
  try {
    const updates = await getUpdates(lastUpdateId + 1);

    for (const update of updates) {
      lastUpdateId = update.update_id;

      if (update.message?.text && update.message.chat.id === CHAT_ID) {
        console.log(`Команда: ${update.message.text}`);
        await handleCommand(update.message.text);
      }
    }
  } catch (error) {
    console.error('Polling error:', error.message);
  }
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const mode = process.argv[2] || 'startup';

  if (mode === 'startup') {
    try {
      await sendMessage(fmtStartup());
      console.log('✅ Startup уведомление отправлено');
    } catch (error) {
      console.error('❌ Ошибка отправки:', error.message);
      process.exit(1);
    }
  } else if (mode === 'daemon') {
    console.log('🤖 EGE Tasks Bot запущен (VPS daemon)');
    setInterval(pollUpdates, 2000);
    pollUpdates();
  } else {
    console.error('Режим: startup | daemon');
    process.exit(1);
  }
}

main().catch((e) => { console.error('Fatal:', e); process.exit(1); });

/**
 * PDF Generation Service using Puppeteer
 * Standalone Node.js service for high-quality PDF generation
 */

import express from 'express';
import puppeteer from 'puppeteer';
import cors from 'cors';

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Глобальная переменная для браузера (переиспользование)
let browser = null;

/**
 * Получить или создать браузер
 */
async function getBrowser() {
  if (browser && browser.connected) {
    return browser;
  }

  console.log('[PDF] Запуск Chromium...');
  browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
    ],
  });

  browser.on('disconnected', () => {
    console.log('[PDF] Браузер отключен');
    browser = null;
  });

  return browser;
}

/**
 * POST /generate
 * Генерация PDF из HTML
 */
app.post('/generate', async (req, res) => {
  const startTime = Date.now();
  let page = null;

  try {
    const { html, filename = 'document.pdf', options = {} } = req.body;

    if (!html) {
      return res.status(400).json({ error: 'HTML content is required' });
    }

    console.log(`[PDF] Генерация: ${filename}`);

    // Получаем браузер
    const browserInstance = await getBrowser();

    // Создаём новую страницу
    page = await browserInstance.newPage();

    // Устанавливаем viewport
    await page.setViewport({
      width: 1200,
      height: 1600,
      deviceScaleFactor: 2,
    });

    // Загружаем HTML
    await page.setContent(html, {
      waitUntil: ['load', 'networkidle0'],
      timeout: 30000,
    });

    // Ждём загрузки шрифтов
    await page.evaluateHandle('document.fonts.ready');

    // Небольшая задержка для KaTeX (новый синтаксис)
    await new Promise(resolve => setTimeout(resolve, 500));

    // Генерируем PDF
    const pdf = await page.pdf({
      format: options.format || 'A4',
      printBackground: true,
      preferCSSPageSize: false,
      margin: {
        top: options.marginTop || '7mm',
        bottom: options.marginBottom || '7mm',
        left: options.marginLeft || '7mm',
        right: options.marginRight || '7mm',
      },
      displayHeaderFooter: false,
    });

    // Закрываем страницу
    await page.close();

    const duration = Date.now() - startTime;
    console.log(`[PDF] Готово: ${filename} (${pdf.length} bytes, ${duration}ms)`);

    // Отправляем PDF
    // Кодируем имя файла для поддержки кириллицы
    const encodedFilename = encodeURIComponent(filename);

    res.writeHead(200, {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodedFilename}`,
      'Content-Length': pdf.length,
    });
    res.end(pdf, 'binary');

  } catch (error) {
    console.error('[PDF] Ошибка:', error);

    // Закрываем страницу при ошибке
    if (page) {
      try {
        await page.close();
      } catch (e) {
        // ignore
      }
    }

    res.status(500).json({
      error: 'PDF generation failed',
      message: error.message,
    });
  }
});

/**
 * GET /health
 * Health check
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'puppeteer-pdf',
    puppeteer: 'installed',
    browser: browser?.connected ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});

/**
 * Shutdown handler
 */
process.on('SIGINT', async () => {
  console.log('\n[PDF] Завершение работы...');

  if (browser) {
    await browser.close();
  }

  process.exit(0);
});

/**
 * Запуск сервера
 */
app.listen(PORT, () => {
  console.log(`[PDF] Сервис запущен на http://localhost:${PORT}`);
  console.log(`[PDF] Health check: http://localhost:${PORT}/health`);
});

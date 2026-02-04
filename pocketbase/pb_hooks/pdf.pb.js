/// <reference path="../pb_data/types.d.ts" />

/**
 * PDF Generation endpoint using Puppeteer
 * Generates high-quality PDF from HTML with KaTeX support
 */

// Динамический импорт Puppeteer
let puppeteer;
try {
  puppeteer = require('puppeteer');
} catch (e) {
  console.error('Puppeteer not installed. Run: npm install puppeteer');
}

/**
 * POST /api/pdf/generate
 * Body: { html: string, filename: string, options: object }
 */
routerAdd("POST", "/api/pdf/generate", async (c) => {
  if (!puppeteer) {
    return c.json(503, {
      error: 'PDF service unavailable',
      message: 'Puppeteer is not installed'
    });
  }

  try {
    const data = c.request().json();
    const { html, filename = 'document.pdf', options = {} } = data;

    if (!html) {
      return c.json(400, { error: 'HTML content is required' });
    }

    console.log(`[PDF] Generating PDF: ${filename}`);

    // Запускаем браузер
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
      ],
      timeout: 30000,
    });

    const page = await browser.newPage();

    // Устанавливаем viewport для лучшего рендеринга
    await page.setViewport({
      width: 1200,
      height: 1600,
      deviceScaleFactor: 2,
    });

    // Загружаем HTML контент
    await page.setContent(html, {
      waitUntil: ['load', 'networkidle0'],
      timeout: 30000,
    });

    // Ждём загрузки шрифтов и KaTeX
    await page.evaluateHandle('document.fonts.ready');

    // Небольшая задержка для полного рендеринга KaTeX
    await page.waitForTimeout(500);

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

    await browser.close();

    console.log(`[PDF] Generated successfully: ${filename} (${pdf.length} bytes)`);

    // Возвращаем PDF
    c.response().header("Content-Type", "application/pdf");
    c.response().header("Content-Disposition", `attachment; filename="${filename}"`);
    c.response().header("Content-Length", String(pdf.length));

    return c.blob(200, pdf);

  } catch (error) {
    console.error('[PDF] Generation error:', error);
    return c.json(500, {
      error: 'PDF generation failed',
      message: error.message,
      stack: error.stack
    });
  }
})

/**
 * GET /api/pdf/health
 * Health check endpoint
 */
routerAdd("GET", "/api/pdf/health", (c) => {
  const status = puppeteer ? 'ok' : 'unavailable';
  const version = puppeteer ? 'installed' : 'not installed';

  return c.json(puppeteer ? 200 : 503, {
    status: status,
    service: 'puppeteer-pdf',
    puppeteer: version,
    timestamp: new Date().toISOString()
  });
})

console.log('[PDF] Puppeteer PDF generation hooks loaded');

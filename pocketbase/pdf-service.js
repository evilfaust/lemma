/**
 * PDF Generation Service using Puppeteer
 * Standalone Node.js service for high-quality PDF generation
 */

import express from 'express';
import puppeteer from 'puppeteer';
import cors from 'cors';
import * as cheerio from 'cheerio';

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

// ============================================================
// SDAMGIA PARSER — порт логики из par.py
// ============================================================

const SDAMGIA_BASE_URL = 'https://mathb-ege.sdamgia.ru';

/**
 * Очистка LaTeX формул от русских слов (alt-текст из SVG формул sdamgia)
 * Порт clean_latex_formula из par.py
 */
function cleanLatexFormula(text) {
  // Убираем точки в конце
  text = text.replace(/\.+$/, '');

  // Словарные замены русских слов на LaTeX команды
  const replacements = [
    ['левая круг\u00ADлая скоб\u00ADка', '('],
    ['пра\u00ADвая круг\u00ADлая скоб\u00ADка', ')'],
    ['плюс', '+'],
    ['минус', '-'],
    ['умно\u00ADжить на', '\\cdot'],
    ['де\u00ADлить на', '/'],
    ['в квад\u00ADра\u00ADте', '^{2}'],
    ['в кубе', '^{3}'],
    ['в сте\u00ADпе\u00ADни', '^'],
    ['ло\u00ADга\u00ADрифм по ос\u00ADно\u00ADва\u00ADнию', '\\log'],
    ['на\u00ADту\u00ADраль\u00ADный ло\u00ADга\u00ADрифм', '\\ln'],
    ['си\u00ADсте\u00ADма вы\u00ADра\u00ADже\u00ADний', ''],
    ['новая стро\u00ADка', ''],
    ['конец си\u00ADсте\u00ADмы', ''],
    ['рав\u00ADно\u00ADсиль\u00ADно', '\\Leftrightarrow'],
    ['боль\u00ADше или равно', '\\geq'],
    ['мень\u00ADше или равно', '\\leq'],
    ['боль\u00ADше', '>'],
    ['мень\u00ADше', '<'],
  ];

  for (const [old, rep] of replacements) {
    text = text.replaceAll(old, rep);
  }

  // Корни N-ой степени: ко­рень N сте­пе­ни из: на­ча­ло ар­гу­мен­та: X конец ар­гу­мен­та
  text = text.replace(
    /ко\u00ADрень\s+(\d+)\s+сте\u00ADпе\u00ADни\s+из:\s*на\u00ADча\u00ADло ар\u00ADгу\u00ADмен\u00ADта:\s*(.*?)\s*конец ар\u00ADгу\u00ADмен\u00ADта/g,
    (_, n, arg) => `\\sqrt[${n}]{${arg.trim()}}`
  );

  // Корни с аргументами: ко­рень из: на­ча­ло ар­гу­мен­та: X конец ар­гу­мен­та
  text = text.replace(
    /ко\u00ADрень из:\s*на\u00ADча\u00ADло ар\u00ADгу\u00ADмен\u00ADта:\s*(.*?)\s*конец ар\u00ADгу\u00ADмен\u00ADта/g,
    (_, arg) => `\\sqrt{${arg.trim()}}`
  );

  // LaTeX sqrt с аргументами: \sqrt: на­ча­ло ар­гу­мен­та: X конец ар­гу­мен­та
  text = text.replace(
    /\\sqrt:\s*на\u00ADча\u00ADло ар\u00ADгу\u00ADмен\u00ADта:\s*(.*?)\s*конец ар\u00ADгу\u00ADмен\u00ADта/g,
    (_, arg) => `\\sqrt{${arg.trim()}}`
  );

  // Простой корень без аргументов
  text = text.replaceAll('ко\u00ADрень из', '\\sqrt');

  // Убираем оставшиеся маркеры аргументов
  text = text.replaceAll('на\u00ADча\u00ADло ар\u00ADгу\u00ADмен\u00ADта:', '');
  text = text.replaceAll('конец ар\u00ADгу\u00ADмен\u00ADта', '');

  // Обработка дробей (рекурсивно, от внутренних к внешним)
  for (let i = 0; i < 10; i++) {
    const fractionRegex = /дробь:\s*чис\u00ADли\u00ADтель:\s*(.*?)\s*,\s*зна\u00ADме\u00ADна\u00ADтель:\s*(.*?)\s*конец дроби/;
    const match = text.match(fractionRegex);
    if (!match) break;
    const numerator = match[1].trim();
    const denominator = match[2].trim();
    text = text.slice(0, match.index) + `\\frac{${numerator}}{${denominator}}` + text.slice(match.index + match[0].length);
  }

  // Убираем множественные пробелы
  text = text.replace(/\s+/g, ' ').trim();

  return text;
}

/**
 * Обработка условия задачи — извлечение текста, формул и изображений
 * Порт process_condition из par.py
 */
function processCondition($, conditionEl) {
  if (!conditionEl) return { text: '', images: [] };

  const images = [];
  let formulaIndex = 0;
  let imgIndex = 0;
  const formulaReplacements = {};
  const imageReplacements = {};

  // Клонируем элемент чтобы не менять оригинал
  const $el = $(conditionEl).clone();

  // Обрабатываем все img
  $el.find('img').each(function () {
    const imgUrl = $(this).attr('src') || '';
    if (!imgUrl) {
      $(this).remove();
      return;
    }

    if (imgUrl.includes('formula') || imgUrl.includes('/formula/')) {
      // SVG формула — берём alt-текст
      const altText = $(this).attr('alt') || '';
      if (altText) {
        const cleanedLatex = cleanLatexFormula(altText);
        const marker = `___FORMULA_${formulaIndex}___`;
        formulaReplacements[marker] = `$${cleanedLatex}$`;
        formulaIndex++;
        $(this).replaceWith(marker);
      } else {
        $(this).remove();
      }
    } else {
      // Обычное изображение (чертёж и т.п.)
      let fullUrl = imgUrl;
      if (!fullUrl.startsWith('http')) {
        fullUrl = new URL(imgUrl, SDAMGIA_BASE_URL).href;
      }
      images.push(fullUrl);
      const marker = `___IMAGE_${imgIndex}___`;
      imageReplacements[marker] = `\n![image](${fullUrl})\n`;
      imgIndex++;
      $(this).replaceWith(marker);
    }
  });

  // Получаем текст с маркерами
  let text = $el.text().replace(/\s+/g, ' ').trim();

  // Заменяем маркеры формул на LaTeX
  for (const [marker, latex] of Object.entries(formulaReplacements)) {
    text = text.replace(marker, ` ${latex} `);
  }

  // Заменяем маркеры изображений на markdown
  for (const [marker, imgMarkdown] of Object.entries(imageReplacements)) {
    text = text.replace(marker, imgMarkdown);
  }

  return { text: text.trim(), images };
}

/**
 * Извлечение данных задачи из div.prob_maindiv
 * Порт parse_problem_from_div из par.py
 */
function parseProblemFromDiv($, probDiv) {
  try {
    const problem = { id: '', condition: '', answer: '', images: [] };

    // ID задачи
    const probNums = $(probDiv).find('.prob_nums');
    if (probNums.length) {
      const link = probNums.find('a');
      if (link.length) {
        problem.id = link.text().trim();
      }
    }

    // Условие задачи
    const pbody = $(probDiv).find('.pbody');
    if (pbody.length) {
      const { text, images } = processCondition($, pbody.get(0));
      problem.condition = text;
      problem.images = images;
    }

    // Ответ
    const answerDiv = $(probDiv).find('.answer');
    if (answerDiv.length) {
      let answerText = answerDiv.text().trim();
      answerText = answerText.replace(/^Ответ:\s*/i, '').replace(/^ответ:\s*/i, '').trim();
      problem.answer = answerText;
    }

    // Проверяем что есть и условие и ответ
    if (!problem.condition || !problem.answer) {
      return null;
    }

    return problem;
  } catch (e) {
    console.error('[Sdamgia] Ошибка парсинга задачи:', e.message);
    return null;
  }
}

/**
 * POST /parse-sdamgia
 * Парсинг задач с sdamgia.ru
 */
app.post('/parse-sdamgia', async (req, res) => {
  const startTime = Date.now();

  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL обязателен' });
    }

    // Валидация URL
    if (!url.includes('sdamgia.ru')) {
      return res.status(400).json({ error: 'URL должен быть с сайта sdamgia.ru' });
    }

    // Добавляем print=true если нет
    let fetchUrl = url;
    if (!fetchUrl.includes('print=true')) {
      fetchUrl += (fetchUrl.includes('?') ? '&' : '?') + 'print=true';
    }

    console.log(`[Sdamgia] Загрузка: ${fetchUrl}`);

    // Загружаем страницу
    const response = await fetch(fetchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      return res.status(502).json({
        error: `Ошибка загрузки: HTTP ${response.status}`,
      });
    }

    const html = await response.text();

    // Парсим HTML через cheerio
    const $ = cheerio.load(html);
    const probDivs = $('.prob_maindiv');

    console.log(`[Sdamgia] Найдено задач на странице: ${probDivs.length}`);

    const problems = [];
    probDivs.each(function () {
      const problem = parseProblemFromDiv($, this);
      if (problem) {
        problems.push(problem);
      }
    });

    const duration = Date.now() - startTime;
    console.log(`[Sdamgia] Распарсено: ${problems.length} задач за ${duration}ms`);

    res.json({
      problems,
      count: problems.length,
      totalOnPage: probDivs.length,
    });

  } catch (error) {
    console.error('[Sdamgia] Ошибка:', error.message);
    res.status(500).json({
      error: 'Ошибка парсинга',
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

/**
 * Lemma backend helper service (Node.js, порт 3001 — systemd pdf-service-ege).
 *
 * НЕ генерирует PDF: серверный Puppeteer/Chromium выпилен. Печать и PDF делаются
 * на клиенте (нативная браузерная печать + html2pdf.js). Этот сервис обслуживает:
 *   • sdamgia-парсер           — /parse-sdamgia, /fetch-image
 *   • LLM-нормализацию LaTeX    — /latex-fix
 *   • семантический поиск задач — /similar, /pairs, /duplicates, /diverse, … (sqlite-vec)
 */

import express from 'express';
import cors from 'cors';
import * as cheerio from 'cheerio';
import { parseSdamgiaHtml, SDAMGIA_BASE_URL } from './sdamgia-lib.mjs';
import { buildFeedbackMessages, cleanFeedback } from './feedback-prompt.mjs';
import { isSdamgiaUrl, safeFetch } from './net-guard.mjs';
import {
  SCAN_BLANK_PROMPT, scanModels, modelsForSlot, shouldTryNext, parseScanReply, extractJson,
} from './scan-blank-lib.mjs';
// Семантический поиск похожих задач (sqlite-vec). Грузим мягко: если модуль/vec.db
// недоступны — сервис всё равно стартует, /similar вернёт 503.
let findSimilar = null, vecHealth = null, getDuplicateClusters = null, findPairs = null, indexVectors = null, buildParallelVariants = null, buildRemediation = null, pruneVectors = null, setClusters = null;
let selectBySeed = null, selectDiverse = null, selectNovelty = null, scoreNovelty = null;
let findSimilarGeometry = null, indexGeometryVectors = null, pruneGeometryVectors = null, findGeometryBankDuplicates = null;
let searchGeometryByText = null, reindexGeometry = null, geoReindexStatus = null;
let getIndexStats = null, findSimilarBatch = null;
try {
  ({ findSimilar, vecHealth, getDuplicateClusters, findPairs, indexVectors, buildParallelVariants, buildRemediation, pruneVectors, setClusters, selectBySeed, selectDiverse, selectNovelty, scoreNovelty, findSimilarGeometry, indexGeometryVectors, pruneGeometryVectors, findGeometryBankDuplicates, searchGeometryByText, reindexGeometry, geoReindexStatus, getIndexStats, findSimilarBatch } = await import('./vec-search.js'));
} catch (e) {
  console.warn('[pdf-service] vec-search недоступен:', e.message);
}
const INDEX_TOKEN = process.env.INDEX_TOKEN || '';
// KaTeX — серверный рендер для валидации формул (latex_needs_review)
let katex = null;
try {
  katex = (await import('katex')).default;
} catch {
  console.warn('[pdf-service] katex недоступен, валидация формул отключена');
}

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// ─── ИИ-гейт (мультиучительство, v3.9.117) ─────────────────────────────────
// LLM-ручки (/latex-fix, /scan-blank) тратят деньги → проверяем токен учителя
// через PocketBase (auth-refresh) и флаг teachers.ai_enabled. Включается
// переменной REQUIRE_TEACHER_AI_AUTH=1 в systemd override; без неё поведение
// прежнее (совместимость с фронтом до v3.9.117, который не шлёт токен).
const REQUIRE_TEACHER_AI_AUTH = process.env.REQUIRE_TEACHER_AI_AUTH === '1';
const PB_URL = process.env.PB_URL || 'http://127.0.0.1:8095';
const aiAuthCache = new Map(); // token → { exp, value }

async function checkTeacherAi(req) {
  const auth = req.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : auth;
  if (!token) return { ok: false, status: 401, error: 'Нужен вход учителя (токен не передан)' };
  const now = Date.now();
  const cached = aiAuthCache.get(token);
  if (cached && cached.exp > now) return cached.value;
  let value;
  try {
    const r = await fetch(`${PB_URL}/api/collections/teachers/auth-refresh`, {
      method: 'POST',
      headers: { Authorization: token },
    });
    if (!r.ok) {
      value = { ok: false, status: 401, error: 'Токен учителя не прошёл проверку' };
    } else {
      const data = await r.json();
      value = data?.record?.ai_enabled === false
        ? { ok: false, status: 403, error: 'ИИ-функции выключены для этого учителя (см. суперадмина)' }
        : { ok: true };
    }
  } catch (e) {
    // PB недоступен — fail-open: не роняем фичу из-за сетевой ошибки проверки
    console.warn('[ai-gate] проверка токена недоступна:', e.message);
    value = { ok: true, degraded: true };
  }
  aiAuthCache.set(token, { exp: now + 5 * 60 * 1000, value });
  if (aiAuthCache.size > 500) aiAuthCache.clear();
  return value;
}

async function aiGate(req, res, next) {
  if (!REQUIRE_TEACHER_AI_AUTH) return next();
  const v = await checkTeacherAi(req);
  if (!v.ok) return res.status(v.status || 401).json({ error: v.error });
  return next();
}

// ============================================================
// SDAMGIA PARSER — сам разбор в sdamgia-lib.mjs (чистый модуль под тестами)
// ============================================================

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

    // Валидация URL: хост sdamgia.ru или поддомен (не «…?sdamgia.ru» в чужой ссылке)
    if (!isSdamgiaUrl(url)) {
      return res.status(400).json({ error: 'URL должен быть с сайта sdamgia.ru' });
    }

    // Добавляем print=true если нет
    let fetchUrl = url;
    if (!fetchUrl.includes('print=true')) {
      fetchUrl += (fetchUrl.includes('?') ? '&' : '?') + 'print=true';
    }
    // crit=true — sdamgia по умолчанию скрывает критерии оценивания (часть 2).
    // Безопасно для части 1 — там блока .prob_crits просто нет.
    if (!fetchUrl.includes('crit=true')) {
      fetchUrl += '&crit=true';
    }

    console.log(`[Sdamgia] Загрузка: ${fetchUrl}`);

    // Загружаем страницу (только публичные адреса, в т. ч. после редиректов)
    const { response, buffer: pageBuf } = await safeFetch(fetchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      return res.status(502).json({
        error: `Ошибка загрузки: HTTP ${response.status}`,
      });
    }

    const html = pageBuf.toString('utf8');

    const baseUrl = (() => { try { const u = new URL(fetchUrl); return u.origin; } catch(e) { return SDAMGIA_BASE_URL; } })();
    const { problems, totalOnPage } = parseSdamgiaHtml(html, { cheerio, katex, baseUrl });

    const duration = Date.now() - startTime;
    console.log(`[Sdamgia] Распарсено: ${problems.length} из ${totalOnPage} задач за ${duration}ms`);

    res.json({
      problems,
      count: problems.length,
      totalOnPage,
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
 * POST /fetch-image
 * Прокси-загрузка картинки (для импорта задач без CORS-зависимости в браузере)
 */
app.post('/fetch-image', async (req, res) => {
  try {
    const { url } = req.body || {};

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'URL обязателен' });
    }

    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      return res.status(400).json({ error: 'Некорректный URL' });
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return res.status(400).json({ error: 'Поддерживаются только http/https URL' });
    }

    // Только публичные адреса (и после редиректов), не больше 20 МБ — иначе
    // ручка была открытым прокси внутрь VPS (аудит 25.10.2026).
    let fetched;
    try {
      fetched = await safeFetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
          Referer: `${parsed.protocol}//${parsed.host}/`,
        },
      });
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
    const { response, buffer } = fetched;

    if (!response.ok) {
      return res.status(502).json({ error: `Ошибка загрузки изображения: HTTP ${response.status}` });
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'no-store');
    return res.send(buffer);
  } catch (error) {
    console.error('[ImageProxy] Ошибка:', error.message);
    return res.status(500).json({ error: 'Ошибка прокси-загрузки изображения', message: error.message });
  }
});

/**
 * POST /latex-fix
 * Нормализация LaTeX-формул через LLM. Дёргается вручную учителем для задач
 * с latex_needs_review=true в предпросмотре импорта. Не вызывается автоматически.
 *
 * Принимает:
 *   { text: string, role?: 'condition'|'solution'|'criteria' }
 *
 * Возвращает:
 *   { text: string, cached: bool }                — успех, исправленный markdown
 *   { error: string }                              — провал
 *
 * Конфиг (env):
 *   TIMEWEB_AI_URL     — endpoint AI gateway (OpenAI-compatible /chat/completions)
 *   TIMEWEB_AI_KEY     — Bearer-токен
 *   TIMEWEB_AI_MODEL   — модель (default: deepseek-chat)
 *
 * Кэш — in-memory, ключ sha256(text). Сбрасывается при рестарте сервиса.
 */
import crypto from 'node:crypto';
const latexFixCache = new Map();
const MAX_CACHE_SIZE = 500;

const LATEX_FIX_SYSTEM_PROMPT = `Ты конвертируешь математические формулы в LaTeX, совместимый с KaTeX-рендерером.

ПРАВИЛА СИНТАКСИСА:
- Аргументы команд (\\sin, \\cos, \\sqrt, \\log, \\frac, \\angle, \\widehat и т.п.) — ВСЕГДА в {фигурных}, не (круглых).
- Многосимвольные индексы/степени — в {фигурных}: x^{12}, a_{ij}, S_{ABC}.
- Десятичная запятая → {,}: 0{,}5.
- Градусы → ^{\\circ}: 30^{\\circ}.
- Русские нотации: \\tg → \\operatorname{tg}, \\ctg → \\operatorname{ctg}, \\arctg → \\operatorname{arctg}.
- Команды БЕЗ \\: sin → \\sin, cos → \\cos.
- НЕ менять смысл формулы. Только синтаксис.

🚨 ОБЁРТКИ ФОРМУЛ — КРИТИЧЕСКИ ВАЖНО:
- Используй ТОЛЬКО долларовые обёртки: \`$...$\` для inline и \`$$...$$\` для блочных формул.
- НИКОГДА не используй \`\\(...\\)\` или \`\\[...\\]\` — KaTeX-рендерер в markdown ИХ НЕ ВИДИТ.
- Если во входе есть \`\\(...\\)\` — замени на \`$...$\`.
- Если во входе есть \`\\[...\\]\` — замени на \`$$...$$\`.
- Если формула уже обёрнута в \`$...$\` — оставь так, не меняй на \`\\(...\\)\`.

ВХОД: markdown-текст задачи/решения с формулами (могут быть в $...$, в \\(...\\), в \\[...\\] или вообще без обёрток).
ВЫХОД: тот же markdown, но ВСЕ формулы обёрнуты ИСКЛЮЧИТЕЛЬНО в $...$ или $$...$$ и сами формулы — валидный KaTeX.
Ничего, кроме исправленного текста. Никаких пояснений, комментариев, преамбул, тройных бэктиков.`;

/**
 * Safety net: если модель всё-таки вернула \\(...\\) или \\[...\\] — конвертируем.
 * Аккуратно: НЕ трогаем экранированные скобки внутри уже корректных $...$ блоков.
 * Подход: проходим по тексту, пропуская содержимое $...$/$$...$$ как есть.
 */
function normalizeLatexDelimiters(text) {
  if (!text || typeof text !== 'string') return text;
  let out = '';
  let i = 0;
  while (i < text.length) {
    // Пропускаем уже корректные $$...$$ блоки
    if (text.startsWith('$$', i)) {
      const end = text.indexOf('$$', i + 2);
      if (end === -1) { out += text.slice(i); break; }
      out += text.slice(i, end + 2);
      i = end + 2;
      continue;
    }
    // Пропускаем корректные $...$ (но не валюту: $5 без закрывающего)
    if (text[i] === '$' && text[i - 1] !== '\\') {
      const end = text.indexOf('$', i + 1);
      if (end === -1 || end - i > 500) { out += text[i]; i++; continue; }
      out += text.slice(i, end + 1);
      i = end + 1;
      continue;
    }
    // \[...\] → $$...$$
    if (text.startsWith('\\[', i)) {
      const end = text.indexOf('\\]', i + 2);
      if (end !== -1) {
        out += '$$' + text.slice(i + 2, end) + '$$';
        i = end + 2;
        continue;
      }
    }
    // \(...\) → $...$
    if (text.startsWith('\\(', i)) {
      const end = text.indexOf('\\)', i + 2);
      if (end !== -1) {
        out += '$' + text.slice(i + 2, end) + '$';
        i = end + 2;
        continue;
      }
    }
    out += text[i];
    i++;
  }
  return out;
}

app.post('/latex-fix', aiGate, async (req, res) => {
  const { text, role } = req.body || {};

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Поле text обязательно (string)' });
  }
  if (text.length > 20000) {
    return res.status(400).json({ error: 'text слишком длинный (>20000 символов)' });
  }

  const aiUrl = process.env.TIMEWEB_AI_URL;
  const aiKey = process.env.TIMEWEB_AI_KEY;
  const aiModel = process.env.TIMEWEB_AI_MODEL || 'deepseek-chat';
  if (!aiUrl || !aiKey) {
    return res.status(503).json({
      error: 'LLM endpoint не настроен на сервере (TIMEWEB_AI_URL / TIMEWEB_AI_KEY)',
    });
  }

  // Кэш по sha256(text)
  const cacheKey = crypto.createHash('sha256').update(text).digest('hex');
  if (latexFixCache.has(cacheKey)) {
    return res.json({ text: latexFixCache.get(cacheKey), cached: true });
  }

  try {
    const llmReq = {
      model: aiModel,
      temperature: 0.2,
      max_tokens: Math.min(4000, Math.ceil(text.length * 1.5)),
      messages: [
        { role: 'system', content: LATEX_FIX_SYSTEM_PROMPT },
        { role: 'user', content: text },
      ],
    };

    const resp = await fetch(aiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${aiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(llmReq),
    });

    if (!resp.ok) {
      const body = await resp.text();
      console.error('[latex-fix] upstream:', resp.status, body.slice(0, 200));
      return res.status(502).json({
        error: `AI gateway HTTP ${resp.status}`,
        details: body.slice(0, 300),
      });
    }

    const data = await resp.json();
    const raw = data?.choices?.[0]?.message?.content?.trim();
    if (!raw) {
      return res.status(502).json({ error: 'AI gateway вернул пустой ответ', upstream: data });
    }

    // Safety net: модель иногда игнорирует промпт и оборачивает формулы
    // в \(...\) / \[...\]. KaTeX-плагин react-markdown их не видит — нормализуем
    // в $...$ / $$...$$ обязательно, даже если промпт нарушен.
    const fixed = normalizeLatexDelimiters(raw);

    // LRU-чистка кэша: если перебрали лимит, удаляем самый старый.
    if (latexFixCache.size >= MAX_CACHE_SIZE) {
      const firstKey = latexFixCache.keys().next().value;
      latexFixCache.delete(firstKey);
    }
    latexFixCache.set(cacheKey, fixed);

    console.log(`[latex-fix] role=${role || '?'} len_in=${text.length} len_out=${fixed.length}`);
    res.json({ text: fixed, cached: false });
  } catch (error) {
    console.error('[latex-fix] error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Модели распознавания фото (бланки, скриншоты «Решу») — env SCAN_BLANK_MODELS /
// SCAN_BLANK_FALLBACK, выбор и разбор ответа — scan-blank-lib.mjs.
const SCAN_MODELS = scanModels(process.env);
const VISION_TIMEOUT_MS = 40_000;

/**
 * Запрос к vision-модели с очередью запасных: модель снята (410), недоступна
 * ключу, шлюз сбоит — спрашиваем следующую. Возвращает { data, model } или
 * { status, error, details } для ответа клиенту.
 */
async function callVision(models, text, dataUrl, tag) {
  const aiUrl = process.env.TIMEWEB_AI_URL;
  const aiKey = process.env.TIMEWEB_AI_KEY;
  if (!aiUrl || !aiKey) {
    return { status: 503, error: 'LLM endpoint не настроен на сервере (TIMEWEB_AI_URL / TIMEWEB_AI_KEY)' };
  }
  const failed = [];
  for (const model of models) {
    let resp;
    try {
      resp = await fetch(aiUrl, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${aiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text },
              { type: 'image_url', image_url: { url: dataUrl } },
            ],
          }],
        }),
        signal: AbortSignal.timeout(VISION_TIMEOUT_MS),
      });
    } catch (error) {
      console.error(`[${tag}] ${model}: ${error.message}`);
      failed.push(`${model}: ${error.name === 'TimeoutError' ? 'таймаут' : error.message}`);
      continue;
    }
    if (resp.ok) {
      if (failed.length) console.warn(`[${tag}] взял ${model} вместо: ${failed.join('; ')}`);
      return { data: await resp.json(), model };
    }
    const body = await resp.text();
    console.error(`[${tag}] ${model}: HTTP ${resp.status}`, body.slice(0, 200));
    failed.push(`${model}: HTTP ${resp.status}`);
    if (!shouldTryNext(resp.status)) {
      return { status: 502, error: `AI gateway HTTP ${resp.status}`, details: body.slice(0, 300) };
    }
  }
  return { status: 502, error: `Модели распознавания недоступны (${failed.join('; ')})` };
}

/**
 * POST /scan-blank
 * Распознавание фото заполненного бланка ответов №1 ЕГЭ через vision-LLM.
 * Клиент читает бланк дважды параллельно (slot 0 и 1) — РАЗНЫМИ моделями:
 * одна модель дважды повторяет свои ошибки, две разные расходятся как раз там,
 * где ошиблась одна из них (сравнение на живых бланках — scan-blank-lib.mjs).
 * Результат ВСЕГДА проходит ручную верификацию учителем на клиенте — ручка не
 * пишет в БД.
 *
 * Принимает:
 *   { image: string (base64 JPEG/PNG, можно с data:-префиксом),
 *     tasks_count?: number (полей в варианте; поля с бОльшими номерами отбрасываются),
 *     slot?: number (какое это прочтение: 0 — первая модель, 1 — вторая) }
 *
 * Возвращает:
 *   { fields: {"1": "17", ...},      — итоговые ответы (замены уже применены,
 *                                      «X»/прочерк — нет ответа)
 *     replacements: [{task, value}], — что было в зоне замены
 *     uncertain: [номера],           — поля, в прочтении которых модель не уверена
 *     model, usage }
 */
app.post('/scan-blank', aiGate, async (req, res) => {
  const { image, tasks_count, slot } = req.body || {};

  if (!image || typeof image !== 'string') {
    return res.status(400).json({ error: 'Поле image обязательно (base64-строка)' });
  }
  // ~14 МБ base64 ≈ 10 МБ файла — фото с телефона, ужатое клиентом, много меньше
  if (image.length > 14_000_000) {
    return res.status(400).json({ error: 'Изображение слишком большое (клиент должен ужимать до ~1600px)' });
  }

  const tasksCount = Number.isInteger(tasks_count) && tasks_count > 0 && tasks_count <= 40
    ? tasks_count : null;
  const dataUrl = image.startsWith('data:') ? image : `data:image/jpeg;base64,${image}`;

  try {
    const call = await callVision(
      modelsForSlot(SCAN_MODELS, Number.isInteger(slot) ? slot : 0),
      SCAN_BLANK_PROMPT(tasksCount), dataUrl, 'scan-blank');
    if (call.error) return res.status(call.status).json({ error: call.error, details: call.details });

    const { data, model } = call;
    const raw = data?.choices?.[0]?.message?.content?.trim();
    if (!raw) {
      return res.status(502).json({ error: 'AI gateway вернул пустой ответ' });
    }
    const result = parseScanReply(raw, tasksCount);
    if (!result) {
      console.error(`[scan-blank] ${model}: не-JSON ответ модели:`, raw.slice(0, 300));
      return res.status(502).json({ error: 'Модель вернула не-JSON', raw: raw.slice(0, 500) });
    }

    const { fields, replacements, uncertain } = result;
    console.log(`[scan-blank] ${model} fields=${Object.keys(fields).length} repl=${replacements.length} uncertain=${uncertain.length} tokens=${data?.usage?.total_tokens ?? '?'}`);
    res.json({ fields, replacements, uncertain, model, usage: data?.usage || null });
  } catch (error) {
    console.error('[scan-blank] error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /scan-task-list
 * Скриншот списка задач «Решу ЕГЭ/ОГЭ» (вариант, подборка, тетрадь) → номера
 * задач по порядку. Нужен импорту работы по номерам Решу: учитель не
 * перепечатывает номера руками. Ручка не пишет в БД — список проверяет учитель.
 *
 * Принимает: { image: string (base64, можно с data:-префиксом) }
 * Возвращает: { items: [{ id: "27455", type: "7" | null }], model, usage }
 */
const SCAN_TASK_LIST_PROMPT = `На изображении — список задач с сайта «Решу ЕГЭ» / «Решу ОГЭ» (вариант, подборка, таблица результатов или просто перечень номеров).

У каждой задачи есть номер в базе сайта — целое число из 3–7 цифр, обычно после знака «№» или в ссылке problem?id=… . Рядом может стоять тип (номер задания в КИМ): «Тип 7», «Задание 12», «Тип Д4» — в поле type пиши только сам номер типа: "7", "12", "Д4".

Выпиши ВСЕ номера задач в том порядке, в котором они идут на изображении (сверху вниз; если колонки — сначала левая колонка целиком). Не путай номер в базе с порядковым номером задачи в варианте (1, 2, 3…), с баллами, процентами и датами.

Верни СТРОГО JSON без пояснений и без markdown-ограждений:
{"items":[{"id":"<номер в базе>","type":"<тип или null>"}]}`;

app.post('/scan-task-list', aiGate, async (req, res) => {
  const { image } = req.body || {};
  if (!image || typeof image !== 'string') {
    return res.status(400).json({ error: 'Поле image обязательно (base64-строка)' });
  }
  if (image.length > 14_000_000) {
    return res.status(400).json({ error: 'Изображение слишком большое (клиент должен ужимать)' });
  }

  const dataUrl = image.startsWith('data:') ? image : `data:image/jpeg;base64,${image}`;

  try {
    // Печатный текст читает любая модель — берём ту же очередь, что у первого
    // прочтения бланка
    const call = await callVision(modelsForSlot(SCAN_MODELS, 0), SCAN_TASK_LIST_PROMPT, dataUrl, 'scan-task-list');
    if (call.error) return res.status(call.status).json({ error: call.error, details: call.details });

    const { data, model } = call;
    const raw = data?.choices?.[0]?.message?.content?.trim();
    if (!raw) return res.status(502).json({ error: 'AI gateway вернул пустой ответ' });

    const parsed = extractJson(raw);
    if (!parsed) {
      console.error('[scan-task-list] не-JSON ответ модели:', raw.slice(0, 300));
      return res.status(502).json({ error: 'Модель вернула не-JSON', raw: raw.slice(0, 500) });
    }

    const items = (Array.isArray(parsed.items) ? parsed.items : [])
      .map((it) => ({
        id: String(it?.id ?? '').replace(/\D/g, ''),
        // Модель иногда отвечает «Тип 19» вместо «19»
        type: it?.type == null || it.type === 'null'
          ? null
          : String(it.type).replace(/^\s*(тип|задание)\s*/i, '').trim() || null,
      }))
      .filter((it) => /^\d{3,7}$/.test(it.id));

    console.log(`[scan-task-list] ${model} items=${items.length} tokens=${data?.usage?.total_tokens ?? '?'}`);
    res.json({ items, model, usage: data?.usage || null });
  } catch (error) {
    console.error('[scan-task-list] error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /health
 * Health check
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'lemma-backend-helper',
    features: ['sdamgia-parser', 'latex-fix', 'vec-search', 'scan-blank', 'scan-task-list'],
    timestamp: new Date().toISOString(),
  });
});

/**
 * POST /similar — похожие задачи (sqlite-vec).
 * body: { task_id, limit?, same_topic_only?, min_cos? }
 */
app.post('/similar', (req, res) => {
  if (!findSimilar) return res.status(503).json({ error: 'vec-search не инициализирован' });
  const { task_id, limit, same_topic_only, min_cos } = req.body || {};
  if (!task_id) return res.status(400).json({ error: 'task_id обязателен' });
  try {
    const r = findSimilar({
      taskId: task_id,
      limit: Number(limit) || 8,
      sameTopicOnly: same_topic_only !== false,
      minCos: Number(min_cos) || 0,
    });
    res.json(r);
  } catch (e) {
    console.error('[similar]', e.message);
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /similar/health — состояние индекса
 */
app.get('/similar/health', (req, res) => {
  if (!vecHealth) return res.status(503).json({ ok: false, error: 'vec-search не инициализирован' });
  res.json(vecHealth());
});

/**
 * POST /geo/similar — похожие ГЕОМЕТРИЧЕСКИЕ задачи (vec_geometry ⋈ geometry_tasks).
 * body: { task_id, limit?, min_cos?, origin? ('manual'|'mccme') }
 */
app.post('/geo/similar', (req, res) => {
  if (!findSimilarGeometry) return res.status(503).json({ error: 'vec-search не инициализирован' });
  const { task_id, limit, min_cos, origin } = req.body || {};
  if (!task_id) return res.status(400).json({ error: 'task_id обязателен' });
  try {
    const r = findSimilarGeometry({
      taskId: task_id,
      limit: Number(limit) || 8,
      minCos: Number(min_cos) || 0,
      origin: origin === 'manual' || origin === 'mccme' ? origin : null,
    });
    res.json(r);
  } catch (e) {
    console.error('[geo/similar]', e.message);
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /intensive-feedback (v3.9.243)
 * Черновик обратной связи ученику по итогам интенсива в стиле кафедры.
 * Принимает { student: {...}, examples?: string } — данные ученика БЕЗ имён
 * (пол, дни, работы с описаниями и средним по группе, зачёт, итог, рейтинг,
 * сильные/слабые стороны) и образцы стиля учителя. Возвращает { text } с
 * токеном {ИМЯ} вместо обращения — имя подставляет клиент. В БД не пишет:
 * черновик правит и сохраняет учитель. Промпт — `feedback-prompt.mjs`.
 * Модель — FEEDBACK_MODEL, иначе TIMEWEB_AI_MODEL (без «рассуждений»:
 * лимит токенов тесный).
 */
app.post('/intensive-feedback', aiGate, async (req, res) => {
  const { student, examples } = req.body || {};
  if (!student || typeof student !== 'object') {
    return res.status(400).json({ error: 'Поле student обязательно (object)' });
  }
  const aiUrl = process.env.TIMEWEB_AI_URL;
  const aiKey = process.env.TIMEWEB_AI_KEY;
  const aiModel = process.env.FEEDBACK_MODEL || process.env.TIMEWEB_AI_MODEL || 'deepseek-chat';
  if (!aiUrl || !aiKey) {
    return res.status(503).json({ error: 'LLM endpoint не настроен на сервере (TIMEWEB_AI_URL / TIMEWEB_AI_KEY)' });
  }
  try {
    const resp = await fetch(aiUrl, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${aiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: aiModel,
        temperature: 0.6,
        max_tokens: 600,
        messages: buildFeedbackMessages(student, typeof examples === 'string' ? examples : ''),
      }),
      signal: AbortSignal.timeout(60000),
    });
    if (!resp.ok) {
      const body = await resp.text();
      console.error('[intensive-feedback] upstream:', resp.status, body.slice(0, 200));
      return res.status(502).json({ error: `AI gateway HTTP ${resp.status}` });
    }
    const data = await resp.json();
    const text = cleanFeedback(data?.choices?.[0]?.message?.content, student);
    if (!text) return res.status(502).json({ error: 'AI gateway вернул пустой ответ' });
    console.log(`[intensive-feedback] model=${aiModel} len=${text.length}`);
    res.json({ text, model: aiModel, usage: data?.usage || null });
  } catch (error) {
    console.error('[intensive-feedback] error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /geo/search — поиск геометрических задач по запросу на естественном
 * языке (эмбеддинг запроса через AI gateway → KNN по vec_geometry).
 * Гейтится токеном учителя (aiGate) — каждый запрос дёргает платный API.
 * body: { query, limit?, origin? ('manual'|'mccme'), min_cos? }
 */
app.post('/geo/search', aiGate, async (req, res) => {
  if (!searchGeometryByText) return res.status(503).json({ error: 'vec-search не инициализирован' });
  const { query, limit, origin, min_cos } = req.body || {};
  if (!query || !String(query).trim()) return res.status(400).json({ error: 'query обязателен' });
  try {
    res.json(await searchGeometryByText({
      query: String(query).slice(0, 500),
      limit: Math.min(Math.max(Number(limit) || 12, 1), 50),
      origin: origin === 'manual' || origin === 'mccme' ? origin : null,
      minCos: Number(min_cos) || 0.2,
    }));
  } catch (e) {
    console.error('[geo/search]', e.message);
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /geo/reindex — запустить серверную переиндексацию геометрии
 * (эмбеддинги через AI gateway, фоновая job). Защита X-Index-Token.
 * body: { full? }  ·  прогресс: GET /geo/reindex/status
 */
app.post('/geo/reindex', (req, res) => {
  if (!reindexGeometry) return res.status(503).json({ error: 'vec-search не инициализирован' });
  if (INDEX_TOKEN && req.get('X-Index-Token') !== INDEX_TOKEN) return res.status(401).json({ error: 'неверный токен' });
  try {
    res.json(reindexGeometry({ full: !!(req.body || {}).full }));
  } catch (e) {
    console.error('[geo/reindex]', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get('/geo/reindex/status', (req, res) => {
  if (!geoReindexStatus) return res.status(503).json({ error: 'vec-search не инициализирован' });
  if (INDEX_TOKEN && req.get('X-Index-Token') !== INDEX_TOKEN) return res.status(401).json({ error: 'неверный токен' });
  res.json(geoReindexStatus());
});

/**
 * POST /geo/duplicates — дедуп «мои ↔ банк МЦНМО»: пары похожих задач
 * (своя задача × ближайшие соседи из банка). Считается на лету.
 * body: { min_cos?, per_task? }
 */
app.post('/geo/duplicates', async (req, res) => {
  if (!findGeometryBankDuplicates) return res.status(503).json({ error: 'vec-search не инициализирован' });
  const { min_cos, per_task } = req.body || {};
  try {
    res.json(await findGeometryBankDuplicates({
      minCos: Math.min(Math.max(Number(min_cos) || 0.82, 0.5), 0.999),
      perTask: Math.min(Math.max(Number(per_task) || 3, 1), 10),
    }));
  } catch (e) {
    console.error('[geo/duplicates]', e.message);
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /geo/index-vectors — заливка векторов геометрии (счёт на Mac → VPS).
 * Защита X-Index-Token. body: { vectors: [{task_id, vec, text_hash}] }
 */
app.post('/geo/index-vectors', (req, res) => {
  if (!indexGeometryVectors) return res.status(503).json({ error: 'vec-search не инициализирован' });
  if (INDEX_TOKEN && req.get('X-Index-Token') !== INDEX_TOKEN) {
    return res.status(401).json({ error: 'неверный токен' });
  }
  const { vectors } = req.body || {};
  if (!Array.isArray(vectors) || vectors.length === 0) return res.json({ indexed: 0 });
  try {
    res.json(indexGeometryVectors(vectors));
  } catch (e) {
    console.error('[geo/index-vectors]', e.message);
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /geo/prune-vectors — прунинг осиротевших векторов геометрии.
 * Защита X-Index-Token. body: { valid_task_ids: [...] }
 */
app.post('/geo/prune-vectors', (req, res) => {
  if (!pruneGeometryVectors) return res.status(503).json({ error: 'vec-search не инициализирован' });
  if (INDEX_TOKEN && req.get('X-Index-Token') !== INDEX_TOKEN) return res.status(401).json({ error: 'неверный токен' });
  const { valid_task_ids } = req.body || {};
  if (!Array.isArray(valid_task_ids) || valid_task_ids.length === 0) return res.status(400).json({ error: 'valid_task_ids обязателен' });
  try {
    res.json(pruneGeometryVectors(valid_task_ids));
  } catch (e) {
    console.error('[geo/prune-vectors]', e.message);
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /index-vectors — инкрементальная заливка векторов (счёт на Mac → VPS).
 * Защита токеном X-Index-Token (если INDEX_TOKEN задан в env).
 * body: { vectors: [{task_id, vec, text_hash}] }
 */
app.post('/index-vectors', (req, res) => {
  if (!indexVectors) return res.status(503).json({ error: 'vec-search не инициализирован' });
  if (INDEX_TOKEN && req.get('X-Index-Token') !== INDEX_TOKEN) {
    return res.status(401).json({ error: 'неверный токен' });
  }
  const { vectors } = req.body || {};
  if (!Array.isArray(vectors) || vectors.length === 0) return res.json({ indexed: 0 });
  try {
    res.json(indexVectors(vectors));
  } catch (e) {
    console.error('[index-vectors]', e.message);
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /remediation — «работа над ошибками» (C4): похожие к проваленным.
 * body: { failed_task_ids: [...], per_task?, exclude_ids?, min_cos?, max_cos? }
 */
app.post('/remediation', (req, res) => {
  if (!buildRemediation) return res.status(503).json({ error: 'vec-search не инициализирован' });
  const { failed_task_ids, per_task, exclude_ids, min_cos, max_cos } = req.body || {};
  if (!Array.isArray(failed_task_ids) || failed_task_ids.length === 0) return res.status(400).json({ error: 'failed_task_ids обязателен' });
  try {
    res.json(buildRemediation(failed_task_ids, {
      perTask: Math.min(Math.max(Number(per_task) || 2, 1), 5),
      excludeIds: Array.isArray(exclude_ids) ? exclude_ids : [],
      minCos: min_cos != null ? Number(min_cos) : 0.70,
      maxCos: max_cos != null ? Number(max_cos) : 0.97,
    }));
  } catch (e) {
    console.error('[remediation]', e.message);
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /similar-batch — похожие сразу для набора задач (A1 «Дополнить похожими»).
 * body: { task_ids:[...], limit?, same_topic_only?, min_cos?, exclude_task_ids? }
 */
app.post('/similar-batch', async (req, res) => {
  if (!findSimilarBatch) return res.status(503).json({ error: 'vec-search не инициализирован' });
  const { task_ids, limit, same_topic_only, min_cos, exclude_task_ids } = req.body || {};
  if (!Array.isArray(task_ids) || task_ids.length === 0) return res.status(400).json({ error: 'task_ids обязателен' });
  try {
    res.json(await findSimilarBatch(task_ids.slice(0, 100), {
      limit: Math.min(Math.max(Number(limit) || 3, 1), 20),
      sameTopicOnly: same_topic_only !== false,
      minCos: min_cos != null ? Number(min_cos) : 0,
      excludeIds: Array.isArray(exclude_task_ids) ? exclude_task_ids : [],
    }));
  } catch (e) {
    console.error('[similar-batch]', e.message);
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /vec-stats — состояние семантического индекса (сколько задач проиндексировано,
 * когда обновлялся). Индексация ручная, поэтому фронту нужно уметь объяснить
 * учителю разрыв между каталогом и индексом.
 */
app.get('/vec-stats', (req, res) => {
  if (!getIndexStats) return res.status(503).json({ error: 'vec-search не инициализирован' });
  try {
    res.json(getIndexStats());
  } catch (e) {
    console.error('[vec-stats]', e.message);
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /parallel-variants — семейство параллельных вариантов «по образцу» (A4).
 * body: { task_ids: [...базовый набор], count?, min_cos?, max_cos?, exclude_task_ids?, reject_pairs?, structural? }
 */
app.post('/parallel-variants', async (req, res) => {
  if (!buildParallelVariants) return res.status(503).json({ error: 'vec-search не инициализирован' });
  const { task_ids, count, min_cos, max_cos, exclude_task_ids, reject_pairs, structural } = req.body || {};
  if (!Array.isArray(task_ids) || task_ids.length === 0) return res.status(400).json({ error: 'task_ids обязателен' });
  try {
    res.json(await buildParallelVariants(task_ids, {
      count: Math.min(Math.max(Number(count) || 2, 1), 5),
      minCos: min_cos != null ? Number(min_cos) : 0.85,
      maxCos: max_cos != null ? Number(max_cos) : 0.995,
      excludeIds: Array.isArray(exclude_task_ids) ? exclude_task_ids : [],
      rejectPairs: reject_pairs && typeof reject_pairs === 'object' ? reject_pairs : null,
      structural: structural !== false,
    }));
  } catch (e) {
    console.error('[parallel-variants]', e.message);
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /seed-select — режим «по образцу» для Генератора (v3.9.41).
 * body: { task_id, count?, similarity? (0..1), same_topic_only? }
 */
app.post('/seed-select', (req, res) => {
  if (!selectBySeed) return res.status(503).json({ error: 'vec-search не инициализирован' });
  const { task_id, count, similarity, same_topic_only, allowed_task_ids } = req.body || {};
  if (!task_id) return res.status(400).json({ error: 'task_id обязателен' });
  try {
    res.json(selectBySeed({
      taskId: task_id,
      count: Math.min(Math.max(Number(count) || 20, 1), 200),
      similarity: similarity != null ? Math.min(Math.max(Number(similarity), 0), 1) : 0.5,
      sameTopicOnly: same_topic_only !== false,
      allowedIds: Array.isArray(allowed_task_ids) ? allowed_task_ids : null,
    }));
  } catch (e) {
    console.error('[seed-select]', e.message);
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /diverse — режим «разные сюжеты» (v3.9.41).
 * body: { topic_id, subtopic_id?, count?, method? ('mmr'|'clusters') }
 */
app.post('/diverse', (req, res) => {
  if (!selectDiverse) return res.status(503).json({ error: 'vec-search не инициализирован' });
  const { topic_id, subtopic_id, count, method, allowed_task_ids } = req.body || {};
  if (!topic_id) return res.status(400).json({ error: 'topic_id обязателен' });
  try {
    res.json(selectDiverse({
      topicId: topic_id,
      subtopicId: subtopic_id || null,
      count: Math.min(Math.max(Number(count) || 20, 1), 200),
      method: method === 'clusters' ? 'clusters' : 'mmr',
      allowedIds: Array.isArray(allowed_task_ids) ? allowed_task_ids : null,
    }));
  } catch (e) {
    console.error('[diverse]', e.message);
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /novelty — режим «анти-дубль» к ранее выданной работе (v3.9.41).
 * body: { topic_id, subtopic_id?, count?, avoid_task_ids:[...], max_cos? }
 */
app.post('/novelty', (req, res) => {
  if (!selectNovelty) return res.status(503).json({ error: 'vec-search не инициализирован' });
  const { topic_id, subtopic_id, count, avoid_task_ids, max_cos, allowed_task_ids } = req.body || {};
  if (!topic_id) return res.status(400).json({ error: 'topic_id обязателен' });
  try {
    res.json(selectNovelty({
      topicId: topic_id,
      subtopicId: subtopic_id || null,
      count: Math.min(Math.max(Number(count) || 20, 1), 200),
      avoidTaskIds: Array.isArray(avoid_task_ids) ? avoid_task_ids : [],
      maxCos: max_cos != null ? Math.min(Math.max(Number(max_cos), 0), 1) : 0.85,
      allowedIds: Array.isArray(allowed_task_ids) ? allowed_task_ids : null,
    }));
  } catch (e) {
    console.error('[novelty]', e.message);
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /novelty-score — «насколько свежий набор» относительно прошлых работ (v3.9.41).
 * body: { task_ids:[...сгенерированный набор], ref_task_ids:[...задачи последних работ] }
 */
app.post('/novelty-score', (req, res) => {
  if (!scoreNovelty) return res.status(503).json({ error: 'vec-search не инициализирован' });
  const { task_ids, ref_task_ids } = req.body || {};
  if (!Array.isArray(task_ids) || task_ids.length === 0) return res.status(400).json({ error: 'task_ids обязателен' });
  try {
    res.json(scoreNovelty({
      taskIds: task_ids,
      refTaskIds: Array.isArray(ref_task_ids) ? ref_task_ids : [],
    }));
  } catch (e) {
    console.error('[novelty-score]', e.message);
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /prune-vectors — удалить осиротевшие векторы (нет задачи в PB).
 * Защита X-Index-Token. body: { valid_task_ids: [...] }
 */
app.post('/prune-vectors', (req, res) => {
  if (!pruneVectors) return res.status(503).json({ error: 'vec-search не инициализирован' });
  if (INDEX_TOKEN && req.get('X-Index-Token') !== INDEX_TOKEN) return res.status(401).json({ error: 'неверный токен' });
  const { valid_task_ids } = req.body || {};
  if (!Array.isArray(valid_task_ids) || valid_task_ids.length === 0) return res.status(400).json({ error: 'valid_task_ids обязателен' });
  try {
    res.json(pruneVectors(valid_task_ids));
  } catch (e) {
    console.error('[prune-vectors]', e.message);
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /pairs — похожие пары внутри набора задач (A2).
 * body: { task_ids: [...], min_cos? }
 */
app.post('/pairs', (req, res) => {
  if (!findPairs) return res.status(503).json({ error: 'vec-search не инициализирован' });
  const { task_ids, min_cos } = req.body || {};
  if (!Array.isArray(task_ids) || task_ids.length < 2) return res.json({ pairs: [], missing: [] });
  try {
    res.json(findPairs(task_ids, Number(min_cos) || 0.7));
  } catch (e) {
    console.error('[pairs]', e.message);
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /upload-clusters — принять готовые дедуп-кластеры (посчитаны на Mac).
 * Защита X-Index-Token. Лёгкая операция (запись файла + кэш).
 * body: { clusters: [{type, ids}] }
 */
app.post('/upload-clusters', (req, res) => {
  if (!setClusters) return res.status(503).json({ error: 'vec-search не инициализирован' });
  if (INDEX_TOKEN && req.get('X-Index-Token') !== INDEX_TOKEN) return res.status(401).json({ error: 'неверный токен' });
  const { clusters } = req.body || {};
  if (!Array.isArray(clusters)) return res.status(400).json({ error: 'clusters обязателен (массив)' });
  try {
    res.json(setClusters(clusters));
  } catch (e) {
    console.error('[upload-clusters]', e.message);
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /duplicates — дедуп-кластеры на ревью (B2).
 * query: type (exact_dup|param_family), page, perPage
 */
app.get('/duplicates', (req, res) => {
  if (!getDuplicateClusters) return res.status(503).json({ error: 'vec-search не инициализирован' });
  try {
    const r = getDuplicateClusters({
      type: req.query.type === 'param_family' ? 'param_family' : 'exact_dup',
      page: Number(req.query.page) || 1,
      perPage: Math.min(Number(req.query.perPage) || 20, 50),
    });
    res.json(r);
  } catch (e) {
    console.error('[duplicates]', e.message);
    res.status(500).json({ error: e.message });
  }
});

/**
 * Shutdown handler
 */
process.on('SIGINT', () => {
  console.log('\n[pdf-service] Завершение работы...');
  process.exit(0);
});

/**
 * Запуск сервера
 */
app.listen(PORT, () => {
  console.log(`[PDF] Сервис запущен на http://localhost:${PORT}`);
  console.log(`[PDF] Health check: http://localhost:${PORT}/health`);
});

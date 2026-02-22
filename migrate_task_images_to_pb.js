#!/usr/bin/env node
const fs = require('fs/promises');
const path = require('path');

const PB_URL = (process.env.PB_URL || process.env.VITE_PB_URL || 'https://task-ege.oipav.ru').replace(/\/+$/, '');
const PB_EMAIL = process.env.PB_SUPERUSER_EMAIL || '';
const PB_PASSWORD = process.env.PB_SUPERUSER_PASSWORD || '';
const CACHE_DIR = process.env.TASK_IMAGE_CACHE_DIR || path.resolve(process.cwd(), 'task-image-cache');
const APPLY = process.argv.includes('--apply');
const LIMIT_ARG = process.argv.find((arg) => arg.startsWith('--limit='));
const LIMIT = LIMIT_ARG ? Number(LIMIT_ARG.split('=')[1]) : null;

const IMAGE_FILTER = 'has_image = true && image_url != ""';

function ensureEnv() {
  if (!PB_EMAIL || !PB_PASSWORD) {
    throw new Error(
      'Укажите PB_SUPERUSER_EMAIL и PB_SUPERUSER_PASSWORD в окружении.'
    );
  }
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || ''));
}

function sanitizeFilePart(value) {
  return String(value || '').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
}

function extFromContentType(contentType) {
  const ct = String(contentType || '').toLowerCase();
  if (ct.includes('png')) return 'png';
  if (ct.includes('jpeg') || ct.includes('jpg')) return 'jpg';
  if (ct.includes('webp')) return 'webp';
  if (ct.includes('gif')) return 'gif';
  if (ct.includes('svg')) return 'svg';
  return '';
}

function extFromUrl(url) {
  try {
    const pathname = new URL(url).pathname;
    const match = pathname.match(/\.([a-zA-Z0-9]{2,5})$/);
    return match ? match[1].toLowerCase() : '';
  } catch {
    return '';
  }
}

async function pbAuth() {
  const response = await fetch(`${PB_URL}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: PB_EMAIL, password: PB_PASSWORD }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Ошибка авторизации PocketBase: HTTP ${response.status}: ${text}`);
  }

  const data = await response.json();
  return data.token;
}

async function pbFetchTasks(token) {
  const result = [];
  let page = 1;
  const perPage = 200;

  while (true) {
    const params = new URLSearchParams({
      page: String(page),
      perPage: String(perPage),
      filter: IMAGE_FILTER,
      fields: 'id,code,image,image_url,has_image',
      sort: 'code',
    });

    const response = await fetch(`${PB_URL}/api/collections/tasks/records?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Ошибка чтения задач: HTTP ${response.status}: ${text}`);
    }

    const data = await response.json();
    const items = data.items || [];
    result.push(...items);

    if (page >= (data.totalPages || 1)) break;
    page += 1;
  }

  return result;
}

async function downloadImage(url) {
  const parsed = new URL(url);
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
      Referer: `${parsed.protocol}//${parsed.host}/`,
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || 'application/octet-stream';
  const arrayBuffer = await response.arrayBuffer();
  return { buffer: Buffer.from(arrayBuffer), contentType };
}

async function updateTaskImage(token, taskId, fileBuffer, contentType, filename) {
  const form = new FormData();
  form.append('image', new Blob([fileBuffer], { type: contentType }), filename);
  form.append('has_image', 'true');
  form.append('image_url', '');

  const response = await fetch(`${PB_URL}/api/collections/tasks/records/${taskId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }

  return response.json();
}

async function main() {
  ensureEnv();
  await fs.mkdir(CACHE_DIR, { recursive: true });

  const token = await pbAuth();
  const allCandidates = await pbFetchTasks(token);
  const candidates = allCandidates
    .filter((t) => isHttpUrl(t.image_url))
    .filter((t) => !t.image);
  const tasks = LIMIT ? candidates.slice(0, LIMIT) : candidates;

  console.log(`Найдено задач с внешними картинками (без локального файла): ${candidates.length}`);
  if (!APPLY) {
    console.log('Режим dry-run (без изменений). Для выполнения миграции добавьте --apply');
    return;
  }

  let migrated = 0;
  let failed = 0;

  for (let i = 0; i < tasks.length; i += 1) {
    const task = tasks[i];
    const label = `${i + 1}/${tasks.length} ${task.code || task.id}`;

    try {
      const { buffer, contentType } = await downloadImage(task.image_url);
      const ext = extFromContentType(contentType) || extFromUrl(task.image_url) || 'png';
      const filename = `${sanitizeFilePart(task.code || task.id)}_${task.id}.${ext}`;
      const cachePath = path.join(CACHE_DIR, filename);
      await fs.writeFile(cachePath, buffer);

      await updateTaskImage(token, task.id, buffer, contentType, filename);
      migrated += 1;
      console.log(`✅ ${label} — migrated`);
    } catch (error) {
      failed += 1;
      console.log(`❌ ${label} — ${error.message}`);
    }
  }

  console.log('');
  console.log('Итог миграции:');
  console.log(`  migrated: ${migrated}`);
  console.log(`  failed:   ${failed}`);
  console.log(`  cache:    ${CACHE_DIR}`);
}

main().catch((error) => {
  console.error('Ошибка:', error.message);
  process.exit(1);
});

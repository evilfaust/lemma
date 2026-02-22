#!/usr/bin/env node
/**
 * Переносит PNG-чертежи геометрических задач из текстового base64-поля
 * geogebra_image_base64 в файловое поле PocketBase drawing_image.
 *
 * Запуск:
 *   PB_EMAIL=xxx PB_PASSWORD=yyy node scripts/migrate-geometry-images.mjs
 *
 * Идемпотентен: задачи с уже заполненным drawing_image пропускаются.
 * После успешного переноса очищает geogebra_image_base64 (→ '').
 */

import PocketBase from '../ege-tasks/node_modules/pocketbase/dist/pocketbase.es.mjs';

const PB_URL = process.env.PB_URL || 'https://task-ege.oipav.ru';
const email = process.env.PB_EMAIL;
const password = process.env.PB_PASSWORD;

if (!email || !password) {
  console.error('Нужны переменные окружения: PB_EMAIL и PB_PASSWORD');
  process.exit(1);
}

function base64ToFile(dataUrl, filename) {
  const raw = dataUrl.replace(/^data:image\/\w+;base64,/, '');
  const binary = Buffer.from(raw, 'base64');
  return new File([binary], filename, { type: 'image/png' });
}

async function main() {
  const pb = new PocketBase(PB_URL);

  // Авторизуемся как superuser
  await pb.collection('_superusers').authWithPassword(email, password);
  console.log(`✓ Авторизован как ${email}`);

  // Получаем только нужные поля (не тянем heavy base64 для всех задач)
  const tasks = await pb.collection('geometry_tasks').getFullList({
    fields: 'id,code,drawing_image,geogebra_image_base64',
    sort: 'code',
  });

  console.log(`Найдено задач: ${tasks.length}\n`);

  let ok = 0;
  let skip = 0;
  let fail = 0;

  for (const task of tasks) {
    const label = task.code || task.id;

    if (task.drawing_image) {
      console.log(`  ПРОПУСК  ${label} — drawing_image уже есть`);
      skip++;
      continue;
    }

    if (!task.geogebra_image_base64) {
      console.log(`  ПРОПУСК  ${label} — нет PNG`);
      skip++;
      continue;
    }

    try {
      const file = base64ToFile(task.geogebra_image_base64, 'drawing.png');
      await pb.collection('geometry_tasks').update(task.id, {
        drawing_image: file,
        geogebra_image_base64: '', // очищаем старое поле
      });
      console.log(`  ОК       ${label}`);
      ok++;
    } catch (err) {
      console.error(`  ОШИБКА   ${label}: ${err.message}`);
      fail++;
    }
  }

  console.log(`\n─────────────────────────────`);
  console.log(`Перенесено:  ${ok}`);
  console.log(`Пропущено:   ${skip}`);
  console.log(`С ошибкой:   ${fail}`);
  console.log(`─────────────────────────────`);

  if (fail > 0) process.exit(1);
}

main().catch((err) => {
  console.error('\nКритическая ошибка:', err.message);
  process.exit(1);
});

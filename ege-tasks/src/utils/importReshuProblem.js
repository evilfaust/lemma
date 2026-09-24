// Импорт задач с «Решу ЕГЭ/ОГЭ» в банк Лемма поштучно: для on-demand связки
// внешних результатов с задачами Лемме (ExternalThematic) и для работы по
// номерам Решу (useReshuWorkImport). Переиспользует серверный парсер + born-local.
import { api } from '../shared/services/pocketbase';
import { parseSdamgiaResult } from './markdownTaskParser';
import { rewriteImageUrls } from '../components/TaskStatementRenderer';

const PDF = import.meta.env.VITE_PDF_SERVICE_URL || '/pdf';

async function fetchImageAsFile(url, name) {
  const resp = await fetch(`${PDF}/fetch-image`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  if (!resp.ok) return null;
  const blob = await resp.blob();
  if (!blob.size) return null;
  const ext = (blob.type.split('/')[1] || 'png').replace('+xml', '');
  return new File([blob], `${name}.${ext}`, { type: blob.type || 'image/png' });
}

/** PocketBase не принимает null в number-полях — такие ключи не отправляем. */
function toFormData(data, imageFile) {
  const fd = new FormData();
  Object.entries(data).forEach(([key, value]) => {
    if (value === null || value === undefined) return;
    fd.append(key, value);
  });
  fd.append('image', imageFile);
  return fd;
}

/**
 * Страница Решу (одна задача, вариант, подборка) → задачи в сыром виде сервера
 * `/parse-sdamgia`: `{ id, type_label, condition, answer, …_images }`.
 */
export async function fetchSdamgiaProblems(url) {
  const resp = await fetch(`${PDF}/parse-sdamgia`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  if (!resp.ok) {
    let msg = 'Парсер Решу недоступен';
    try { msg = (await resp.json()).error || msg; } catch { /* не-JSON */ }
    throw new Error(msg);
  }
  const data = await resp.json();
  return data.problems || [];
}

/**
 * Создать задачу банка из разобранной задачи Решу: картинки качаются через
 * прокси (одна картинка условия → legacy-поле `image`, как в «Импорте задач»),
 * всё остальное → `task_images`, затем markdown переписывается на локальные
 * ссылки («роды локальными»).
 *
 * @param {object} p
 * @param {object} p.problem   — задача из `fetchSdamgiaProblems`
 * @param {string} p.topicId
 * @param {string} p.code      — код задачи (считает вызывающий: он знает занятые коды темы)
 * @param {string} p.sourceType — ключ SDAMGIA_SOURCE_LABELS (ege_base / ege_prof / oge)
 * @param {number} [p.examPart=1]
 * @param {string|number} [p.taskNumber]
 * @param {string} [p.fallbackUrl] — ссылка на задачу, если парсер её не отдал
 */
export async function createTaskFromSdamgia({
  problem, topicId, code, sourceType = 'ege_base', examPart = 1, taskNumber = '', fallbackUrl = '',
}) {
  const parsed = parseSdamgiaResult([problem], {
    taskNumber, sourceType, examPart, difficulty: '1',
  });
  const task = parsed.tasks[0];
  if (!task || !task.statement_md) throw new Error('Пустой результат парсинга');

  // Мультикартиночное условие рисуется инлайн — отдельное поле задвоило бы первую картинку
  const multiImage = (task.condition_images?.length || 0) >= 2;
  let imageFile = null;
  if (!multiImage && task.imageUrl) {
    imageFile = await fetchImageAsFile(task.imageUrl, `task_${code}`).catch(() => null);
  }

  const payload = {
    code,
    topic: topicId,
    difficulty: task.difficulty || '1',
    statement_md: task.statement_md,
    answer: task.answer || '',
    solution_md: task.solution_md || '',
    explanation_md: '',
    criteria_md: task.criteria_md || '',
    max_score: task.max_score ?? undefined,
    source: parsed.metadata.source || '',
    year: parsed.metadata.year || undefined,
    has_image: multiImage ? false : Boolean(task.imageUrl),
    // Не удалось скачать картинку — остаётся внешняя ссылка, задача всё равно создаётся
    image_url: multiImage || imageFile ? '' : (task.imageUrl || ''),
    sdamgia_id: task.sdamgiaId || String(problem.id || ''),
    sdamgia_url: task.sdamgia_url || fallbackUrl,
    exam_part: examPart,
    latex_needs_review: !!task.latex_needs_review,
  };
  const created = await api.createTask(imageFile ? toFormData(payload, imageFile) : payload);

  // Картинки → task_images (через прокси), затем born-local rewrite md.
  const roles = [
    ['condition', task.condition_images || []],
    ['solution', task.solution_images || []],
    ['criteria', task.criteria_images || []],
  ];
  const uploaded = [];
  for (const [role, imgs] of roles) {
    for (const img of imgs) {
      try {
        const f = await fetchImageAsFile(img.url, img.file_id || `${role}_${img.order || 1}`);
        if (!f) continue;
        const rec = await api.createTaskImage({
          task: created.id, role, order: img.order,
          fileBlob: f, fileName: f.name,
          sdamgia_file_id: img.file_id, original_url: img.url,
        });
        if (rec) uploaded.push(rec);
      } catch (e) {
        console.warn('[importReshu] image:', e?.message);
      }
    }
  }
  if (uploaded.length) {
    const patch = {};
    for (const field of ['statement_md', 'solution_md', 'criteria_md']) {
      const src = created[field];
      if (!src) continue;
      const next = rewriteImageUrls(src, uploaded);
      if (next !== src) patch[field] = next;
    }
    if (Object.keys(patch).length) {
      const upd = await api.updateTask(created.id, patch);
      return upd || created;
    }
  }
  return created;
}

// problemId — решу id; taskNumber — № задания (1..21); topicId — тема ege_base.
export async function importReshuProblem({ problemId, taskNumber, topicId }) {
  const url = `https://mathb-ege.sdamgia.ru/problem?id=${problemId}`;
  const probs = await fetchSdamgiaProblems(url);
  if (!probs.length) throw new Error('Задача не найдена на решу');
  return createTaskFromSdamgia({
    problem: probs[0],
    topicId,
    code: `${taskNumber}-r${problemId}`,
    sourceType: 'ege_base',
    examPart: 1,
    taskNumber,
    fallbackUrl: url,
  });
}

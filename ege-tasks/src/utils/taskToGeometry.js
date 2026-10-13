/**
 * Задача обычного банка (`tasks`) → запись раздела «Геометрия»
 * (`geometry_tasks`). Чистая логика без сети: ею живут кнопка «В геометрию»
 * в карточке задачи и массовый перенос из списка задач.
 *
 * Картинки. У задачи их бывает два вида:
 *  - legacy `tasks.image` / `image_url` — чертёж задачи; уходит в чертёж
 *    геометрической задачи (`geogebra_image_base64`, файлом);
 *  - `task_images` (импорт с «Решу»): условие ссылается на внешний URL
 *    sdamgia, а файл лежит у нас. Ссылки переписываются на наш файл (как в
 *    `TaskStatementRenderer`). Если чертёж условия ровно один, а legacy-
 *    картинки нет — он становится чертежом геометрической задачи, и ссылка
 *    на него из условия убирается.
 * Ссылки на `task_images`, оставшиеся в тексте, живут, пока жива исходная
 * задача (файлы удаляются вместе с ней) — такую задачу удалять после
 * переноса нельзя (`keepsSourceLinks`).
 */
import { guessGeometrySection } from './geometrySection';
import { normalizeStatementLoose } from './normalize';

const MD_IMAGE_RE = /!\[([^\]]*)\]\(([^)\s]+)\)(\{(?:S|M|L|XL)\})?/g;

/** sdamgia file id из URL: /get_file?id=145381 → "145381". */
function sdamgiaFileId(url) {
  const m = String(url || '').match(/[?&]id=(\d+)/);
  return m ? m[1] : '';
}

/** Найти запись task_images по URL из markdown (original_url или file id). */
export function imageRecordMatcher(images = []) {
  const byUrl = new Map();
  const byFileId = new Map();
  for (const rec of images) {
    if (rec?.original_url) byUrl.set(rec.original_url, rec);
    const fid = rec?.sdamgia_file_id ? String(rec.sdamgia_file_id) : sdamgiaFileId(rec?.original_url);
    if (fid && !byFileId.has(fid)) byFileId.set(fid, rec);
  }
  return (url) => byUrl.get(url) || byFileId.get(sdamgiaFileId(url)) || null;
}

/**
 * Переписать ссылки на картинки «Решу» на наши файлы task_images.
 * `drop` — запись, ссылку на которую надо убрать совсем (она уходит в чертёж).
 */
function rewriteImages(md, match, urlOf, drop) {
  if (!md) return '';
  const out = md.replace(MD_IMAGE_RE, (full, alt, url, size = '') => {
    const rec = match(url);
    if (!rec) return full;
    if (drop && rec === drop) return '';
    const local = urlOf(rec);
    return local ? `![${alt || 'image'}](${local})${size}` : full;
  });
  // На месте убранной картинки остаются пустые строки — схлопываем.
  return drop ? out.replace(/\n{3,}/g, '\n\n').trim() : out;
}

/** Название геометрической задачи из условия: без формул, картинок и разметки. */
export function geometryTitleFromStatement(statement, fallback = '') {
  const plain = String(statement || '')
    .replace(MD_IMAGE_RE, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/\$\$[\s\S]*?\$\$/g, '…')
    .replace(/\$[^$]*\$/g, '…')
    .replace(/[*_#>|`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.slice(0, 80) || fallback;
}

/** Ключ для поиска уже перенесённых задач: текст условия без картинок. */
export function transferKey(statement) {
  return normalizeStatementLoose(String(statement || '').replace(MD_IMAGE_RE, ''));
}

/**
 * Какие задачи уже лежат в геометрии (тот же текст условия).
 * @returns {Map<string, string>} id задачи → код геометрической задачи
 */
export function findAlreadyTransferred(tasks = [], geometryTasks = []) {
  const byKey = new Map();
  for (const g of geometryTasks) {
    const key = transferKey(g.statement_md);
    if (key && !byKey.has(key)) byKey.set(key, g.code || g.id);
  }
  const found = new Map();
  for (const t of tasks) {
    const key = transferKey(t.statement_md);
    if (key && byKey.has(key)) found.set(t.id, byKey.get(key));
  }
  return found;
}

/** Следующие n GEO-кодов после `first` («GEO-042» → GEO-042, GEO-043, …). */
export function geometryCodeSequence(first, n) {
  const m = /^GEO-(\d+)$/.exec(String(first || ''));
  const start = m ? Number(m[1]) : 1;
  const width = m ? Math.max(3, m[1].length) : 3;
  return Array.from({ length: n }, (_, i) => `GEO-${String(start + i).padStart(width, '0')}`);
}

/**
 * Собрать запись geometry_tasks из задачи.
 *
 * @param {object} task — запись tasks (поля формы можно подмешать заранее)
 * @param {object} opts
 * @param {string} opts.code — GEO-код новой задачи
 * @param {string} [opts.note] — первая строка решения (откуда задача)
 * @param {string} [opts.topic] / [opts.subtopic] — тема/подтема геометрии
 * @param {string} [opts.topicTitle] — название темы задачи (подсказка раздела)
 * @param {string} [opts.legacyImageUrl] — адрес legacy-картинки задачи
 * @param {Array}  [opts.images] — записи task_images задачи
 * @param {Function} [opts.imageUrlOf] — запись task_images → адрес файла
 * @returns {{ record: object, drawingUrl: string, keepsSourceLinks: boolean }}
 */
export function taskToGeometryRecord(task, opts = {}) {
  const {
    code, note, topic, subtopic, topicTitle = '',
    legacyImageUrl = '', images = [], imageUrlOf = () => '',
  } = opts;
  const match = imageRecordMatcher(images);
  const conditionImages = images
    .filter((r) => (r.role || 'condition') === 'condition')
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  // Чертёж: legacy-картинка, иначе единственный чертёж условия из task_images.
  let drawingUrl = legacyImageUrl || '';
  let drop = null;
  if (!drawingUrl && conditionImages.length === 1) {
    drop = conditionImages[0];
    drawingUrl = imageUrlOf(drop) || '';
    if (!drawingUrl) drop = null;
  }

  const statement = rewriteImages(task.statement_md || '', match, imageUrlOf, drop);
  const solutionBody = rewriteImages(task.solution_md || '', match, imageUrlOf, null);
  const solution = [note, solutionBody].filter(Boolean).join('\n\n');

  // Чертёж перезаливается файлом — от исходной задачи он не зависит.
  const localUrls = images.map(imageUrlOf).filter(Boolean);
  const keepsSourceLinks = localUrls.some((u) => statement.includes(u) || solution.includes(u));

  const record = {
    code,
    origin: 'manual',
    section: guessGeometrySection({ statement, topicTitle }),
    title: geometryTitleFromStatement(statement, task.code || code),
    statement_md: statement,
    answer: task.answer || '',
    solution_md: solution,
    source: Array.isArray(task.source) ? (task.source[0] || '') : (task.source || ''),
  };
  const difficulty = Number(task.difficulty);
  if (difficulty >= 1 && difficulty <= 5) record.difficulty = difficulty;
  if (task.year) record.year = Number(task.year);
  if (topic) record.topic = topic;
  if (subtopic) record.subtopic = subtopic;

  return { record, drawingUrl, keepsSourceLinks };
}

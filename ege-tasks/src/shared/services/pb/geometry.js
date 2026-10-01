import { pb, _logAudit, withOwner, andOwner } from './client.js';
import { PB_BASE_URL } from '../pocketbaseUrl';
import { shuffleArray } from '../../utils/shuffle';
import { escapeFilter } from '../../utils/escapeFilter';
import { searchCaseVariants, MIN_SEARCH_LENGTH } from '../../utils/searchVariants';
import { getFullListByOr } from './chunked.js';
import { normalizeStructure, structureTaskIds } from '../../../utils/geometryWork';

// Поля задачи для списков и работ: без тяжёлых geogebra_base64 (XML состояния
// апплета, 30–100 КБ) и solution_md — они нужны редактору и карточке задачи
// (getGeometryTask).
const GEO_LIGHT_FIELDS = [
  'id', 'code', 'title', 'topic', 'subtopic', 'difficulty',
  'statement_md', // нужен для быстрого предпросмотра
  'answer', 'hints', 'geogebra_appname', 'drawing_view', 'drawing_svg', 'source', 'year',
  'origin', 'mccme_id', 'tags', 'section', 'image_role', 'task_type',
  'preview_layout', 'geogebra_image_base64', 'drawing_image', 'created', 'updated',
  'expand.topic.id', 'expand.topic.title',
  'expand.subtopic.id', 'expand.subtopic.title',
].join(',');

// Работа хранит список всех своих задач отдельным relation-полем — для expand
// и обратного поиска «в каких работах задача». Источник истины — structure.
const withWorkTasks = (data) => {
  if (!('structure' in data)) return data;
  const structure = normalizeStructure(data.structure);
  return { ...data, structure, tasks: structureTaskIds(structure) };
};

export const geometryApi = {
  // ─── Geometry Topics ──────────────────────────────────────────────────────

  async getGeometryTopics() {
    try {
      return await pb.collection('geometry_topics').getFullList({ sort: 'order,title' });
    } catch (error) {
      console.error('Error fetching geometry topics:', error);
      return [];
    }
  },

  async createGeometryTopic(data) {
    try {
      return await pb.collection('geometry_topics').create(data);
    } catch (error) {
      console.error('Error creating geometry topic:', error);
      throw error;
    }
  },

  async updateGeometryTopic(id, data) {
    try {
      return await pb.collection('geometry_topics').update(id, data);
    } catch (error) {
      console.error('Error updating geometry topic:', error);
      throw error;
    }
  },

  async deleteGeometryTopic(id) {
    try {
      return await pb.collection('geometry_topics').delete(id);
    } catch (error) {
      console.error('Error deleting geometry topic:', error);
      throw error;
    }
  },

  // ─── Geometry Subtopics ───────────────────────────────────────────────────

  async getGeometrySubtopics(topicId = null) {
    try {
      const filter = topicId ? `topic = "${escapeFilter(topicId)}"` : '';
      return await pb.collection('geometry_subtopics').getFullList({
        filter,
        sort: 'order,title',
        expand: 'topic',
      });
    } catch (error) {
      console.error('Error fetching geometry subtopics:', error);
      return [];
    }
  },

  async createGeometrySubtopic(data) {
    try {
      return await pb.collection('geometry_subtopics').create(data);
    } catch (error) {
      console.error('Error creating geometry subtopic:', error);
      throw error;
    }
  },

  async updateGeometrySubtopic(id, data) {
    try {
      return await pb.collection('geometry_subtopics').update(id, data);
    } catch (error) {
      console.error('Error updating geometry subtopic:', error);
      throw error;
    }
  },

  async deleteGeometrySubtopic(id) {
    try {
      return await pb.collection('geometry_subtopics').delete(id);
    } catch (error) {
      console.error('Error deleting geometry subtopic:', error);
      throw error;
    }
  },

  // ─── Geometry Tasks ───────────────────────────────────────────────────────

  /**
   * Возвращает URL PNG-чертежа задачи (файл из PocketBase storage).
   */
  getGeometryImageUrl(task) {
    const fileName = task?.geogebra_image_base64 || task?.drawing_image || '';

    if (task?.id && fileName && !String(fileName).startsWith('data:image/')) {
      return `${PB_BASE_URL}/api/files/geometry_tasks/${task.id}/${fileName}`;
    }
    // Для in-memory предпросмотра (до сохранения файла) допускаем data:image только из PNG-поля.
    return String(fileName).startsWith('data:image/') ? fileName : '';
  },

  async getGeometryTasks(filters = {}) {
    try {
      const filterArr = [];

      if (filters.topic) {
        filterArr.push(`topic = "${escapeFilter(filters.topic)}"`);
      }
      if (filters.subtopic) {
        filterArr.push(`subtopic = "${escapeFilter(filters.subtopic)}"`);
      }
      if (filters.difficulty) {
        filterArr.push(`difficulty = ${Number(filters.difficulty)}`);
      }
      if (filters.source) {
        filterArr.push(`source = "${escapeFilter(filters.source)}"`);
      }
      // section: 'planim' | 'stereo' — раздел (миграция 1787200000)
      if (filters.section === 'planim' || filters.section === 'stereo') {
        filterArr.push(`section = "${filters.section}"`);
      }
      // origin: 'manual' — свои задачи (пустой origin у старых = свои); 'mccme' — банк МЦНМО;
      // 'all' (или пусто) — без фильтра
      if (filters.origin === 'mccme') {
        filterArr.push(`origin = "mccme"`);
      } else if (filters.origin === 'manual') {
        filterArr.push(`(origin = "" || origin = "manual")`);
      }
      // tags: массив id фасетных тегов (geometry_tags) — AND по каждому выбранному
      if (Array.isArray(filters.tags) && filters.tags.length) {
        for (const t of filters.tags) {
          filterArr.push(`tags ~ "${escapeFilter(t)}"`);
        }
      }
      // Кириллица в SQLite регистрозависима — перебираем написания
      // (см. searchCaseVariants), иначе «Треугольник» не находит «треугольник».
      const search = String(filters.search || '').trim();
      if (search.length >= MIN_SEARCH_LENGTH) {
        const conds = searchCaseVariants(search).flatMap((v) => {
          const t = escapeFilter(v);
          return [`code ~ "${t}"`, `title ~ "${t}"`, `statement_md ~ "${t}"`, `answer ~ "${t}"`, `source ~ "${t}"`];
        });
        filterArr.push(`(${conds.join(' || ')})`);
      }

      return await pb.collection('geometry_tasks').getFullList({
        filter: filterArr.join(' && '),
        sort: 'code',
        expand: 'topic,subtopic',
        fields: GEO_LIGHT_FIELDS,
      });
    } catch (error) {
      console.error('Error fetching geometry tasks:', error);
      return [];
    }
  },

  // Задачи по списку id (для работы) — лёгкие поля, OR-фильтр кусками.
  async getGeometryTasksByIds(ids) {
    const uniq = [...new Set((ids || []).filter(Boolean))];
    if (!uniq.length) return [];
    return getFullListByOr('geometry_tasks', 'id', uniq, {
      expand: 'topic,subtopic',
      fields: GEO_LIGHT_FIELDS,
    });
  },

  // Похожие задачи (/geo/similar, векторный индекс геометрии) — кандидаты в
  // параллель для другого варианта. Возвращает [{ task_id, code, origin, pct, … }].
  async getSimilarGeometryTasks(taskId, { limit = 12, origin } = {}) {
    const base = import.meta.env.VITE_PDF_SERVICE_URL || 'http://localhost:3001';
    const res = await fetch(`${base}/geo/similar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_id: taskId, limit, ...(origin && origin !== 'all' ? { origin } : {}) }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`Сервис поиска ответил ${res.status}`);
    const data = await res.json();
    if (data.error === 'no_index') throw new Error('Векторный индекс геометрии не построен');
    if (data.error === 'not_indexed') throw new Error('Задачи нет в индексе (мало текста или индекс не обновлён)');
    if (data.error) throw new Error(data.error);
    return data.items || [];
  },

  // ─── Geometry Works (работы раздела, GEOMETRY_TASKS_PLAN.md § 4) ───────────

  async getGeometryWorks() {
    return pb.collection('geometry_works').getFullList({
      sort: '-updated',
      filter: andOwner(),
      fields: 'id,title,class,note,structure,print,created,updated,owner',
    });
  },

  async getGeometryWork(id) {
    return pb.collection('geometry_works').getOne(id);
  },

  async createGeometryWork(data) {
    const rec = await pb.collection('geometry_works').create(withOwner(withWorkTasks(data)));
    _logAudit('create', 'geometry_works', rec.id, rec.title);
    return rec;
  },

  async updateGeometryWork(id, data) {
    return pb.collection('geometry_works').update(id, withWorkTasks(data));
  },

  async deleteGeometryWork(id) {
    let summary = id;
    try {
      const w = await pb.collection('geometry_works').getOne(id, { fields: 'id,title' });
      summary = w.title || id;
    } catch (_) { /* удалим и без названия */ }
    const res = await pb.collection('geometry_works').delete(id);
    _logAudit('delete', 'geometry_works', id, summary);
    return res;
  },

  // Фасетные теги банка МЦНМО (geometry_tags). kind: object|method|fact|named|source.
  // Возвращает сгруппированно по kind: { object: [...], method: [...], fact: [...] }.
  async getGeometryTags() {
    try {
      const rows = await pb.collection('geometry_tags').getFullList({
        sort: 'name',
        fields: 'id,kind,name,mccme_id',
      });
      const byKind = { object: [], method: [], fact: [], named: [], source: [] };
      for (const r of rows) (byKind[r.kind] ||= []).push(r);
      return byKind;
    } catch (error) {
      console.error('Error fetching geometry tags:', error);
      return { object: [], method: [], fact: [], named: [], source: [] };
    }
  },

  // Новый фасет (для своих задач). slug — латиница не обязательна, пусть пусто.
  async createGeometryTag({ kind, name }) {
    const rec = await pb.collection('geometry_tags').create({ kind, name: String(name).trim() });
    _logAudit('create', 'geometry_tags', rec.id, `${kind}: ${rec.name}`);
    return rec;
  },

  // Соседи задачи из банка МЦНМО с их фасетами — для подсказки фасетов
  // (utils/geometryFacets.suggestFacets). [{ pct, tags }]
  async getGeometryFacetNeighbors(taskId, { limit = 12 } = {}) {
    const similar = await geometryApi.getSimilarGeometryTasks(taskId, { limit, origin: 'mccme' });
    if (!similar.length) return [];
    const recs = await getFullListByOr('geometry_tasks', 'id', similar.map((x) => x.task_id), { fields: 'id,tags' });
    const tagsById = new Map(recs.map((r) => [r.id, r.tags || []]));
    return similar.map((x) => ({ pct: x.pct, tags: tagsById.get(x.task_id) || [] }));
  },

  // Массово добавить/снять фасеты у задач — модификаторами tags+/tags-, чтобы
  // не затирать остальные фасеты каждой задачи. По 6 запросов параллельно.
  async updateGeometryTasksTags(ids, { add = [], remove = [] } = {}) {
    const data = {};
    if (add.length) data['tags+'] = add;
    if (remove.length) data['tags-'] = remove;
    if (!Object.keys(data).length) return { ok: 0, failed: 0 };
    let ok = 0;
    let failed = 0;
    const queue = [...ids];
    const worker = async () => {
      while (queue.length) {
        const id = queue.shift();
        try {
          await pb.collection('geometry_tasks').update(id, data, { requestKey: null });
          ok += 1;
        } catch {
          failed += 1;
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(6, ids.length) }, worker));
    return { ok, failed };
  },

  async updateGeometryTag(id, data) {
    try {
      return await pb.collection('geometry_tags').update(id, data);
    } catch (error) {
      console.error('Error updating geometry tag:', error);
      throw error;
    }
  },

  async deleteGeometryTag(id) {
    try {
      return await pb.collection('geometry_tags').delete(id);
    } catch (error) {
      console.error('Error deleting geometry tag:', error);
      throw error;
    }
  },

  // Уникальные непустые источники из всех задач геометрии — для фильтра по источнику.
  async getGeometrySources() {
    try {
      const rows = await pb.collection('geometry_tasks').getFullList({
        fields: 'source',
        sort: 'source',
      });
      const set = new Set();
      for (const r of rows) {
        const s = (r.source || '').trim();
        if (s) set.add(s);
      }
      return [...set].sort((a, b) => a.localeCompare(b, 'ru'));
    } catch (error) {
      console.error('Error fetching geometry sources:', error);
      return [];
    }
  },

  async getGeometryTask(id) {
    try {
      // Полная запись со всеми полями (включая geogebra_base64 для редактора)
      return await pb.collection('geometry_tasks').getOne(id, {
        expand: 'topic,subtopic',
      });
    } catch (error) {
      console.error('Error fetching geometry task:', error);
      throw error;
    }
  },

  async createGeometryTask(data) {
    try {
      // PocketBase SDK автоматически создаёт FormData, если data содержит File/Blob.
      // drawing_image передаётся как File-объект из редактора.
      const rec = await pb.collection('geometry_tasks').create(data);
      _logAudit('create', 'geometry_tasks', rec.id, rec.code || rec.title);
      return rec;
    } catch (error) {
      console.error('Error creating geometry task:', error);
      throw error;
    }
  },

  // Следующий свободный код своей задачи: GEO-NNN по максимуму среди всех
  // GEO-кодов базы. Раньше считался как «число задач в списке + 1» — при
  // фильтре или поиске новый код совпадал с уже существующим.
  async getNextGeometryCode() {
    try {
      const rows = await pb.collection('geometry_tasks').getFullList({
        filter: 'code ~ "GEO-"',
        fields: 'code',
        requestKey: null,
      });
      let max = 0;
      for (const r of rows) {
        const m = /^GEO-(\d+)$/.exec(String(r.code || '').trim());
        if (m) max = Math.max(max, Number(m[1]));
      }
      return `GEO-${String(max + 1).padStart(3, '0')}`;
    } catch (error) {
      console.error('Error computing next geometry code:', error);
      return null;
    }
  },

  async updateGeometryTask(id, data) {
    try {
      // Аналогично: если data.drawing_image — File, SDK сам сформирует FormData.
      return await pb.collection('geometry_tasks').update(id, data);
    } catch (error) {
      console.error('Error updating geometry task:', error);
      throw error;
    }
  },

  // Копия задачи. asMine — «Взять к себе» задачу банка МЦНМО: своя задача
  // со следующим кодом GEO-NNN и ссылкой на исходник в источнике; иначе —
  // обычный дубль с суффиксом «-копия». Фасеты, раздел и вложения решения
  // копируются; mccme_id — нет (по нему импорт банка узнаёт свои записи).
  async _copyGeometryTask(id, { asMine = false } = {}) {
    // Полная запись (включая geogebra_base64 и solution_md)
    const task = await pb.collection('geometry_tasks').getOne(id);

    const formData = new FormData();
    const TEXT_FIELDS = [
      'title', 'topic', 'subtopic', 'difficulty', 'task_type', 'statement_md',
      'answer', 'geogebra_appname', 'drawing_view', 'drawing_svg', 'year',
      'solution_md', 'geogebra_base64', 'image_role', 'section',
    ];
    for (const field of TEXT_FIELDS) {
      if (task[field] != null && task[field] !== '') formData.append(field, task[field]);
    }
    // json-поля — явно строкой, иначе FormData.append даёт "[object Object]"
    for (const field of ['hints', 'preview_layout', 'solution_files']) {
      const v = task[field];
      if (v != null && v !== '' && !(Array.isArray(v) && v.length === 0)) {
        formData.append(field, typeof v === 'string' ? v : JSON.stringify(v));
      }
    }
    for (const tag of Array.isArray(task.tags) ? task.tags : []) formData.append('tags', tag);

    if (asMine) {
      const code = await geometryApi.getNextGeometryCode();
      if (!code) throw new Error('Не удалось получить код для новой задачи');
      formData.append('code', code);
      formData.append('origin', 'manual');
      const ref = task.mccme_id ? `МЦНМО №${task.mccme_id}` : (task.code || '');
      formData.append('source', [task.source, ref].filter(Boolean).join(', '));
    } else {
      if (task.code) formData.append('code', `${task.code}-копия`);
      if (task.origin) formData.append('origin', task.origin);
      if (task.source) formData.append('source', task.source);
    }

    // Файл чертежа: скачиваем и перезаливаем. Поле файла — geogebra_image_base64
    // (поля drawing_image в коллекции нет — раньше дубль терял чертёж).
    const drawingFileName = task.geogebra_image_base64 || '';
    if (drawingFileName && !String(drawingFileName).startsWith('data:image/')) {
      const fileUrl = `${PB_BASE_URL}/api/files/geometry_tasks/${task.id}/${drawingFileName}`;
      try {
        const resp = await fetch(fileUrl);
        if (resp.ok) {
          const blob = await resp.blob();
          formData.append('geogebra_image_base64', new File([blob], drawingFileName, { type: blob.type || 'image/png' }));
        }
      } catch {
        // Не смогли скопировать файл — продолжаем без него
      }
    }

    const rec = await pb.collection('geometry_tasks').create(formData);
    _logAudit('create', 'geometry_tasks', rec.id, `${rec.code} (копия ${task.code || id})`);
    return rec;
  },

  async duplicateGeometryTask(id) {
    try {
      return await geometryApi._copyGeometryTask(id);
    } catch (error) {
      console.error('Error duplicating geometry task:', error);
      throw error;
    }
  },

  // «Взять к себе»: задача банка МЦНМО → своя (её можно править, не трогая банк).
  async takeGeometryTaskToMine(id) {
    try {
      return await geometryApi._copyGeometryTask(id, { asMine: true });
    } catch (error) {
      console.error('Error taking geometry task to mine:', error);
      throw error;
    }
  },

  async deleteGeometryTask(id) {
    try {
      let summary = id;
      try {
        const t = await pb.collection('geometry_tasks').getOne(id, { fields: 'id,code,title' });
        summary = t.code || t.title || id;
      } catch (_) {}
      const res = await pb.collection('geometry_tasks').delete(id);
      _logAudit('delete', 'geometry_tasks', id, summary);
      return res;
    } catch (error) {
      console.error('Error deleting geometry task:', error);
      throw error;
    }
  },

  // Импорт геометрических задач в обычные (tasks).
  // Возвращает { added, errors, details[] }.
  async importGeometryTasksToRegular(ids, { topicId, subtopicId } = {}) {
    const results = { added: 0, errors: 0, details: [] };
    for (const id of ids) {
      try {
        const geo = await pb.collection('geometry_tasks').getOne(id);

        const formData = new FormData();
        const TEXT_FIELDS = ['statement_md', 'answer', 'solution_md', 'title', 'source', 'year', 'difficulty'];
        for (const f of TEXT_FIELDS) {
          if (geo[f] != null && geo[f] !== '') formData.append(f, String(geo[f]));
        }
        if (geo.code) formData.append('code', geo.code);
        if (topicId) formData.append('topic', topicId);
        if (subtopicId) formData.append('subtopic', subtopicId);
        formData.append('has_image', 'false');

        // Копируем чертёж как image задачи
        const imgFileName = geo.drawing_image || geo.geogebra_image_base64;
        if (imgFileName && !String(imgFileName).startsWith('data:image/')) {
          const fileUrl = `${PB_BASE_URL}/api/files/geometry_tasks/${geo.id}/${imgFileName}`;
          try {
            const resp = await fetch(fileUrl);
            if (resp.ok) {
              const blob = await resp.blob();
              formData.append('image', new File([blob], imgFileName, { type: blob.type || 'image/png' }));
              formData.set('has_image', 'true');
            }
          } catch {
            // продолжаем без изображения
          }
        }

        await pb.collection('tasks').create(formData);
        results.added++;
        results.details.push({ status: 'added', message: `${geo.code || id} — импортирована` });
      } catch (e) {
        results.errors++;
        results.details.push({ status: 'error', message: `${id}: ${e?.message || 'неизвестная ошибка'}` });
      }
    }
    return results;
  },

  async createGeometryPrintTest(data) {
    try {
      return await pb.collection('geometry_print_tests').create(withOwner(data));
    } catch (error) {
      console.error('Error creating geometry print test:', error);
      throw error;
    }
  },

  async getGeometryPrintTests() {
    try {
      return await pb.collection('geometry_print_tests').getFullList({
        sort: '-created',
        expand: 'tasks',
        filter: andOwner(),
      });
    } catch (error) {
      console.error('Error fetching geometry print tests:', error);
      return [];
    }
  },

  async getGeometryPrintTest(id) {
    try {
      return await pb.collection('geometry_print_tests').getOne(id, {
        expand: 'tasks',
      });
    } catch (error) {
      console.error('Error fetching geometry print test:', error);
      throw error;
    }
  },

  async updateGeometryPrintTest(id, data) {
    try {
      return await pb.collection('geometry_print_tests').update(id, data);
    } catch (error) {
      console.error('Error updating geometry print test:', error);
      throw error;
    }
  },

  async deleteGeometryPrintTest(id) {
    try {
      return await pb.collection('geometry_print_tests').delete(id);
    } catch (error) {
      console.error('Error deleting geometry print test:', error);
      throw error;
    }
  },

};

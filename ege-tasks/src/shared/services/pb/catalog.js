import { pb, _logAudit, withOwner, andOwner } from './client.js';
import { shuffleArray } from '../../utils/shuffle';
import { escapeFilter } from '../../utils/escapeFilter';
import { getFullListByOr, getFullListPaged } from './chunked.js';

const TAG_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
  '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B500', '#52BE80',
];
const randomTagColor = () => TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)];

// Ответ /api/tasks/snapshot ({ fields, rows }) → записи как у REST
// (has_image — булево). Неожиданная форма → null, вызывающий грузит по-старому.
export function rowsToRecords(data) {
  const fields = data?.fields;
  if (!Array.isArray(fields) || !Array.isArray(data?.rows) || !fields.includes('id')) return null;
  return data.rows.map((row) => {
    const rec = {};
    fields.forEach((f, i) => { rec[f] = row[i]; });
    if ('has_image' in rec) rec.has_image = !!rec.has_image;
    return rec;
  });
}

export const catalogApi = {
  // ============ КАРТОЧКИ ============

  // Создать карточку
  async createCard(data) {
    try {
      return await pb.collection('cards').create(withOwner(data));
    } catch (error) {
      console.error('Error creating card:', error);
      throw error;
    }
  },

  // Получить все карточки
  async getCards() {
    try {
      const records = await pb.collection('cards').getFullList({
        sort: '-created',
        expand: 'tasks,tasks.topic',
        filter: andOwner(),
      });
      return records;
    } catch (error) {
      console.error('Error fetching cards:', error);
      return [];
    }
  },

  // Получить карточку по ID
  async getCard(id) {
    try {
      return await pb.collection('cards').getOne(id, {
        expand: 'tasks,tasks.topic',
      });
    } catch (error) {
      console.error('Error fetching card:', error);
      return null;
    }
  },

  // Удалить карточку
  async deleteCard(id) {
    try {
      return await pb.collection('cards').delete(id);
    } catch (error) {
      console.error('Error deleting card:', error);
      throw error;
    }
  },

  // Обновить карточку
  async updateCard(id, data) {
    try {
      return await pb.collection('cards').update(id, data);
    } catch (error) {
      console.error('Error updating card:', error);
      throw error;
    }
  },

  // ============ ИМПОРТ ЗАДАЧ ============

  // Поиск тега по title
  async findTagByTitle(title) {
    try {
      const records = await pb.collection('tags').getFullList({
        filter: `title = "${escapeFilter(title)}"`,
      });
      return records.length > 0 ? records[0] : null;
    } catch (error) {
      console.error('Error finding tag:', error);
      return null;
    }
  },

  // Найти тег по названию или создать новый. Общее для импорта задач и импорта
  // работы целиком; `cache` (Map title→id) избавляет от повторных запросов
  // внутри одного импорта.
  async getOrCreateTag(title, cache = null) {
    const trimmed = String(title || '').trim();
    if (!trimmed) return null;
    if (cache?.has(trimmed)) return cache.get(trimmed);

    const existing = await this.findTagByTitle(trimmed);
    if (existing) {
      cache?.set(trimmed, existing.id);
      return existing.id;
    }

    try {
      const created = await pb.collection('tags').create({ title: trimmed, color: randomTagColor() });
      cache?.set(trimmed, created.id);
      return created.id;
    } catch (error) {
      console.error(`Error creating tag "${trimmed}":`, error);
      return null;
    }
  },

  // Найти подтему темы по названию или создать новую.
  // `known` — уже загруженный список подтем (из ReferenceDataContext), чтобы
  // не ходить в сеть за тем, что и так есть на клиенте.
  async getOrCreateSubtopic(name, topicId, known = []) {
    const trimmed = String(name || '').trim();
    if (!trimmed || !topicId) return null;

    const existing = known.find((st) => st.topic === topicId && st.name === trimmed);
    if (existing) return existing.id;

    try {
      const created = await this.createSubtopic({ name: trimmed, topic: topicId, order: 0 });
      return created.id;
    } catch (error) {
      console.error(`Error creating subtopic "${trimmed}":`, error);
      return null;
    }
  },

  // Получить statement_md и code всех задач темы (для проверки дубликатов и генерации кодов)
  async getTaskStatementsAndCodes(topicId) {
    try {
      const records = await pb.collection('tasks').getFullList({
        filter: `topic = "${escapeFilter(topicId)}"`,
        fields: 'statement_md,code',
      });
      return records;
    } catch (error) {
      console.error('Error fetching task statements:', error);
      return [];
    }
  },

  // ============ МЕТАДАННЫЕ ============

  // Получить уникальные годы из задач (legacy — используйте getTasksStatsSnapshot + extractYears)
  async getUniqueYears() {
    try {
      const records = await pb.collection('tasks').getFullList({
        fields: 'year',
        batch: 500,
      });
      const years = [...new Set(records.map(r => r.year).filter(Boolean))];
      return years.sort((a, b) => b - a); // Сортируем по убыванию
    } catch (error) {
      console.error('Error fetching years:', error);
      return [];
    }
  },

  // Получить уникальные источники из задач (legacy — используйте getTasksStatsSnapshot + extractSources)
  async getUniqueSources() {
    try {
      const records = await pb.collection('tasks').getFullList({
        fields: 'source',
        batch: 500,
      });
      const sources = [...new Set(records.map(r => r.source).filter(Boolean))];
      return sources.sort();
    } catch (error) {
      console.error('Error fetching sources:', error);
      return [];
    }
  },

  // Получить лёгкий snapshot задач для статистики (без тяжёлых текстовых полей)
  async getTasksStatsSnapshot() {
    try {
      // Одним запросом из хука pb_hooks/tasks_snapshot.pb.js (~0,3 с);
      // нет хука или сбой — страницами по 1000 параллельно (getFullList шёл
      // бы ~60 запросами подряд).
      try {
        const rows = rowsToRecords(await pb.send('/api/tasks/snapshot', { method: 'GET', requestKey: null }));
        if (rows) return rows;
      } catch (e) {
        console.warn('Снимок задач одним запросом недоступен, грузим страницами:', e?.status || e?.message);
      }
      return await getFullListPaged('tasks', {
        fields: 'id,topic,subtopic,tags,difficulty,has_image,source,year',
        filter: 'source != "trig_generator"',
      });
    } catch (error) {
      console.error('Error fetching tasks stats snapshot:', error);
      return [];
    }
  },

  // «Банк задач» → «Обзор»: какие задачи требуют внимания, по темам.
  // Только поле `topic` и только «плохие» задачи — десяток лёгких страниц
  // вместо выкачивания ответов и решений всего банка. Ровно та же выборка,
  // что у снимка (без `trig_generator`), иначе доли не сойдутся.
  async getTaskBankFlags() {
    const base = 'source != "trig_generator"';
    const topicsOf = (filter) => pb.collection('tasks').getFullList({
      filter: `${base} && ${filter}`,
      fields: 'topic',
      batch: 1000,
      requestKey: null,
    }).then((list) => list.map((r) => r.topic || ''));
    const [noAnswer, noSolution, review] = await Promise.all([
      topicsOf('answer = ""'),
      topicsOf('solution_md = ""'),
      topicsOf('latex_needs_review = true'),
    ]);
    return { noAnswer, noSolution, review };
  },

  // Код, тема и начало условия нескольких задач (список «чаще ошибаются»).
  async getTasksBrief(ids) {
    const uniq = [...new Set((ids || []).filter(Boolean))];
    if (!uniq.length) return [];
    return getFullListByOr('tasks', 'id', uniq, {
      fields: 'id,code,topic,statement_md:excerpt(140,true)',
      requestKey: null,
    });
  },

  // Количество задач с ответом (один лёгкий запрос вместо загрузки всех answer)
  async getWithAnswerCount() {
    try {
      const result = await pb.collection('tasks').getList(1, 1, {
        filter: 'answer != "" && source != "trig_generator"',
      });
      return result.totalItems;
    } catch (error) {
      console.error('Error fetching answer count:', error);
      return 0;
    }
  },

  // Количество задач с решением (один лёгкий запрос вместо загрузки всех solution_md)
  async getWithSolutionCount() {
    try {
      const result = await pb.collection('tasks').getList(1, 1, {
        filter: 'solution_md != "" && source != "trig_generator"',
      });
      return result.totalItems;
    } catch (error) {
      console.error('Error fetching solution count:', error);
      return 0;
    }
  },

  // Загрузить statement_md для поиска дубликатов (тяжёлый, вызывать лениво)
  async getTasksForDuplicateCheck() {
    try {
      const records = await pb.collection('tasks').getFullList({
        fields: 'id,code,statement_md',
        filter: 'statement_md != ""',
        batch: 500,
      });
      return records;
    } catch (error) {
      console.error('Error fetching tasks for duplicate check:', error);
      return [];
    }
  },

  // Получить все подтемы
  async getSubtopics(topicId = null) {
    try {
      const filter = topicId ? `topic = "${escapeFilter(topicId)}"` : '';
      const records = await pb.collection('subtopics').getFullList({
        filter,
        sort: 'order,name',
        expand: 'topic',
      });
      return records;
    } catch (error) {
      console.error('Error fetching subtopics:', error);
      return [];
    }
  },

  // Создать подтему
  async createSubtopic(data) {
    try {
      return await pb.collection('subtopics').create(data);
    } catch (error) {
      console.error('Error creating subtopic:', error);
      throw error;
    }
  },

  // Обновить подтему
  async updateSubtopic(id, data) {
    try {
      return await pb.collection('subtopics').update(id, data);
    } catch (error) {
      console.error('Error updating subtopic:', error);
      throw error;
    }
  },

  // Удалить подтему
  async deleteSubtopic(id) {
    try {
      return await pb.collection('subtopics').delete(id);
    } catch (error) {
      console.error('Error deleting subtopic:', error);
      throw error;
    }
  },

};

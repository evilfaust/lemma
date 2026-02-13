import PocketBase from 'pocketbase';
import { shuffleArray } from '../utils/shuffle';
import { escapeFilter } from '../utils/escapeFilter';
import { PB_BASE_URL } from './pocketbaseUrl';

const pb = new PocketBase(PB_BASE_URL);

// Отключаем автоматическое обновление токена для анонимного доступа
pb.autoCancellation(false);

export const api = {
  // Получить все темы
  async getTopics() {
    try {
      const records = await pb.collection('topics').getFullList({
        sort: 'order,ege_number',
      });
      return records;
    } catch (error) {
      console.error('Error fetching topics:', error);
      return [];
    }
  },

  // Получить тему по ID
  async getTopic(id) {
    try {
      return await pb.collection('topics').getOne(id);
    } catch (error) {
      console.error('Error fetching topic:', error);
      return null;
    }
  },

  // Обновить тему
  async updateTopic(id, data) {
    try {
      return await pb.collection('topics').update(id, data);
    } catch (error) {
      console.error('Error updating topic:', error);
      throw error;
    }
  },

  // Создать тему
  async createTopic(data) {
    try {
      return await pb.collection('topics').create(data);
    } catch (error) {
      console.error('Error creating topic:', error);
      throw error;
    }
  },

  // Получить все теги
  async getTags() {
    try {
      const records = await pb.collection('tags').getFullList({
        sort: 'title',
      });
      return records;
    } catch (error) {
      console.error('Error fetching tags:', error);
      return [];
    }
  },

  // Создать тег
  async createTag(data) {
    try {
      return await pb.collection('tags').create(data);
    } catch (error) {
      console.error('Error creating tag:', error);
      throw error;
    }
  },

  // Обновить тег
  async updateTag(id, data) {
    try {
      return await pb.collection('tags').update(id, data);
    } catch (error) {
      console.error('Error updating tag:', error);
      throw error;
    }
  },

  // Удалить тег
  async deleteTag(id) {
    try {
      return await pb.collection('tags').delete(id);
    } catch (error) {
      console.error('Error deleting tag:', error);
      throw error;
    }
  },

  // Получить задачи с фильтрами
  async getTasks(filters = {}) {
    try {
      const filterArr = [];

      if (filters.topic) {
        filterArr.push(`topic = "${escapeFilter(filters.topic)}"`);
      }

      // Фильтрация по подтеме - это Multiple relation (массив)
      // Используем оператор ~ для проверки наличия ID в массиве
      if (filters.subtopic) {
        filterArr.push(`subtopic ~ "${escapeFilter(filters.subtopic)}"`);
      }

      // Фильтрация по массиву подтем (несколько подтем)
      if (filters.subtopics && filters.subtopics.length > 0) {
        const subtopicFilters = filters.subtopics.map(stId => `subtopic ~ "${escapeFilter(stId)}"`);
        filterArr.push(`(${subtopicFilters.join(' || ')})`);
      }

      // Фильтрация по тегам (несколько тегов)
      if (filters.tags && filters.tags.length > 0) {
        const tagFilters = filters.tags.map(tagId => `tags ~ "${escapeFilter(tagId)}"`);
        filterArr.push(`(${tagFilters.join(' || ')})`);
      }

      if (filters.difficulty) {
        filterArr.push(`difficulty = "${escapeFilter(filters.difficulty)}"`);
      }

      if (filters.hasAnswer !== undefined) {
        filterArr.push(filters.hasAnswer ? `answer != ""` : `answer = ""`);
      }

      if (filters.hasSolution !== undefined) {
        filterArr.push(filters.hasSolution ? `solution_md != ""` : `solution_md = ""`);
      }

      if (filters.hasImage !== undefined) {
        filterArr.push(filters.hasImage ? `has_image = true` : `has_image = false`);
      }

      if (filters.source) {
        filterArr.push(`source ~ "${escapeFilter(filters.source)}"`);
      }

      if (filters.year) {
        filterArr.push(`year = ${Number(filters.year) || 0}`);
      }

      const filterString = filterArr.length > 0 ? filterArr.join(' && ') : '';

      const records = await pb.collection('tasks').getFullList({
        filter: filterString,
        expand: 'topic,tags,subtopic',
        sort: filters.sort || 'code',
      });

      return records;
    } catch (error) {
      console.error('Error fetching tasks:', error);
      return [];
    }
  },

  // Получить случайные задачи
  async getRandomTasks(count, filters = {}) {
    try {
      const allTasks = await this.getTasks(filters);

      // Перемешиваем массив
      const shuffled = shuffleArray(allTasks);

      // Берем первые count элементов
      return shuffled.slice(0, count);
    } catch (error) {
      console.error('Error fetching random tasks:', error);
      return [];
    }
  },

  // Получить задачи БЕЗ ПОВТОРЕНИЙ (исключая уже использованные)
  async getRandomTasksWithoutRepetition(count, filters = {}, excludeTaskIds = []) {
    try {
      const allTasks = await this.getTasks(filters);

      // Фильтруем, исключая уже использованные задачи
      const availableTasks = allTasks.filter(task => !excludeTaskIds.includes(task.id));

      if (availableTasks.length < count) {
        console.warn(`Доступно только ${availableTasks.length} неиспользованных задач из ${count} запрошенных`);
      }

      // Перемешиваем массив
      const shuffled = shuffleArray(availableTasks);

      // Берем первые count элементов
      return shuffled.slice(0, count);
    } catch (error) {
      console.error('Error fetching tasks without repetition:', error);
      return [];
    }
  },

  // Получить задачи с ПРОГРЕССИВНОЙ СЛОЖНОСТЬЮ
  async getTasksWithProgressiveDifficulty(count, filters = {}, excludeTaskIds = []) {
    try {
      const allTasks = await this.getTasks(filters);

      // Фильтруем, исключая уже использованные задачи
      const availableTasks = allTasks.filter(task => !excludeTaskIds.includes(task.id));

      // Группируем задачи по сложности
      const tasksByDifficulty = {
        '1': [],
        '2': [],
        '3': [],
        '4': [],
        '5': []
      };

      availableTasks.forEach(task => {
        const difficulty = task.difficulty || '1';
        if (tasksByDifficulty[difficulty]) {
          tasksByDifficulty[difficulty].push(task);
        }
      });

      // Перемешиваем задачи в каждой группе сложности
      Object.keys(tasksByDifficulty).forEach(diff => {
        tasksByDifficulty[diff] = shuffleArray(tasksByDifficulty[diff]);
      });

      // Рассчитываем распределение по сложности (прогрессивное)
      // Например, для 10 задач: 4 легких, 3 средних, 2 сложных, 1 очень сложная
      const distribution = this._calculateProgressiveDistribution(count);

      // Собираем задачи согласно распределению
      const result = [];
      distribution.forEach(({ difficulty, taskCount }) => {
        const tasks = tasksByDifficulty[difficulty].slice(0, taskCount);
        result.push(...tasks);
      });

      return result;
    } catch (error) {
      console.error('Error fetching tasks with progressive difficulty:', error);
      return [];
    }
  },

  // Вспомогательный метод для расчета прогрессивного распределения
  _calculateProgressiveDistribution(totalCount) {
    // Распределение: 40% сложность 1, 30% сложность 2, 20% сложность 3, 10% сложность 4+5
    const dist = [
      { difficulty: '1', taskCount: Math.ceil(totalCount * 0.4) },
      { difficulty: '2', taskCount: Math.ceil(totalCount * 0.3) },
      { difficulty: '3', taskCount: Math.ceil(totalCount * 0.2) },
      { difficulty: '4', taskCount: Math.ceil(totalCount * 0.07) },
      { difficulty: '5', taskCount: Math.ceil(totalCount * 0.03) }
    ];

    // Корректируем, чтобы сумма была ровно totalCount
    let currentSum = dist.reduce((sum, d) => sum + d.taskCount, 0);
    while (currentSum > totalCount) {
      // Уменьшаем с конца
      for (let i = dist.length - 1; i >= 0 && currentSum > totalCount; i--) {
        if (dist[i].taskCount > 0) {
          dist[i].taskCount--;
          currentSum--;
        }
      }
    }

    return dist.filter(d => d.taskCount > 0);
  },

  // Получить задачу по ID
  async getTask(id) {
    try {
      return await pb.collection('tasks').getOne(id, {
        expand: 'topic,tags,subtopic',
      });
    } catch (error) {
      console.error('Error fetching task:', error);
      return null;
    }
  },

  // Создать задачу
  async createTask(data) {
    try {
      return await pb.collection('tasks').create(data);
    } catch (error) {
      console.error('Error creating task:', error);
      throw error;
    }
  },

  // Обновить задачу
  async updateTask(id, data) {
    try {
      return await pb.collection('tasks').update(id, data);
    } catch (error) {
      console.error('Error updating task:', error);
      throw error;
    }
  },

  // Удалить задачу
  async deleteTask(id) {
    try {
      return await pb.collection('tasks').delete(id);
    } catch (error) {
      console.error('Error deleting task:', error);
      throw error;
    }
  },

  // Получить URL изображения
  getImageUrl(record, filename) {
    return pb.files.getUrl(record, filename);
  },

  // ============ КАРТОЧКИ ============

  // Создать карточку
  async createCard(data) {
    try {
      return await pb.collection('cards').create(data);
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

  // Получить уникальные годы из задач
  async getUniqueYears() {
    try {
      const records = await pb.collection('tasks').getFullList({
        fields: 'year',
      });
      const years = [...new Set(records.map(r => r.year).filter(Boolean))];
      return years.sort((a, b) => b - a); // Сортируем по убыванию
    } catch (error) {
      console.error('Error fetching years:', error);
      return [];
    }
  },

  // Получить уникальные источники из задач
  async getUniqueSources() {
    try {
      const records = await pb.collection('tasks').getFullList({
        fields: 'source',
      });
      const sources = [...new Set(records.map(r => r.source).filter(Boolean))];
      return sources.sort();
    } catch (error) {
      console.error('Error fetching sources:', error);
      return [];
    }
  },

  // Получить минимальные поля задач для статистики
  async getTasksStatsSnapshot() {
    try {
      const records = await pb.collection('tasks').getFullList({
        fields: 'id,topic,subtopic,tags,difficulty,answer,solution_md,has_image,source,year',
      });
      return records;
    } catch (error) {
      console.error('Error fetching tasks stats snapshot:', error);
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

  // ============ РАБОТЫ (WORKS) ============

  // Создать работу
  async createWork(data) {
    try {
      return await pb.collection('works').create(data);
    } catch (error) {
      console.error('Error creating work:', error);
      throw error;
    }
  },

  // Получить все работы
  async getWorks(options = {}) {
    const {
      includeArchived = false,
      archived = false,
      search = '',
      topic = null,
    } = options;

    try {
      const filterArr = [];

      if (!includeArchived) {
        if (archived) {
          filterArr.push('archived = true');
        } else {
          // Если поле archived ещё не проставлено (null), считаем как false
          filterArr.push('(archived = false || archived = null)');
        }
      }

      if (topic) {
        filterArr.push(`topic = "${escapeFilter(topic)}"`);
      }

      if (search) {
        filterArr.push(`title ~ "${escapeFilter(search)}"`);
      }

      const filterString = filterArr.length > 0 ? filterArr.join(' && ') : '';

      const records = await pb.collection('works').getFullList({
        sort: '-created',
        expand: 'topic',
        filter: filterString,
      });
      return records;
    } catch (error) {
      console.error('Error fetching works:', error);
      return [];
    }
  },

  // Получить работу по ID
  async getWork(id) {
    try {
      return await pb.collection('works').getOne(id, {
        expand: 'topic',
      });
    } catch (error) {
      console.error('Error fetching work:', error);
      return null;
    }
  },

  // Удалить работу
  async deleteWork(id) {
    try {
      return await pb.collection('works').delete(id);
    } catch (error) {
      console.error('Error deleting work:', error);
      throw error;
    }
  },

  // Обновить работу
  async updateWork(id, data) {
    try {
      return await pb.collection('works').update(id, data);
    } catch (error) {
      console.error('Error updating work:', error);
      throw error;
    }
  },

  // Архивировать работу
  async archiveWork(id) {
    return this.updateWork(id, { archived: true });
  },

  // Разархивировать работу
  async unarchiveWork(id) {
    return this.updateWork(id, { archived: false });
  },

  // ============ ВАРИАНТЫ (VARIANTS) ============

  // Создать вариант
  async createVariant(data) {
    try {
      return await pb.collection('variants').create(data);
    } catch (error) {
      console.error('Error creating variant:', error);
      throw error;
    }
  },

  // Получить все варианты работы
  async getVariantsByWork(workId) {
    try {
      const records = await pb.collection('variants').getFullList({
        filter: `work = "${escapeFilter(workId)}"`,
        sort: 'number',
        expand: 'tasks,tasks.topic',
      });
      return records;
    } catch (error) {
      console.error('Error fetching variants:', error);
      return [];
    }
  },

  // Получить вариант по ID
  async getVariant(id) {
    try {
      return await pb.collection('variants').getOne(id, {
        expand: 'work,tasks,tasks.topic',
      });
    } catch (error) {
      console.error('Error fetching variant:', error);
      return null;
    }
  },

  // Удалить вариант
  async deleteVariant(id) {
    try {
      return await pb.collection('variants').delete(id);
    } catch (error) {
      console.error('Error deleting variant:', error);
      throw error;
    }
  },

  // Обновить вариант
  async updateVariant(id, data) {
    try {
      return await pb.collection('variants').update(id, data);
    } catch (error) {
      console.error('Error updating variant:', error);
      throw error;
    }
  },

  // ============ ТЕОРИЯ: КАТЕГОРИИ ============

  // Получить все категории теории
  async getTheoryCategories() {
    try {
      const records = await pb.collection('theory_categories').getFullList({
        sort: 'order,title',
      });
      return records;
    } catch (error) {
      console.error('Error fetching theory categories:', error);
      return [];
    }
  },

  // Создать категорию теории
  async createTheoryCategory(data) {
    try {
      return await pb.collection('theory_categories').create(data);
    } catch (error) {
      console.error('Error creating theory category:', error);
      throw error;
    }
  },

  // Обновить категорию теории
  async updateTheoryCategory(id, data) {
    try {
      return await pb.collection('theory_categories').update(id, data);
    } catch (error) {
      console.error('Error updating theory category:', error);
      throw error;
    }
  },

  // Удалить категорию теории
  async deleteTheoryCategory(id) {
    try {
      return await pb.collection('theory_categories').delete(id);
    } catch (error) {
      console.error('Error deleting theory category:', error);
      throw error;
    }
  },

  // ============ ТЕОРИЯ: СТАТЬИ ============

  // Получить статьи теории (только метаданные для списка)
  async getTheoryArticles(filters = {}) {
    try {
      const filterArr = [];

      if (filters.category) {
        filterArr.push(`category = "${escapeFilter(filters.category)}"`);
      }

      if (filters.search) {
        filterArr.push(`title ~ "${escapeFilter(filters.search)}"`);
      }

      if (filters.tags && filters.tags.length > 0) {
        const tagFilters = filters.tags.map(tag => `tags ~ "${escapeFilter(tag)}"`);
        filterArr.push(`(${tagFilters.join(' || ')})`);
      }

      const filterString = filterArr.length > 0 ? filterArr.join(' && ') : '';

      const records = await pb.collection('theory_articles').getFullList({
        filter: filterString,
        fields: 'id,title,category,summary,tags,order,created,updated',
        expand: 'category',
        sort: filters.sort || 'order,title',
      });

      return records;
    } catch (error) {
      console.error('Error fetching theory articles:', error);
      return [];
    }
  },

  // Получить полную статью теории по ID
  async getTheoryArticle(id) {
    try {
      return await pb.collection('theory_articles').getOne(id, {
        expand: 'category',
      });
    } catch (error) {
      console.error('Error fetching theory article:', error);
      return null;
    }
  },

  // Создать статью теории
  async createTheoryArticle(data) {
    try {
      return await pb.collection('theory_articles').create(data);
    } catch (error) {
      console.error('Error creating theory article:', error);
      throw error;
    }
  },

  // Обновить статью теории
  async updateTheoryArticle(id, data) {
    try {
      return await pb.collection('theory_articles').update(id, data);
    } catch (error) {
      console.error('Error updating theory article:', error);
      throw error;
    }
  },

  // Удалить статью теории
  async deleteTheoryArticle(id) {
    try {
      return await pb.collection('theory_articles').delete(id);
    } catch (error) {
      console.error('Error deleting theory article:', error);
      throw error;
    }
  },

  // Получить количество статей по категориям
  async getTheoryArticleCountByCategory() {
    try {
      const records = await pb.collection('theory_articles').getFullList({
        fields: 'category',
      });
      const counts = {};
      records.forEach(r => {
        if (r.category) {
          counts[r.category] = (counts[r.category] || 0) + 1;
        }
      });
      return counts;
    } catch (error) {
      console.error('Error fetching article counts:', error);
      return {};
    }
  },

  // ============ СЕССИИ ВЫДАЧИ (WORK SESSIONS) ============

  async createSession(data) {
    try {
      return await pb.collection('work_sessions').create(data);
    } catch (error) {
      console.error('Error creating session:', error);
      throw error;
    }
  },

  async getSession(id) {
    try {
      return await pb.collection('work_sessions').getOne(id, {
        expand: 'work',
      });
    } catch (error) {
      console.error('Error fetching session:', error);
      return null;
    }
  },

  async getSessionByWork(workId) {
    try {
      const records = await pb.collection('work_sessions').getFullList({
        filter: `work = "${escapeFilter(workId)}"`,
        sort: '-created',
      });
      if (records.length === 0) return null;
      if (records.length === 1) return records[0];

      // Если есть дубликаты сессий для одной работы, выбираем сессию
      // с наибольшим числом попыток, затем самую новую.
      const sessionIds = records.map(r => r.id);
      const attempts = await this.getAttemptsBySessions(sessionIds);
      const attemptsBySession = attempts.reduce((acc, attempt) => {
        acc[attempt.session] = (acc[attempt.session] || 0) + 1;
        return acc;
      }, {});

      const sorted = [...records].sort((a, b) => {
        const attemptsA = attemptsBySession[a.id] || 0;
        const attemptsB = attemptsBySession[b.id] || 0;
        if (attemptsA !== attemptsB) return attemptsB - attemptsA;
        return new Date(b.created) - new Date(a.created);
      });

      return sorted[0];
    } catch (error) {
      console.error('Error fetching session by work:', error);
      return null;
    }
  },

  async getSessionsByWork(workId) {
    try {
      return await pb.collection('work_sessions').getFullList({
        filter: `work = "${escapeFilter(workId)}"`,
        sort: '-created',
      });
    } catch (error) {
      console.error('Error fetching sessions by work:', error);
      return [];
    }
  },

  async getSessionsByWorks(workIds = []) {
    try {
      if (!workIds.length) return [];
      const filter = workIds.map(id => `work = "${escapeFilter(id)}"`).join(' || ');
      return await pb.collection('work_sessions').getFullList({
        filter,
        sort: '-created',
        fields: 'id,work,created',
      });
    } catch (error) {
      console.error('Error fetching sessions by works:', error);
      return [];
    }
  },

  async updateSession(id, data) {
    try {
      return await pb.collection('work_sessions').update(id, data);
    } catch (error) {
      console.error('Error updating session:', error);
      throw error;
    }
  },

  // ============ ПОПЫТКИ УЧЕНИКОВ (ATTEMPTS) ============

  async createAttempt(data) {
    try {
      return await pb.collection('attempts').create(data);
    } catch (error) {
      console.error('Error creating attempt:', error);
      throw error;
    }
  },

  async getAttemptByDevice(sessionId, deviceId) {
    try {
      const records = await pb.collection('attempts').getFullList({
        filter: `session = "${escapeFilter(sessionId)}" && device_id = "${escapeFilter(deviceId)}"`,
        sort: '-created',
        expand: 'variant,achievement,unlocked_achievements',
      });
      return records.length > 0 ? records[0] : null;
    } catch (error) {
      console.error('Error fetching attempt by device:', error);
      return null;
    }
  },

  async getAttemptsByDevice(sessionId, deviceId) {
    try {
      return await pb.collection('attempts').getFullList({
        filter: `session = "${escapeFilter(sessionId)}" && device_id = "${escapeFilter(deviceId)}"`,
        expand: 'achievement,unlocked_achievements',
        sort: '-created',
      });
    } catch (error) {
      console.error('Error fetching attempts by device:', error);
      return [];
    }
  },

  async getAttemptsBySession(sessionId) {
    try {
      return await pb.collection('attempts').getFullList({
        filter: `session = "${escapeFilter(sessionId)}"`,
        sort: 'student_name,-created',
        expand: 'variant',
      });
    } catch (error) {
      console.error('Error fetching attempts:', error);
      return [];
    }
  },

  async getAttemptsBySessions(sessionIds = []) {
    try {
      if (!sessionIds.length) return [];
      const filter = sessionIds.map(id => `session = "${escapeFilter(id)}"`).join(' || ');
      return await pb.collection('attempts').getFullList({
        filter,
        fields: 'id,session,score,total',
      });
    } catch (error) {
      console.error('Error fetching attempts by sessions:', error);
      return [];
    }
  },

  async getAttemptsCountByWork(workId) {
    try {
      const sessions = await this.getSessionsByWork(workId);
      if (sessions.length === 0) return 0;

      const sessionFilters = sessions.map(s => `session = "${escapeFilter(s.id)}"`);
      const filter = sessionFilters.join(' || ');
      const attempts = await pb.collection('attempts').getFullList({
        filter,
        fields: 'id',
      });
      return attempts.length;
    } catch (error) {
      console.error('Error fetching attempts count by work:', error);
      return 0;
    }
  },

  async updateAttempt(id, data) {
    try {
      return await pb.collection('attempts').update(id, data);
    } catch (error) {
      console.error('Error updating attempt:', error);
      throw error;
    }
  },

  async deleteAttempt(id) {
    try {
      return await pb.collection('attempts').delete(id);
    } catch (error) {
      console.error('Error deleting attempt:', error);
      throw error;
    }
  },

  // ============ ОТВЕТЫ НА ЗАДАЧИ (ATTEMPT ANSWERS) ============

  async createAttemptAnswer(data) {
    try {
      return await pb.collection('attempt_answers').create(data);
    } catch (error) {
      console.error('Error creating attempt answer:', error);
      throw error;
    }
  },

  async getAttemptAnswers(attemptId) {
    try {
      return await pb.collection('attempt_answers').getFullList({
        filter: `attempt = "${escapeFilter(attemptId)}"`,
        expand: 'task',
      });
    } catch (error) {
      console.error('Error fetching attempt answers:', error);
      return [];
    }
  },

  async updateAttemptAnswer(id, data) {
    try {
      return await pb.collection('attempt_answers').update(id, data);
    } catch (error) {
      console.error('Error updating attempt answer:', error);
      throw error;
    }
  },

  async batchCreateAttemptAnswers(answers) {
    const results = [];
    const failed = [];
    for (const answer of answers) {
      try {
        const result = await pb.collection('attempt_answers').create(answer);
        results.push(result);
      } catch (error) {
        console.error('Error creating attempt answer:', error);
        failed.push({ answer, error });
      }
    }
    if (failed.length > 0) {
      const err = new Error(`Failed to create ${failed.length} of ${answers.length} attempt answers`);
      err.failed = failed;
      throw err;
    }
    return results;
  },

  async batchUpdateAttemptAnswers(answers) {
    const results = [];
    const failed = [];
    for (const { id, ...data } of answers) {
      try {
        const result = await pb.collection('attempt_answers').update(id, data);
        results.push(result);
      } catch (error) {
        console.error('Error updating attempt answer:', error);
        failed.push({ id, data, error });
      }
    }
    if (failed.length > 0) {
      const err = new Error(`Failed to update ${failed.length} of ${answers.length} attempt answers`);
      err.failed = failed;
      throw err;
    }
    return results;
  },

  // ============ АЧИВКИ (ACHIEVEMENTS) ============

  async getAchievements() {
    try {
      return await pb.collection('achievements').getFullList({
        sort: 'order,title',
      });
    } catch (error) {
      console.error('Error fetching achievements:', error);
      return [];
    }
  },

  async getAchievement(id) {
    try {
      return await pb.collection('achievements').getOne(id);
    } catch (error) {
      console.error('Error fetching achievement:', error);
      return null;
    }
  },

  async getAchievementsByIds(ids = []) {
    try {
      const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
      if (uniqueIds.length === 0) return [];

      const filter = uniqueIds
        .map((id) => `id = "${escapeFilter(id)}"`)
        .join(' || ');

      return await pb.collection('achievements').getFullList({ filter });
    } catch (error) {
      console.error('Error fetching achievements by ids:', error);
      return [];
    }
  },

  async createAchievement(data) {
    try {
      return await pb.collection('achievements').create(data);
    } catch (error) {
      console.error('Error creating achievement:', error);
      throw error;
    }
  },

  async updateAchievement(id, data) {
    try {
      return await pb.collection('achievements').update(id, data);
    } catch (error) {
      console.error('Error updating achievement:', error);
      throw error;
    }
  },

  async deleteAchievement(id) {
    try {
      return await pb.collection('achievements').delete(id);
    } catch (error) {
      console.error('Error deleting achievement:', error);
      throw error;
    }
  },

  // ============ СТУДЕНТЫ (STUDENTS AUTH) ============

  async registerStudent(data) {
    try {
      return await pb.collection('students').create(data);
    } catch (error) {
      console.error('Error registering student:', error);
      throw error;
    }
  },

  async loginStudent(username, password) {
    try {
      return await pb.collection('students').authWithPassword(username, password);
    } catch (error) {
      console.error('Error logging in student:', error);
      throw error;
    }
  },

  async logoutStudent() {
    pb.authStore.clear();
  },

  getAuthStudent() {
    return pb.authStore.model;
  },

  isStudentAuthenticated() {
    return pb.authStore.isValid && pb.authStore.model?.collectionName === 'students';
  },

  async getAttemptsByStudent(sessionId, studentId) {
    try {
      return await pb.collection('attempts').getFullList({
        filter: `session = "${escapeFilter(sessionId)}" && student = "${escapeFilter(studentId)}"`,
        expand: 'achievement,unlocked_achievements',
        sort: '-created',
      });
    } catch (error) {
      console.error('Error fetching student attempts:', error);
      return [];
    }
  },

  async getStudents() {
    try {
      return await pb.collection('students').getFullList({
        sort: '-created',
        fields: 'id,username,name,created,updated',
      });
    } catch (error) {
      console.error('Error fetching students:', error);
      return [];
    }
  },

  async getAttemptsForRegisteredStudents() {
    try {
      return await pb.collection('attempts').getFullList({
        filter: 'student != ""',
        sort: '-created',
        expand: 'session,variant',
      });
    } catch (error) {
      console.error('Error fetching attempts for registered students:', error);
      return [];
    }
  },
};

export default pb;

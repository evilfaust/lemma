import { pb, withOwner, _logAudit } from './client.js';
import { getFullListByOr } from './chunked.js';
import { escapeFilter } from '../../utils/escapeFilter';

// Журнал класса (v3.9.236): колонки `journal_columns` и клетки `journal_marks`.
// Доступ — через класс (владелец + со-учителя), см. миграцию 1786500000.
// Логика (разбор ввода, оценки, сводки) — в `utils/classJournal.js`, здесь
// только сеть. Колонки пишутся в аудит, отметки — нет (высокочастотны, как
// посещаемость).

const COLS = 'journal_columns';
const MARKS = 'journal_marks';

export const journalApi = {
  async getJournalColumns(groupId) {
    if (!groupId) return [];
    return pb.collection(COLS).getFullList({
      filter: `group = "${escapeFilter(groupId)}"`,
      sort: 'date,created',
    });
  },

  async createJournalColumn(data) {
    const rec = await pb.collection(COLS).create(withOwner(data));
    _logAudit('create', COLS, rec.id, `Колонка журнала «${rec.title}»`);
    return rec;
  },

  async updateJournalColumn(id, patch) {
    return pb.collection(COLS).update(id, patch);
  },

  // Удаление уносит и все отметки колонки (cascadeDelete).
  async deleteJournalColumn(id) {
    let summary = '';
    try {
      const rec = await pb.collection(COLS).getOne(id, { fields: 'id,title' });
      summary = `Колонка журнала «${rec.title}»`;
    } catch { /* нет — удалим без подписи */ }
    await pb.collection(COLS).delete(id);
    _logAudit('delete', COLS, id, summary);
  },

  // Все отметки класса одним запросом — фильтр по пути relation, сколько бы
  // колонок ни было.
  async getJournalMarks(groupId) {
    if (!groupId) return [];
    return pb.collection(MARKS).getFullList({
      filter: `col.group = "${escapeFilter(groupId)}"`,
    });
  },

  /**
   * Записать клетку целиком: { colId, studentId, value, comment }.
   * existingId — известная запись клетки; пустые value и comment = удалить
   * запись. Возвращает запись или null.
   */
  async saveJournalMark({ colId, studentId, value = '', comment = '' }, existingId = null) {
    const empty = !value && !comment;
    if (existingId) {
      if (empty) {
        await pb.collection(MARKS).delete(existingId);
        return null;
      }
      return pb.collection(MARKS).update(existingId, { value, comment });
    }
    if (empty) return null;
    try {
      return await pb.collection(MARKS).create(withOwner({ col: colId, student: studentId, value, comment }));
    } catch (e) {
      // Клетку уже успели создать (вторая вкладка, быстрый повторный ввод) —
      // уникальный индекс (col, student) отказал, дописываем в существующую.
      if (e?.status === 400) {
        const found = await pb.collection(MARKS).getFirstListItem(
          `col = "${escapeFilter(colId)}" && student = "${escapeFilter(studentId)}"`,
        ).catch(() => null);
        if (found) return pb.collection(MARKS).update(found.id, { value, comment });
      }
      throw e;
    }
  },

  /**
   * Попытки учеников класса за учебный год — источник онлайн-колонок.
   * window — `yearWindow(group.year)`; без него — за всё время.
   */
  async getJournalAttempts(studentIds = [], window = null) {
    const extraFilter = window
      ? `created >= "${window.from}" && created < "${window.to}"`
      : '';
    return getFullListByOr('attempts', 'student', studentIds, {
      expand: 'session,session.work,session.mc_test,session.trig_mc_test',
      sort: '-created',
    }, { extraFilter });
  },

  // Сроки выдач работ, которые учитель завёл в журнал сам (по ним ещё может
  // не быть попыток). → Map<'w:<workId>', самый поздний срок>
  async getJournalWorkDeadlines(workIds = []) {
    const map = new Map();
    if (!workIds.length) return map;
    const sessions = await getFullListByOr('work_sessions', 'work', workIds, {
      fields: 'id,work,deadline',
    });
    for (const s of sessions) {
      if (!s.deadline) continue;
      const key = `w:${s.work}`;
      if (!map.has(key) || s.deadline > map.get(key)) map.set(key, s.deadline);
    }
    return map;
  },

  // Ученики по id — выбывшие из класса, у которых в журнале остались отметки.
  async getJournalStudentsByIds(ids = []) {
    if (!ids.length) return [];
    return getFullListByOr('students', 'id', ids, {
      fields: 'id,name,username,external,status,teaching_group',
    });
  },
};

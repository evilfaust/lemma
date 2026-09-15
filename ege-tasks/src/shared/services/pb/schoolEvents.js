import { pb, _logAudit } from './client.js';
import { escapeFilter } from '../../utils/escapeFilter';

// Общий школьный календарь (`school_events`, миграция 1786000000): педсовет,
// каникулы, олимпиада, родительское собрание, пробник.
//
// 🚨 Единственная учительская коллекция БЕЗ owner-фильтра на чтение: события
// общие по определению, видит их каждый учитель. `owner` тут = автор, он же
// единственный, кому PB даст править и удалять (правило в миграции).

const EVENT_EXPAND = 'owner';

export const KIND_LABELS = {
  meeting: 'Педсовет',
  holiday: 'Каникулы',
  olympiad: 'Олимпиада',
  exam: 'Экзамен / пробник',
  parents: 'Родительское собрание',
  other: 'Другое',
};

// Цвет по умолчанию для типа события — чтобы календарь читался без настройки.
export const KIND_COLORS = {
  meeting: 'slate',
  holiday: 'green',
  olympiad: 'violet',
  exam: 'rose',
  parents: 'cyan',
  other: 'slate',
};

export const schoolEventsApi = {
  // from/to — ISO-границы видимого периода. Многодневное событие попадает в
  // выборку, если пересекается с окном: начинается до конца окна И заканчивается
  // после его начала (у однодневного конец = начало).
  async getSchoolEvents({ from, to } = {}) {
    try {
      const parts = [];
      if (to) parts.push(`date_start <= "${escapeFilter(to)}"`);
      // Однодневное лежит в окне по дате начала, многодневное — по дате конца.
      if (from) parts.push(`((date_end = "" && date_start >= "${escapeFilter(from)}") || date_end >= "${escapeFilter(from)}")`);
      return await pb.collection('school_events').getFullList({
        ...(parts.length ? { filter: parts.join(' && ') } : {}),
        sort: 'date_start',
        expand: EVENT_EXPAND,
      });
    } catch (error) {
      console.error('Error fetching school events:', error);
      return [];
    }
  },

  async createSchoolEvent(data = {}) {
    try {
      const owner = pb.authStore.model?.id;
      const rec = await pb.collection('school_events').create({ all_day: true, ...data, owner });
      _logAudit('create', 'school_events', rec.id, rec.title);
      return rec;
    } catch (error) {
      console.error('Error creating school event:', error);
      throw error;
    }
  },

  async updateSchoolEvent(id, data = {}) {
    try {
      // owner закреплён за автором при создании — не перезаписываем.
      const { owner, ...rest } = data;
      return await pb.collection('school_events').update(id, rest);
    } catch (error) {
      console.error('Error updating school event:', error);
      throw error;
    }
  },

  async deleteSchoolEvent(id) {
    try {
      let summary = '';
      try {
        const rec = await pb.collection('school_events').getOne(id);
        summary = rec?.title || '';
      } catch { /* запись могла быть уже удалена */ }
      await pb.collection('school_events').delete(id);
      _logAudit('delete', 'school_events', id, summary);
      return true;
    } catch (error) {
      console.error('Error deleting school event:', error);
      throw error;
    }
  },
};

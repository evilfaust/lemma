import { pb, _logAudit, andOwner, andMineOrCoTaught, currentTeacher } from './client.js';
import { escapeFilter } from '../../utils/escapeFilter';
import { registerGroupColors } from '../../utils/groupColors';

// Учительское фло, фаза 4: API уроков (lessons) + источники событий календаря.
export const lessonsApi = {
  // ── Lessons (уроки) ────────────────────────────────────────────────────────
  // opts: { from?, to? (ISO), groupId? }
  // Отдаёт мои уроки + уроки классов, которые я веду вторым учителем, + уроки,
  // расшаренные мне точечно (`shared_with`). Владелец приезжает в expand —
  // по нему календарь помечает чужой урок именами ведущего.
  async getLessons({ from, to, groupId } = {}) {
    try {
      const parts = [];
      if (from) parts.push(`date_plan >= "${escapeFilter(from)}"`);
      if (to) parts.push(`date_plan <= "${escapeFilter(to)}"`);
      if (groupId) parts.push(`group = "${escapeFilter(groupId)}"`);
      const filter = andMineOrCoTaught(parts.join(' && '), { shareField: 'shared_with' });
      const list = await pb.collection('lessons').getFullList({
        ...(filter ? { filter } : {}),
        sort: 'date_plan',
        expand: 'group,ktp_entry,owner',
      });
      // Цвет группы берём прямо отсюда: урок прошлогодней группы рисуется на
      // сетке даже тогда, когда сама группа в пикеры уже не попадает.
      registerGroupColors(list.map((l) => l.expand?.group).filter(Boolean));
      return list;
    } catch (error) {
      console.error('Error fetching lessons:', error);
      return [];
    }
  },

  async getLesson(id) {
    try {
      return await pb.collection('lessons').getOne(id, { expand: 'group,ktp_entry,owner' });
    } catch (error) {
      console.error('Error fetching lesson:', error);
      throw error;
    }
  },

  // data: { title, date_plan, group?, ktp_entry?, status?, note_md?, date_fact?, time_slot?, materials? }
  // time_slot: "0"|"N"|"Na"/"Nb"|"N-M" (интенсив) — слот расписания пар, см. TeacherCalendar.
  async createLesson(data) {
    try {
      const owner = pb.authStore.model?.id;
      const rec = await pb.collection('lessons').create({
        status: 'planned',
        ...data,
        owner,
      });
      _logAudit('create', 'lessons', rec.id, rec.title);
      return rec;
    } catch (error) {
      console.error('Error creating lesson:', error);
      throw error;
    }
  },

  async updateLesson(id, data) {
    try {
      const { owner, ...rest } = data;
      return await pb.collection('lessons').update(id, rest);
    } catch (error) {
      console.error('Error updating lesson:', error);
      throw error;
    }
  },

  // Точечный доступ к одному уроку: разовая замена, открытый урок.
  // Постоянный тандем — не сюда, а в `co_teachers` класса.
  async shareLesson(id, teacherIds = []) {
    try {
      const rec = await pb.collection('lessons').update(id, { shared_with: teacherIds });
      _logAudit('update', 'lessons', id,
        teacherIds.length ? `доступ к уроку у ${teacherIds.length} коллег: ${rec.title || id}` : `доступ к уроку закрыт: ${rec.title || id}`);
      return rec;
    } catch (error) {
      console.error('Error sharing lesson:', error);
      throw error;
    }
  },

  // Урок чужой — я вижу его как со-учитель класса или по точечному доступу.
  isForeignLesson(lesson) {
    const t = currentTeacher();
    return !!(t && lesson?.owner && lesson.owner !== t.id);
  },

  async deleteLesson(id) {
    try {
      await pb.collection('lessons').delete(id);
      _logAudit('delete', 'lessons', id, '');
      return true;
    } catch (error) {
      console.error('Error deleting lesson:', error);
      throw error;
    }
  },

  // Уроки, к которым прикреплён материал (работа или файл) — поиск по json-полю
  // materials (~ ищет подстроку id в сериализованном json).
  async getLessonsByMaterialId(materialId) {
    try {
      if (!materialId) return [];
      return await pb.collection('lessons').getFullList({
        filter: andOwner(`materials ~ "${escapeFilter(materialId)}"`),
        sort: '-date_plan',
        expand: 'group',
      });
    } catch (error) {
      console.error('Error fetching lessons by material:', error);
      return [];
    }
  },

  // Сессии выдачи с дедлайном — для событий календаря (дедлайны выдач).
  async getSessionsWithDeadline() {
    try {
      return await pb.collection('work_sessions').getFullList({
        filter: andOwner('deadline != ""'),
        sort: 'deadline',
        expand: 'work,mc_test,trig_mc_test',
      });
    } catch (error) {
      console.error('Error fetching sessions with deadline:', error);
      return [];
    }
  },
};

import { pb, _logAudit, andOwner } from './client.js';
import { getFullListByOr } from './chunked.js';
import { escapeFilter } from '../../utils/escapeFilter';
import { registerGroupColors } from '../../utils/groupColors';

// Курсы (онлайн-интенсивы в малых группах) — надстройка над teaching_groups
// (kind='course') и членство в них (course_members). Уроки и ДЗ ученик
// читает хуком /api/lessons/my (getMyLessons) — и курсов, и классов.
// Витрина уроков lesson_publications удалена в v3.9.293.

export const coursesApi = {
  // ── Курсы (teaching_groups с kind='course') ──────────────────────────────
  async getCourses({ includeArchived = false } = {}) {
    try {
      const parts = ['kind = "course"'];
      if (!includeArchived) parts.push('archived != true');
      const list = await pb.collection('teaching_groups').getFullList({
        filter: andOwner(parts.join(' && ')),
        sort: 'sort_order,-created',
      });
      registerGroupColors(list);
      return list;
    } catch (error) {
      console.error('Error fetching courses:', error);
      return [];
    }
  },

  // ── Членство в курсе (course_members) ────────────────────────────────────
  async getCourseMembers(courseId) {
    try {
      return await pb.collection('course_members').getFullList({
        filter: `course = "${escapeFilter(courseId)}"`,
        expand: 'student',
        sort: '-created',
      });
    } catch (error) {
      console.error('Error fetching course members:', error);
      return [];
    }
  },

  // Добавить учеников в курс (пропускает уже добавленных). studentIds — массив id.
  async addCourseMembers(courseId, studentIds = []) {
    const owner = pb.authStore.model?.id;
    const existing = await this.getCourseMembers(courseId);
    const have = new Set(existing.map((m) => m.student));
    const toAdd = (studentIds || []).filter((id) => id && !have.has(id));
    const created = [];
    for (const student of toAdd) {
      try {
        const rec = await pb.collection('course_members').create({
          owner, course: courseId, student, active: true,
        });
        created.push(rec);
      } catch (e) {
        console.error('addCourseMember failed', student, e?.message);
      }
    }
    if (created.length) _logAudit('create', 'course_members', courseId, `+${created.length} уч.`);
    return created;
  },

  async setCourseMemberActive(memberId, active) {
    return pb.collection('course_members').update(memberId, { active: !!active });
  },

  async removeCourseMember(memberId) {
    await pb.collection('course_members').delete(memberId);
    _logAudit('delete', 'course_members', memberId, '');
    return true;
  },

  // Ученики курса как записи students (для ростера посещаемости и т.п.).
  // Имена берём list-запросом по id — students.viewRule=self ломает getOne/expand,
  // но listRule публичен, поэтому фильтр по id возвращает имена.
  async getCourseStudents(courseId) {
    try {
      const members = (await this.getCourseMembers(courseId)).filter((m) => m.active !== false);
      const ids = members.map((m) => m.student).filter(Boolean);
      if (!ids.length) return [];
      return await getFullListByOr('students', 'id', ids, { sort: 'name' });
    } catch (error) {
      console.error('Error fetching course students:', error);
      return [];
    }
  },

  // Ученик: уроки и ДЗ его классов и курсов — хук pb_hooks/lessons_feed.pb.js
  // (v3.9.291). Классы — только с включённым «Расписанием для учеников».
  // null — хук ещё не выложен или ученик не вошёл.
  async getMyLessons({ from, to } = {}) {
    try {
      const query = {};
      if (from) query.from = from;
      if (to) query.to = to;
      const res = await pb.send('/api/lessons/my', { method: 'GET', query, requestKey: null });
      return { groups: res?.groups || [], lessons: res?.lessons || [] };
    } catch (error) {
      if ([401, 403, 404].includes(error?.status)) return null;
      throw error;
    }
  },
};

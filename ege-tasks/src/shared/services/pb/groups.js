import { pb, _logAudit, andOwner, andOwnerOrFree, currentTeacher } from './client.js';
import { getFullListByOr } from './chunked.js';
import { escapeFilter } from '../../utils/escapeFilter';

// Учительское фло, фаза 1: API классов/групп (коллекция `teaching_groups`).
// `owner` подставляется автоматически из токена залогиненного учителя.
export const groupsApi = {
  // ── Классы/группы (teaching_groups) ───────────────────────────────────────
  // `year` — учебный год («2025/2026»); без него отдаются группы всех лет.
  async getTeachingGroups({ includeArchived = false, year = '' } = {}) {
    try {
      const parts = [];
      if (!includeArchived) parts.push('archived != true');
      if (year) parts.push(`year = "${escapeFilter(year)}"`);
      const filter = andOwner(parts.join(' && '));
      return await pb.collection('teaching_groups').getFullList({
        ...(filter ? { filter } : {}),
        // Ручной порядок (sort_order), затем — новые сверху для одинакового sort_order.
        sort: 'sort_order,-created',
      });
    } catch (error) {
      console.error('Error fetching teaching groups:', error);
      throw error;
    }
  },

  async getTeachingGroup(id) {
    try {
      return await pb.collection('teaching_groups').getOne(id);
    } catch (error) {
      console.error('Error fetching teaching group:', error);
      throw error;
    }
  },

  // data: { name, subject?, grade?, hours_per_week?, umk?, year?, schedule? }
  async createTeachingGroup(data) {
    try {
      const owner = pb.authStore.model?.id;
      const rec = await pb.collection('teaching_groups').create({ ...data, owner });
      _logAudit('create', 'teaching_groups', rec.id, rec.name);
      return rec;
    } catch (error) {
      console.error('Error creating teaching group:', error);
      throw error;
    }
  },

  async updateTeachingGroup(id, data) {
    try {
      // owner не перезаписываем при апдейте — он закреплён при создании.
      const { owner, ...rest } = data;
      return await pb.collection('teaching_groups').update(id, rest);
    } catch (error) {
      console.error('Error updating teaching group:', error);
      throw error;
    }
  },

  // Переупорядочить группы: orderedIds — желаемый порядок (сверху вниз).
  // Пишем sort_order = индекс*10 только тем, у кого значение изменилось.
  async reorderTeachingGroups(orderedIds = [], current = []) {
    try {
      const byId = new Map(current.map((g) => [g.id, g]));
      await Promise.all(
        orderedIds.map((id, idx) => {
          const want = idx * 10;
          if (byId.get(id)?.sort_order === want) return null;
          return pb.collection('teaching_groups').update(id, { sort_order: want });
        }),
      );
    } catch (error) {
      console.error('Error reordering teaching groups:', error);
      throw error;
    }
  },

  async archiveTeachingGroup(id, archived = true) {
    try {
      return await pb.collection('teaching_groups').update(id, { archived });
    } catch (error) {
      console.error('Error archiving teaching group:', error);
      throw error;
    }
  },

  async deleteTeachingGroup(id) {
    try {
      // Сначала читаем имя для журнала, потом удаляем.
      let summary = '';
      try {
        const rec = await pb.collection('teaching_groups').getOne(id);
        summary = rec?.name || '';
      } catch { /* запись могла быть уже удалена */ }
      await pb.collection('teaching_groups').delete(id);
      _logAudit('delete', 'teaching_groups', id, summary);
      return true;
    } catch (error) {
      console.error('Error deleting teaching group:', error);
      throw error;
    }
  },

  // ── Привязка учеников к группе ────────────────────────────────────────────
  // Состав группы. Источник истины — журнал членства `group_memberships`
  // (миграция 1784300000): он переживает перевод на новый учебный год, поэтому
  // группа прошлого года остаётся с учениками, а не пустеет.
  //
  // scope: 'auto' (по умолчанию) — действующие члены, а если их нет (группа
  //        прошлого года, все переведены/выпущены) — все, кто в ней состоял;
  //        'active' — только действующие; 'all' — вся история группы.
  async getStudentsByGroup(groupId, { scope = 'auto' } = {}) {
    try {
      const byName = (a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ru');
      const fromMemberships = async (onlyActive) => {
        const parts = [`group = "${escapeFilter(groupId)}"`];
        if (onlyActive) parts.push('status = "active"');
        const rows = await pb.collection('group_memberships').getFullList({
          filter: parts.join(' && '),
          expand: 'student',
        });
        const seen = new Set();
        return rows
          .map((m) => m.expand?.student)
          .filter((st) => st && !seen.has(st.id) && seen.add(st.id))
          .sort(byName);
      };

      try {
        if (scope !== 'all') {
          const active = await fromMemberships(true);
          if (active.length || scope === 'active') return active;
        }
        const historic = await fromMemberships(false);
        if (historic.length) return historic;
      } catch (e) {
        // Коллекции ещё нет (фронт задеплоен раньше миграции) — не роняем экран,
        // работаем по прямой связи, как до v3.9.171.
        console.warn('group_memberships недоступны, читаем состав по teaching_group:', e?.status || e?.message);
      }

      // Членств нет вовсе: группа заполнялась старым фронтом (или сразу после
      // миграции) — падаем на прямую связь students.teaching_group.
      return await pb.collection('students').getFullList({
        filter: `teaching_group = "${escapeFilter(groupId)}"`,
        sort: 'name',
      });
    } catch (error) {
      console.error('Error fetching students by group:', error);
      throw error;
    }
  },

  // Число действующих учеников сразу по списку групп — для карточек в
  // «Классах и группах» (иначе запрос на каждую группу).
  async getRosterCounts(groups = []) {
    const ids = groups.map((g) => g?.id || g).filter(Boolean);
    if (!ids.length) return {};
    const counts = Object.fromEntries(ids.map((id) => [id, 0]));
    try {
      const rows = await getFullListByOr(
        'group_memberships', 'group', ids,
        { fields: 'id,group,student' },
        { extraFilter: 'status = "active"' },
      );
      for (const r of rows) {
        if (counts[r.group] !== undefined) counts[r.group] += 1;
      }
    } catch (e) {
      // Коллекции ещё нет — считаем по прямой связи (поведение до v3.9.171).
      console.warn('group_memberships недоступны, считаем состав по teaching_group');
    }
    try {
      // Группы без действующих членств: прошлогодние (все переведены) или
      // заполненные старым фронтом. Второе видно по прямой связи.
      const empty = ids.filter((id) => counts[id] === 0);
      if (empty.length) {
        const legacy = await getFullListByOr(
          'students', 'teaching_group', empty, { fields: 'id,teaching_group' },
        );
        for (const st of legacy) {
          if (counts[st.teaching_group] !== undefined) counts[st.teaching_group] += 1;
        }
      }
    } catch (error) {
      console.error('Error counting group rosters:', error);
    }
    return counts;
  },

  // Лёгкий список всех учеников для пикера привязки: включает teaching_group
  // и student_class (для предложения «привязать по совпадению названия»).
  // Выпустившиеся и выбывшие по умолчанию не предлагаются.
  async getStudentsForGroupPicker({ includeInactive = false } = {}) {
    const query = (base, fields) => pb.collection('students').getFullList({
      sort: 'name',
      fields,
      // мои ученики + «ничьи» (саморегистрация) — до модели привязки учеников
      filter: andOwnerOrFree(base),
    });
    const FIELDS = 'id,name,username,student_class,teaching_group,status,grad_year';
    try {
      const base = includeInactive ? '' : '(status = "" || status = "active")';
      return await query(base, FIELDS);
    } catch (error) {
      // Поля status ещё нет в схеме (фронт задеплоен раньше миграции) — PB
      // отвечает 400 на фильтр; отдаём список без фильтра, как до v3.9.171.
      try {
        return await query('', 'id,name,username,student_class,teaching_group');
      } catch (e) {
        console.error('Error fetching students for picker:', e);
        return [];
      }
    }
  },

  // Привязка/отвязка ученика. Пишет ОБА представления: указатель «где сейчас»
  // (students.teaching_group) и строку журнала членства.
  async setStudentGroup(studentId, groupId) {
    try {
      // groupId === null → отвязать (владелец при этом сохраняется).
      const data = { teaching_group: groupId || '' };
      // Привязка к группе «забирает» ничейного ученика (саморегистрация)
      // текущему учителю — это и есть модель привязки учеников.
      const t = currentTeacher();
      let prevGroup = '';
      try {
        const found = await pb.collection('students').getFullList({
          filter: `id = "${escapeFilter(studentId)}"`,
          fields: 'id,owner,teaching_group',
        });
        prevGroup = found[0]?.teaching_group || '';
        if (groupId && t && found[0] && !found[0].owner) {
          data.owner = t.id;
          _logAudit('update', 'students', studentId, 'привязан к учителю (claim при добавлении в группу)');
        }
      } catch (_) { /* не смогли прочитать — просто не claim'им */ }

      const rec = await pb.collection('students').update(studentId, data);

      // Журнал членства ведём мягко: сбой здесь не должен ронять привязку.
      try {
        if (prevGroup && prevGroup !== groupId) {
          await this.closeMembership(studentId, prevGroup, { status: 'left' });
        }
        if (groupId) {
          const group = await this.getTeachingGroup(groupId).catch(() => null);
          await this.joinGroup(studentId, groupId, { year: group?.year || '' });
        }
      } catch (e) {
        console.error('Не удалось записать членство в группе:', e?.message);
      }
      return rec;
    } catch (error) {
      console.error('Error setting student group:', error);
      throw error;
    }
  },

  // ── Журнал сдачи (GradeJournal) ───────────────────────────────────────────
  // Для группы: её ученики + их попытки (с сессией/работой) для сборки сетки
  // «ученик × выдача». Лёгкий expand (без achievements).
  async getGroupJournal(groupId) {
    try {
      // Внешних (вписанных вручную, без тестов) в журнал сдачи не показываем.
      const students = (await this.getStudentsByGroup(groupId)).filter((s) => !s.external);
      const perStudent = await Promise.all(
        students.map(async (s) => {
          let attempts = [];
          try {
            attempts = await pb.collection('attempts').getFullList({
              filter: `student = "${escapeFilter(s.id)}"`,
              expand: 'session,session.work,session.mc_test,session.trig_mc_test',
              sort: '-created',
            });
          } catch (e) {
            console.error('journal: attempts for student failed', s.id, e?.message);
          }
          return { student: s, attempts };
        }),
      );
      return { students, perStudent };
    } catch (error) {
      console.error('Error building group journal:', error);
      throw error;
    }
  },
};

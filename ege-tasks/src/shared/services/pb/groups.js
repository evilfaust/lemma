import { pb, _logAudit, andOwner, andOwnerOrFree, andMineOrCoTaught, currentTeacher } from './client.js';
import { getFullListByOr } from './chunked.js';
import { escapeFilter } from '../../utils/escapeFilter';
import { registerGroupColors } from '../../utils/groupColors';
import { currentAcademicYear } from '../../../utils/academicYear';
import { selectRosterMemberships, withPointerMembers } from '../../../utils/yearRollover';

// Учительское фло, фаза 1: API классов/групп (коллекция `teaching_groups`).
// `owner` подставляется автоматически из токена залогиненного учителя.
export const groupsApi = {
  // ── Классы/группы (teaching_groups) ───────────────────────────────────────
  // Год: по умолчанию отдаются группы ТЕКУЩЕГО учебного года (плюс группы без
  // года — они старше самого поля). Прошлогодние, которые не перевели на новый
  // год, в пикерах и легендах только мешают. Историческим экранам (список
  // классов, журнал, летние кампании, карточка ученика) нужен `allYears: true`,
  // конкретный год просит `year`.
  //
  // 🚨 Если в текущем году групп нет вовсе (перевод ещё не делали), фильтр
  // снимается: пустой календарь и невозможность выбрать группу в уроке —
  // хуже, чем лишние строки в списке.
  async getTeachingGroups({ includeArchived = false, year = '', allYears = false } = {}) {
    const load = async (wantedYear) => {
      const parts = [];
      if (!includeArchived) parts.push('archived != true');
      if (wantedYear) parts.push(`(year = "${escapeFilter(wantedYear)}" || year = "")`);
      // Мои классы + те, где я второй учитель (`co_teachers`).
      const filter = andMineOrCoTaught(parts.join(' && '), { groupPath: '', shareField: 'co_teachers' });
      const list = await pb.collection('teaching_groups').getFullList({
        ...(filter ? { filter } : {}),
        // Ручной порядок (sort_order), затем — новые сверху для одинакового sort_order.
        sort: 'sort_order,-created',
        expand: 'owner,co_teachers',
      });
      registerGroupColors(list);
      return list;
    };

    try {
      if (year) return await load(year);
      if (allYears) return await load('');
      const list = await load(currentAcademicYear());
      return list.length ? list : await load('');
    } catch (error) {
      console.error('Error fetching teaching groups:', error);
      throw error;
    }
  },

  async getTeachingGroup(id) {
    try {
      const rec = await pb.collection('teaching_groups').getOne(id, { expand: 'owner,co_teachers' });
      registerGroupColors([rec]);
      return rec;
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

  // Второй учитель класса: список коллег, которые ведут класс вместе с
  // владельцем. 🚨 Это единственный источник со-ведения — правила уроков,
  // посещаемости, учеников и членств выводят доступ отсюда (миграция
  // 1786200000). Убрали коллегу — доступ пропал во всех разделах сразу.
  async setGroupCoTeachers(groupId, teacherIds = []) {
    try {
      const rec = await pb.collection('teaching_groups').update(groupId, {
        co_teachers: teacherIds,
      }, { expand: 'owner,co_teachers' });
      const names = (rec.expand?.co_teachers || [])
        .map((t) => t.name || t.username).filter(Boolean).join(', ');
      _logAudit('update', 'teaching_groups', groupId,
        names ? `ведут класс ${rec.name}: ${names}` : `класс ${rec.name} ведёт только владелец`);
      return rec;
    } catch (error) {
      console.error('Error setting co-teachers:', error);
      throw error;
    }
  },

  // Класс чужой — я в нём второй учитель, а не владелец.
  isCoTaughtGroup(group) {
    const t = currentTeacher();
    return !!(t && group?.owner && group.owner !== t.id);
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
  // scope: 'auto' (по умолчанию) — состав группы «на её собственный год»:
  //        действующие члены плюс те, кого перевели/выпустили в прошлые годы;
  //        'active' — только действующие; 'all' — вся история группы.
  //        Разбор случаев и почему «просто активные» не годятся —
  //        в `selectRosterMemberships` (utils/yearRollover.js).
  async getStudentsByGroup(groupId, { scope = 'auto' } = {}) {
    try {
      const byName = (a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ru');
      const gid = escapeFilter(groupId);

      // Два запроса разом: журнал членства (вся история группы) и прямой
      // указатель «где ученик сейчас». Второй ловит учеников, записанных в
      // группу в обход членства (см. withPointerMembers), и заменяет прежний
      // запасной путь для групп, заполненных старым фронтом.
      const [membersR, pointedR] = await Promise.allSettled([
        pb.collection('group_memberships').getFullList({
          filter: `group = "${gid}"`,
          expand: 'student',
        }),
        pb.collection('students').getFullList({
          filter: `teaching_group = "${gid}"`,
          sort: 'name',
        }),
      ]);
      // Упал один из запросов — состав собирается по второму. Коллекции
      // членств может не быть (фронт задеплоен раньше миграции) — тогда
      // состав по указателю, как до v3.9.171. Упали оба — это ошибка экрана.
      if (membersR.status === 'rejected' && pointedR.status === 'rejected') throw pointedR.reason;
      if (membersR.status === 'rejected') {
        console.warn('group_memberships недоступны, читаем состав по teaching_group:', membersR.reason?.status || membersR.reason?.message);
      }
      if (pointedR.status === 'rejected') {
        console.warn('ученики по указателю группы недоступны:', pointedR.reason?.status || pointedR.reason?.message);
      }
      const rows = membersR.status === 'fulfilled' ? membersR.value : [];
      const pointed = pointedR.status === 'fulfilled' ? pointedR.value : [];

      // Кого показывать — решает чистая и покрытая тестами логика, а не
      // фильтры PocketBase.
      const picked = selectRosterMemberships(
        withPointerMembers(rows, pointed, groupId),
        { scope, currentYear: currentAcademicYear() },
      );
      const seen = new Set();
      return picked
        .map((m) => m.expand?.student)
        .filter((st) => st && !seen.has(st.id) && seen.add(st.id))
        .sort(byName);
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

    // То же правило, что у ростера (getStudentsByGroup): членства без фильтра
    // по статусу + ученики, у которых указатель стоит на группе, а членства
    // нет. Иначе карточка класса расходилась бы с его составом.
    const [rows, pointed] = await Promise.all([
      getFullListByOr('group_memberships', 'group', ids, { fields: 'id,group,student,status,year' })
        .catch(() => {
          console.warn('group_memberships недоступны, считаем состав по teaching_group');
          return [];
        }),
      getFullListByOr('students', 'teaching_group', ids, { fields: 'id,teaching_group,status' })
        .catch((error) => {
          console.error('Error counting group rosters:', error);
          return [];
        }),
    ]);
    const byGroup = new Map(ids.map((id) => [id, []]));
    for (const r of rows) byGroup.get(r.group)?.push(r);
    const pointedByGroup = new Map(ids.map((id) => [id, []]));
    for (const st of pointed) pointedByGroup.get(st.teaching_group)?.push(st);

    const currentYear = currentAcademicYear();
    for (const gid of ids) {
      const list = withPointerMembers(byGroup.get(gid), pointedByGroup.get(gid), gid);
      counts[gid] = new Set(selectRosterMemberships(list, { currentYear }).map((m) => m.student)).size;
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
};

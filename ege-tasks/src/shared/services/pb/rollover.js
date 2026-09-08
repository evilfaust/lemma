import { pb, _logAudit, andOwner, currentTeacher } from './client.js';
import { escapeFilter } from '../../utils/escapeFilter';
import { academicYearStartDate } from '../../../utils/academicYear';
import { GROUP_ACTIONS, STUDENT_ACTIONS } from '../../../utils/yearRollover';

// Перевод на новый учебный год: применение плана, собранного мастером
// (`utils/yearRollover.js` — чистая логика, здесь только запись в базу).
//
// Что делает применение:
//  • создаёт группы следующего года (`prev_group` → прошлогодняя, цепочка лет);
//  • закрывает прошлогодние членства и открывает новые (`group_memberships`);
//  • переставляет указатель `students.teaching_group`;
//  • помечает выпускников и выбывших (`students.status` + `grad_year`);
//  • архивирует группы года-источника.
//
// Повторный запуск безопасен: новая группа ищется по паре
// (prev_group, year) и переиспользуется, членства — upsert по (ученик, группа).

export const rolloverApi = {
  // Год-источник целиком: группы + их составы, для первого шага мастера.
  async getRolloverSource(year) {
    const groups = await this.getTeachingGroups({ year, includeArchived: false });
    const rosters = {};
    await Promise.all(groups.map(async (g) => {
      rosters[g.id] = await this.getStudentsByGroup(g.id).catch(() => []);
    }));
    return { groups, rosters };
  },

  // Учебные годы, по которым вообще есть группы (для селектора года).
  async getAcademicYears() {
    try {
      const rows = await pb.collection('teaching_groups').getFullList({
        fields: 'id,year',
        filter: andOwner(''),
      });
      return Array.from(new Set(rows.map((r) => (r.year || '').trim()).filter(Boolean)));
    } catch (error) {
      console.error('Error fetching academic years:', error);
      return [];
    }
  },

  // Уже созданная группа-наследник (защита от повторного применения плана).
  async findSuccessorGroup(sourceId, year) {
    const rows = await pb.collection('teaching_groups').getFullList({
      filter: `prev_group = "${escapeFilter(sourceId)}" && year = "${escapeFilter(year)}"`,
    }).catch(() => []);
    return rows[0] || null;
  },

  /**
   * Применить план перевода.
   * @param {object} plan — результат `buildRolloverPlan` (возможно, поправленный учителем)
   * @param {(step: {done: number, total: number, label: string}) => void} [onProgress]
   * @returns {Promise<{createdGroups, transferred, graduated, left, archived, errors}>}
   */
  async applyRolloverPlan(plan, onProgress = () => {}) {
    const toYear = plan?.toYear;
    const fromYear = plan?.fromYear || '';
    const joined = academicYearStartDate(toYear);
    const errors = [];
    const result = { createdGroups: [], transferred: 0, graduated: 0, left: 0, archived: 0, errors };

    const continuing = (plan?.groups || []).filter((g) => g.action === GROUP_ACTIONS.CONTINUE);
    const students = plan?.students || [];
    const total = continuing.length + students.length + (plan?.groups || []).length;
    let done = 0;
    const tick = (label) => { done += 1; onProgress({ done, total, label }); };

    // 1. Группы нового года (последовательно: их единицы, зато порядок предсказуем).
    const newIdBySource = new Map();
    for (const g of continuing) {
      try {
        const existing = await this.findSuccessorGroup(g.sourceId, toYear);
        if (existing) {
          newIdBySource.set(g.sourceId, existing.id);
          tick(`Группа «${existing.name}» уже создана`);
          continue;
        }
        const src = await this.getTeachingGroup(g.sourceId).catch(() => null);
        const created = await this.createTeachingGroup({
          name: String(g.newName || '').trim(),
          subject: src?.subject || '',
          grade: g.newGrade ?? null,
          hours_per_week: src?.hours_per_week ?? null,
          umk: src?.umk || '',
          year: toYear,
          kind: src?.kind || '',
          sort_order: src?.sort_order ?? 0,
          prev_group: g.sourceId,
        });
        newIdBySource.set(g.sourceId, created.id);
        result.createdGroups.push(created);
        tick(`Создана группа «${created.name}»`);
      } catch (e) {
        errors.push(`Группа «${g.newName || g.sourceName}»: ${e?.message || 'ошибка создания'}`);
        tick(`Не удалось создать «${g.newName || g.sourceName}»`);
      }
    }

    // 2. Ученики. Пачками по 5 — сеть не захлёбывается, прогресс идёт ровно.
    const chunk = (arr, n) => arr.reduce((acc, x, i) => {
      if (i % n === 0) acc.push([]);
      acc[acc.length - 1].push(x);
      return acc;
    }, []);

    for (const pack of chunk(students, 5)) {
      await Promise.all(pack.map(async (s) => {
        try {
          if (s.action === STUDENT_ACTIONS.TRANSFER) {
            const newGroupId = newIdBySource.get(s.targetSourceId);
            if (!newGroupId) throw new Error('нет группы назначения');
            await this.closeMembership(s.studentId, s.sourceGroupId, { status: 'transferred' });
            await this.joinGroup(s.studentId, newGroupId, { year: toYear, joined });
            const newName = continuing.find((g) => g.sourceId === s.targetSourceId)?.newName || '';
            await pb.collection('students').update(s.studentId, {
              teaching_group: newGroupId,
              status: 'active',
              // student_class — легаси-строка, которую видно в списках и пикерах:
              // держим её в согласии с текущей группой, иначе она врёт годами.
              ...(newName ? { student_class: newName } : {}),
            });
            result.transferred += 1;
          } else if (s.action === STUDENT_ACTIONS.GRADUATE || s.action === STUDENT_ACTIONS.LEAVE) {
            const graduated = s.action === STUDENT_ACTIONS.GRADUATE;
            await this.closeMembership(s.studentId, s.sourceGroupId, {
              status: graduated ? 'graduated' : 'left',
            });
            await this.setStudentStatus(s.studentId, graduated ? 'graduated' : 'left', {
              gradYear: fromYear,
            });
            if (graduated) result.graduated += 1; else result.left += 1;
          }
          // STAY — ученик остаётся как есть, трогать нечего.
        } catch (e) {
          errors.push(`${s.name || s.studentId}: ${e?.message || 'ошибка перевода'}`);
        }
        tick(s.name || 'ученик');
      }));
    }

    // 3. Архив групп года-источника.
    for (const g of plan?.groups || []) {
      if (!g.archiveSource) { tick(''); continue; }
      try {
        await this.archiveTeachingGroup(g.sourceId, true);
        result.archived += 1;
      } catch (e) {
        errors.push(`Архив «${g.sourceName}»: ${e?.message || 'ошибка'}`);
      }
      tick(`Архив «${g.sourceName}»`);
    }

    const t = currentTeacher();
    _logAudit('update', 'teaching_groups', t?.id || '',
      `перевод ${fromYear} → ${toYear}: групп ${result.createdGroups.length}, `
      + `переведено ${result.transferred}, выпущено ${result.graduated}, `
      + `выбыло ${result.left}, архив ${result.archived}`);

    return result;
  },
};

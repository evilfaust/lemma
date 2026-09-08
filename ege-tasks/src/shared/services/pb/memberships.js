import { pb, _logAudit, andOwner, currentTeacher } from './client.js';
import { escapeFilter } from '../../utils/escapeFilter';
import { academicYearStartDate } from '../../../utils/academicYear';

// Журнал членства «ученик ↔ группа» (`group_memberships`, миграция 1784300000).
//
// Зачем: `students.teaching_group` хранит только «где ученик сейчас». Перевод
// на новый учебный год перезаписывает это поле — и прошлогодняя группа теряет
// состав вместе с журналом сдачи, ростером посещаемости и летними программами.
// Здесь живёт история: строка на (ученик, группа) с годом, датами и статусом.
//
// `students.teaching_group` остаётся денормализованным указателем на текущую
// группу — его пишут вместе с членством (см. `setStudentGroup` в groups.js).

const STATUS = { ACTIVE: 'active', TRANSFERRED: 'transferred', GRADUATED: 'graduated', LEFT: 'left' };

function nowStamp() {
  return new Date().toISOString().replace('T', ' ').replace('Z', 'Z');
}

export const membershipsApi = {
  MEMBERSHIP_STATUS: STATUS,

  // Членства группы. По умолчанию только действующие; includeClosed — вся история.
  async getGroupMemberships(groupId, { includeClosed = false } = {}) {
    try {
      const parts = [`group = "${escapeFilter(groupId)}"`];
      if (!includeClosed) parts.push(`status = "${STATUS.ACTIVE}"`);
      return await pb.collection('group_memberships').getFullList({
        filter: parts.join(' && '),
        expand: 'student',
        sort: 'created',
      });
    } catch (error) {
      console.error('Error fetching group memberships:', error);
      return [];
    }
  },

  // История обучения одного ученика: где и в каком году занимался.
  async getStudentMemberships(studentId) {
    try {
      return await pb.collection('group_memberships').getFullList({
        filter: `student = "${escapeFilter(studentId)}"`,
        expand: 'group',
        sort: '-year,-created',
      });
    } catch (error) {
      console.error('Error fetching student memberships:', error);
      return [];
    }
  },

  // Все членства учебного года (для мастера перевода — один запрос вместо
  // отдельного по каждой группе).
  async getMembershipsByYear(year, { includeClosed = true } = {}) {
    try {
      const parts = [`year = "${escapeFilter(year)}"`];
      if (!includeClosed) parts.push(`status = "${STATUS.ACTIVE}"`);
      return await pb.collection('group_memberships').getFullList({
        filter: andOwner(parts.join(' && ')),
        expand: 'student',
        sort: 'created',
      });
    } catch (error) {
      console.error('Error fetching memberships by year:', error);
      return [];
    }
  },

  // Зачислить в группу. Если ученик уже числился в ней когда-то (уникальный
  // индекс student+group), запись переоткрывается, а не дублируется.
  async joinGroup(studentId, groupId, { year = '', joined = '', status = STATUS.ACTIVE } = {}) {
    const existing = await pb.collection('group_memberships').getFullList({
      filter: `student = "${escapeFilter(studentId)}" && group = "${escapeFilter(groupId)}"`,
    }).catch(() => []);

    const data = {
      student: studentId,
      group: groupId,
      year,
      joined: joined || academicYearStartDate(year) || nowStamp(),
      left: '',
      status,
    };
    if (existing[0]) {
      return pb.collection('group_memberships').update(existing[0].id, data);
    }
    const t = currentTeacher();
    return pb.collection('group_memberships').create({ ...data, owner: t?.id });
  },

  // Закрыть членство: ученик переведён / выпустился / выбыл.
  async closeMembership(studentId, groupId, { status = STATUS.LEFT, left = '' } = {}) {
    const existing = await pb.collection('group_memberships').getFullList({
      filter: `student = "${escapeFilter(studentId)}" && group = "${escapeFilter(groupId)}"`,
    }).catch(() => []);
    if (!existing[0]) return null;
    return pb.collection('group_memberships').update(existing[0].id, {
      status,
      left: left || nowStamp(),
    });
  },

  // Пометить выпуск/выбытие в профиле ученика: карточка, попытки, результаты
  // «Решу ЕГЭ» и программы остаются на месте — меняется только статус.
  async setStudentStatus(studentId, status, { gradYear = '', unlinkGroup = true } = {}) {
    const data = { status };
    if (gradYear) data.grad_year = gradYear;
    if (unlinkGroup && status !== 'active') data.teaching_group = '';
    if (status === 'active') data.grad_year = '';
    const rec = await pb.collection('students').update(studentId, data);
    _logAudit('update', 'students', studentId, `статус: ${status}${gradYear ? ` (${gradYear})` : ''}`);
    return rec;
  },
};

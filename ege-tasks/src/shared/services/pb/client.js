import PocketBase from 'pocketbase';
import { PB_BASE_URL } from '../pocketbaseUrl';

export const pb = new PocketBase(PB_BASE_URL);

// Отключаем автоматическое обновление токена для анонимного доступа
pb.autoCancellation(false);

// ─── Мультиучительство: владелец записей (v3.9.117) ───
// В ученическом приложении teacher-auth нет → хелперы «прозрачны»
// (owner не подставляется, фильтр не накладывается) — student-фло не меняется.

export function currentTeacher() {
  const m = pb.authStore.model;
  return m && m.collectionName === 'teachers' ? m : null;
}

// Данные для create с проставленным владельцем-учителем.
export function withOwner(data = {}) {
  const t = currentTeacher();
  return t ? { ...data, owner: t.id } : data;
}

// Фильтр «только моё» для списков учительских разделов.
// superadmin видит всё (фильтр не накладывается).
export function andOwner(filter = '') {
  const t = currentTeacher();
  if (!t || t.role === 'superadmin') return filter;
  const own = `owner = "${t.id}"`;
  return filter ? `(${filter}) && ${own}` : own;
}

/**
 * Фильтр «моё + со-ведение + то, чем со мной поделились» — для уроков и всего,
 * что висит на классе (`teaching_groups.co_teachers`, `lessons.shared_with`,
 * миграции 1786100000/1786200000).
 *
 * 🚨 В отличие от `andOwner`, для superadmin фильтр НЕ снимается: иначе
 * календарь завуча завалило бы уроками всей школы. Видимость здесь — про роль
 * в конкретном классе, а не про права в системе.
 *
 * groupPath  — путь до группы от текущей коллекции ('group', 'teaching_group',
 *              'lesson.group'); пустая строка = поле со-ведущих лежит на самой
 *              записи (это сама группа).
 * shareField — поле точечного доступа ('shared_with' у урока, 'co_teachers'
 *              у группы).
 */
export function andMineOrCoTaught(filter = '', { groupPath = 'group', shareField = '' } = {}) {
  const t = currentTeacher();
  // Ученический контур без teacher-auth — хелпер прозрачен, как и andOwner.
  if (!t) return filter;
  // 🚨 У мульти-relation обязательно `.id`: в PocketBase 0.36 `co_teachers ?= "x"`
  // отвечает 200 и молча не находит НИЧЕГО (v3.9.227). Верно — `co_teachers.id ?= "x"`.
  const parts = [`owner = "${t.id}"`];
  if (groupPath) parts.push(`${groupPath}.co_teachers.id ?= "${t.id}"`);
  if (shareField) parts.push(`${shareField}.id ?= "${t.id}"`);
  const mine = `(${parts.join(' || ')})`;
  return filter ? `(${filter}) && ${mine}` : mine;
}

// Вариант для учеников: мои ИЛИ ничьи (саморегистрация из ученического
// приложения владельца не имеет — такие записи видны всем учителям,
// пока не привязаны; модель привязки — следующий этап).
export function andOwnerOrFree(filter = '') {
  const t = currentTeacher();
  if (!t || t.role === 'superadmin') return filter;
  const own = `(owner = "${t.id}" || owner = "")`;
  return filter ? `(${filter}) && ${own}` : own;
}

// То же «мои + ничьи», но через relation (напр. attempts → student.owner):
// скоуп записей, у которых владелец лежит на связанной записи.
export function andRelOwnerOrFree(relField, filter = '') {
  const t = currentTeacher();
  if (!t || t.role === 'superadmin') return filter;
  const own = `(${relField}.owner = "${t.id}" || ${relField}.owner = "")`;
  return filter ? `(${filter}) && ${own}` : own;
}

// Заголовок авторизации учителя для ручек вне PB SDK (pdf-service, кастомные
// роуты pb_hooks): сервер сам валидирует токен через PocketBase.
export function authHeaders() {
  const t = currentTeacher();
  return t && pb.authStore.token ? { Authorization: `Bearer ${pb.authStore.token}` } : {};
}

// ИИ-ручки pdf-service (/latex-fix, /scan-blank) дополнительно проверяют
// teachers.ai_enabled (включается env REQUIRE_TEACHER_AI_AUTH=1 на VPS).
export const aiHeaders = authHeaders;

export function _logAudit(action, collectionName, recordId, summary) {
  try {
    const teacher = pb.authStore.model;
    if (!teacher || teacher.collectionName !== 'teachers') return;

    pb.collection('audit_log').create({
      teacher_id: teacher.id,
      teacher_name: teacher.name || teacher.username || '?',
      action,
      collection_name: collectionName,
      record_id: recordId || '',
      record_summary: (summary || '').slice(0, 500),
    }).catch((err) => {
      // Не шумим в консоль — журнал не критичен.
      if (err?.status && err.status !== 404) {
        console.debug('[audit] log failed:', err?.message);
      }
    });
  } catch (e) {
    // Пустой catch — журналирование не должно ронять приложение.
  }
}


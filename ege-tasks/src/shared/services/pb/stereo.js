import { pb, _logAudit, withOwner, currentTeacher } from './client.js';
import { escapeFilter } from '../../utils/escapeFilter';
import { codeCandidates } from '../../../utils/stereo/room';

// Эфир стереочертежей (коллекция `stereo_rooms`, миграция 1786900000).
//
// Комната — постоянная (обычно на класс): учитель пишет в неё сцену, камеру
// «смотрите отсюда», пульс «смотрите на…» и подсказку «скрещиваются»;
// ученик читает её по коду без логина, пока идёт эфир (`live = true`).

const C = 'stereo_rooms';
const isNotFound = (e) => e?.status === 404;

export const stereoApi = {
  // Комнаты текущего учителя (и у superadmin — только свои: чужие эфиры в
  // списке комнат ему не нужны).
  async getStereoRooms() {
    const t = currentTeacher();
    if (!t) return [];
    try {
      return await pb.collection(C).getFullList({
        sort: '-updated',
        filter: `owner = "${t.id}"`,
      });
    } catch (error) {
      if (isNotFound(error)) return null; // миграции ещё нет — эфир недоступен
      console.error('Error fetching stereo_rooms:', error);
      throw error;
    }
  },

  // Новая комната. Код уникален во всей базе: занят — пробуем 10a-2, 10a-3…
  async createStereoRoom({ code, title = '', group = null, scene = null }) {
    let lastError = null;
    for (const candidate of codeCandidates(code)) {
      try {
        const data = withOwner({ code: candidate, title, live: false });
        if (group) data.group = group;
        if (scene) data.scene = scene;
        const rec = await pb.collection(C).create(data);
        _logAudit('create', C, rec.id, `Комната ${candidate}`);
        return rec;
      } catch (error) {
        lastError = error;
        const codeTaken = error?.status === 400 && error?.response?.data?.code;
        if (!codeTaken) throw error;
      }
    }
    throw lastError;
  },

  async updateStereoRoom(id, patch) {
    return pb.collection(C).update(id, patch, { requestKey: null });
  },

  async deleteStereoRoom(id) {
    let summary = id;
    try {
      const rec = await pb.collection(C).getOne(id, { fields: 'code' });
      summary = `Комната ${rec.code}`;
    } catch { /* нет записи — удалять нечего, delete сам скажет */ }
    await pb.collection(C).delete(id);
    _logAudit('delete', C, id, summary);
  },

  // --- ученик ------------------------------------------------------------------

  // Комната в эфире по коду; null — эфира нет (или такой комнаты нет вовсе:
  // аноним не отличит одно от другого, и это нарочно).
  async findLiveStereoRoom(code) {
    try {
      const res = await pb.collection(C).getList(1, 1, {
        filter: `code = "${escapeFilter(code)}" && live = true`,
        requestKey: null,
      });
      return res.items[0] || null;
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  },

  // Свежая версия комнаты; null — эфир выключен (viewRule пускает только в эфире).
  async getStereoRoom(id) {
    try {
      return await pb.collection(C).getOne(id, { requestKey: null });
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  },

  subscribeStereoRoom(id, callback) {
    return pb.collection(C).subscribe(id, callback);
  },

  unsubscribeStereoRoom(id) {
    return pb.collection(C).unsubscribe(id);
  },
};

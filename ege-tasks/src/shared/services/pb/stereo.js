import { pb, _logAudit, withOwner, currentTeacher } from './client.js';
import { escapeFilter } from '../../utils/escapeFilter';
import { codeCandidates } from '../../../utils/stereo/room';

// Эфир стереочертежей (коллекция `stereo_rooms`, миграция 1786900000).
//
// Комната — постоянная (обычно на класс): учитель пишет в неё сцену, камеру
// «смотрите отсюда», пульс «смотрите на…» и подсказку «скрещиваются»;
// ученик читает её по коду без логина, пока идёт эфир (`live = true`).

const C = 'stereo_rooms';
const S = 'stereo_scenes';
const isNotFound = (e) => e?.status === 404;

// Поля kind нет до миграции 1787100000 — фильтр по нему PB отвергает (400).
// Тогда стереобиблиотека показывает все записи (планиметрических там ещё нет),
// а планиметрическая говорит «появится после обновления базы» (null).
async function listScenes(kindFilter, { withoutKind } = {}) {
  const t = currentTeacher();
  if (!t) return [];
  const load = (filter) => pb.collection(S).getFullList({
    sort: '-updated',
    filter,
    // groups нет до миграции 1787500000 — тогда его просто нет в записи, и
    // выбор классов в библиотеке не показывается.
    fields: 'id,title,note,public,kind,groups,created,updated',
  });
  try {
    return await load(`owner = "${t.id}" && ${kindFilter}`);
  } catch (error) {
    if (isNotFound(error)) return null;
    if (error?.status === 400) return withoutKind === 'all' ? load(`owner = "${t.id}"`) : null;
    console.error('Error fetching stereo_scenes:', error);
    throw error;
  }
}

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
        if (group) {
          data.group = group;
          data.groups = [group]; // до миграции 1787500000 PB лишнее поле молча пропустит
        }
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

  // Личный кабинет: эфиры, которые идут сейчас, и открытые пособия, адресованные
  // классам ученика (хук pb_hooks/stereo_feed.pb.js — классы ученика собирает
  // сервер, членства ученику не видны). null — хука ещё нет на сервере или
  // вход ученика истёк: раздел в кабинете просто не показывается.
  async getMyStereoFeed() {
    try {
      const res = await pb.send('/api/stereo/my', { method: 'GET', requestKey: null });
      return { rooms: res?.rooms || [], scenes: res?.scenes || [], works: res?.works || [] };
    } catch (error) {
      if ([401, 403, 404].includes(error?.status)) return null;
      throw error;
    }
  },

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

  // --- библиотека чертежей (stereo_scenes, миграции 1787000000 и 1787100000) ------
  //
  // В одной коллекции живут и стереочертежи (kind пустой), и планиметрические
  // (kind = 'planim'): поля, правила и пособие ученика у них общие.

  // Свои чертежи без журнала шагов (список лёгкий); null — коллекции нет.
  async getStereoScenes() {
    return listScenes('kind != "planim"', { withoutKind: 'all' });
  },

  async getPlanimScenes() {
    return listScenes('kind = "planim"');
  },

  async createPlanimScene({ title, note = '', scene }) {
    const rec = await pb.collection(S).create(withOwner({
      title, note, scene, kind: 'planim', public: false,
    }));
    _logAudit('create', S, rec.id, `Планиметрический чертёж «${title}»`);
    return rec;
  },

  async getStereoScene(id) {
    return pb.collection(S).getOne(id);
  },

  async createStereoScene({ title, note = '', scene, camera }) {
    const rec = await pb.collection(S).create(withOwner({ title, note, scene, camera, public: false }));
    _logAudit('create', S, rec.id, `Чертёж «${title}»`);
    return rec;
  },

  async updateStereoScene(id, patch) {
    return pb.collection(S).update(id, patch, { requestKey: null });
  },

  async deleteStereoScene(id) {
    let summary = id;
    try {
      const rec = await pb.collection(S).getOne(id, { fields: 'title' });
      summary = `Чертёж «${rec.title}»`;
    } catch { /* нет записи — удалять нечего, delete сам скажет */ }
    await pb.collection(S).delete(id);
    _logAudit('delete', S, id, summary);
  },

  // Пособие ученика: открытый (public) чертёж; null — ссылка закрыта или нет такого.
  async getPublicStereoScene(id) {
    try {
      return await pb.collection(S).getOne(id, { requestKey: null });
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  },
};

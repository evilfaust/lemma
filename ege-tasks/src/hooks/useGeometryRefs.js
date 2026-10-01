import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { api } from '../shared/services/pocketbase';

/**
 * Справочники раздела «Геометрия»: темы, подтемы, фасеты, источники.
 *
 * Один кэш на всё приложение: банк, редактор задачи, работы, выбор из банка
 * берут одно и то же, справочник грузится один раз (повторный запрос, пока
 * идёт первый, не создаётся). Каждый справочник независим — темы не ждут
 * фасетов и источников (раньше Promise.all ждал самый медленный, а сбой
 * одного оставлял пустыми все). Пустой ответ (сбой API) не кэшируется:
 * следующий экран попробует снова.
 *
 * После правки справочника (менеджер тем, окно фасетов) — reload(keys).
 */

const FETCHERS = {
  topics: () => api.getGeometryTopics(),
  subtopics: () => api.getGeometrySubtopics(),
  tags: () => api.getGeometryTags(),
  sources: () => api.getGeometrySources(),
};
const KEYS = Object.keys(FETCHERS);
const EMPTY_TAGS = Object.freeze({ object: [], method: [], fact: [], named: [], source: [] });
const NONE = Object.freeze([]);
const TTL = 5 * 60 * 1000;

const isEmpty = (key, v) => (key === 'tags'
  ? !v || ['object', 'method', 'fact'].every((k) => !(v[k] || []).length)
  : !Array.isArray(v) || !v.length);

let state = {
  topics: null, subtopics: null, tags: null, sources: null,
  loading: { topics: false, subtopics: false, tags: false, sources: false },
};
const loadedAt = {};
const inflight = {};
const listeners = new Set();

function set(patch) {
  state = { ...state, ...patch, loading: { ...state.loading, ...(patch.loading || {}) } };
  listeners.forEach((fn) => fn());
}

function load(key, { force = false } = {}) {
  if (inflight[key]) return inflight[key];
  const fresh = state[key] != null && Date.now() - (loadedAt[key] || 0) < TTL;
  if (fresh && !force) return Promise.resolve(state[key]);
  set({ loading: { [key]: true } });
  inflight[key] = Promise.resolve().then(() => FETCHERS[key]())
    .then((v) => {
      // Пустое — скорее сбой: показываем, но не держим в кэше
      if (!isEmpty(key, v)) loadedAt[key] = Date.now();
      else delete loadedAt[key];
      set({ [key]: v, loading: { [key]: false } });
      return v;
    })
    .catch(() => {
      set({ loading: { [key]: false } });
      return state[key];
    })
    .finally(() => { delete inflight[key]; });
  return inflight[key];
}

/** Перечитать справочники (после правки). keys — подмножество ['topics','subtopics','tags','sources']. */
export function reloadGeometryRefs(keys = KEYS) {
  return Promise.all(keys.map((k) => load(k, { force: true })));
}

/** Для тестов: сбросить кэш. */
export function _resetGeometryRefs() {
  state = { topics: null, subtopics: null, tags: null, sources: null, loading: { topics: false, subtopics: false, tags: false, sources: false } };
  KEYS.forEach((k) => { delete loadedAt[k]; delete inflight[k]; });
  listeners.forEach((fn) => fn());
}

const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const snapshot = () => state;

/**
 * @param {string[]} [keys] — какие справочники нужны экрану (остальные не грузятся)
 * @returns {{ topics, subtopics, tags, sources, loading, reload }} — до загрузки
 *   массивы пустые, tags — пустые группы; loading — по справочникам
 */
export function useGeometryRefs(keys = KEYS) {
  const s = useSyncExternalStore(subscribe, snapshot);
  const keysSig = keys.join(',');
  useEffect(() => {
    keysSig.split(',').filter(Boolean).forEach((k) => { load(k); });
  }, [keysSig]);
  const reload = useCallback((ks = keysSig.split(',')) => reloadGeometryRefs(ks), [keysSig]);
  return {
    topics: s.topics || NONE,
    subtopics: s.subtopics || NONE,
    tags: s.tags || EMPTY_TAGS,
    sources: s.sources || NONE,
    loading: s.loading,
    reload,
  };
}

export default useGeometryRefs;

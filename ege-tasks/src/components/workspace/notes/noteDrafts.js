const FIELDS = ['title', 'body', 'group', 'note_date', 'type', 'links', 'is_inbox', 'is_pinned', 'is_archived'];

const copy = (value) => JSON.parse(JSON.stringify(value));

// Отдельный ключ для каждого учителя и заметки. Не очищаем чужую/более новую
// запись (например, созданную другой вкладкой во время сетевого запроса).
export function createNoteDraftStore(storage, owner) {
  const key = (id) => `lemma.notes.draft.v1:${owner}:${id}`;
  return {
    read(id) {
      try {
        const draft = JSON.parse(storage.getItem(key(id)));
        if (!draft || draft.owner !== owner || draft.noteId !== id || !draft.token
          || !draft.patch || typeof draft.patch !== 'object' || Array.isArray(draft.patch)) return null;
        const patch = Object.fromEntries(FIELDS.filter((f) => Object.hasOwn(draft.patch, f))
          .map((f) => [f, draft.patch[f]]));
        if ('body' in patch && !Array.isArray(patch.body)) return null;
        return Object.keys(patch).length ? { ...draft, patch } : null;
      } catch { return null; }
    },
    write(id, draft) {
      try {
        storage.setItem(key(id), JSON.stringify({ ...draft, owner, noteId: id }));
        return true;
      } catch { return false; }
    },
    remove(id, token) {
      try {
        if (this.read(id)?.token === token) storage.removeItem(key(id));
      } catch { /* При недоступном хранилище текст остаётся в очереди. */ }
    },
  };
}

// Запросы одной заметки выполняются строго последовательно. Патч хранится до
// подтверждения сервера; поздний ответ не стирает изменения, набранные в пути.
export function createNoteSaveQueue({ store, save, onState = () => {}, onSaved = () => {}, delay = 800 }) {
  const entries = new Map();
  let stopped = false;
  let serial = 0;
  const session = `${Date.now()}-${Math.random()}`;

  function emit(id, entry, phase) {
    entry.phase = phase;
    if (!stopped) onState(id, { phase, persisted: entry.persisted, error: entry.error });
  }

  function schedule(id, entry, ms) {
    clearTimeout(entry.timer);
    if (!stopped) entry.timer = setTimeout(() => flush(id), ms);
  }

  async function flush(id) {
    const entry = entries.get(id);
    if (!entry || !Object.keys(entry.patch).length) return;
    clearTimeout(entry.timer);
    if (entry.request) {
      await entry.request;
      if (Object.keys(entry.patch).length && !entry.error) return flush(id);
      return;
    }
    const version = entry.version;
    const patch = copy(entry.patch);
    const token = entry.token;
    emit(id, entry, 'saving');
    entry.request = (async () => {
      try {
        const record = await Promise.resolve().then(() => save(id, patch));
        entry.error = null;
        entry.failures = 0;
        if (version === entry.version) {
          entry.patch = {};
          store.remove(id, token);
          emit(id, entry, 'saved');
        } else {
          emit(id, entry, 'pending');
          schedule(id, entry, 0);
        }
        if (!stopped) onSaved(id, record);
      } catch (error) {
        entry.error = error;
        entry.failures += 1;
        emit(id, entry, 'error');
        // Ошибки прав/валидации требуют действия пользователя, сетевые — повтора.
        if (!error.status || error.status >= 500 || error.status === 429) {
          schedule(id, entry, Math.min(30000, 2000 * (2 ** Math.min(entry.failures - 1, 4))));
        }
      } finally {
        entry.request = null;
      }
    })();
    await entry.request;
  }

  return {
    has: (id) => entries.has(id),
    pending: () => [...entries.values()].some((e) => Object.keys(e.patch).length),
    enqueue(id, patch, baseUpdated = '') {
      let entry = entries.get(id);
      if (!entry) {
        entry = { patch: {}, version: 0, baseUpdated, failures: 0 };
        entries.set(id, entry);
      }
      entry.patch = { ...entry.patch, ...copy(patch) };
      entry.version += 1;
      entry.token = `${session}-${++serial}`;
      entry.error = null;
      entry.persisted = store.write(id, {
        patch: entry.patch, baseUpdated: entry.baseUpdated,
        savedAt: new Date().toISOString(), token: entry.token,
      });
      emit(id, entry, 'pending');
      schedule(id, entry, delay);
    },
    flush,
    async flushAll() { await Promise.all([...entries.keys()].map(flush)); },
    forget(id) {
      const entry = entries.get(id);
      if (!entry) return true;
      if (entry.request || Object.keys(entry.patch).length) return false;
      clearTimeout(entry.timer);
      store.remove(id, entry.token);
      entries.delete(id);
      return true;
    },
    resume() { stopped = false; },
    stop() {
      stopped = true;
      for (const entry of entries.values()) clearTimeout(entry.timer);
      // На уходе со страницы делаем последнюю попытку. При неудаче черновик
      // остаётся в storage; фоновых таймеров после размонтирования нет.
      this.flushAll();
    },
  };
}

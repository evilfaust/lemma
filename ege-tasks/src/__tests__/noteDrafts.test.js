// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createNoteDraftStore, createNoteSaveQueue } from '../components/workspace/notes/noteDrafts';

function storageMock() {
  const data = new Map();
  return { getItem: (key) => data.get(key) || null, setItem: (key, value) => data.set(key, value), removeItem: (key) => data.delete(key) };
}
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

describe('сохранение заметок и черновиков', () => {
  let store;
  let save;
  let states;
  let queue;
  beforeEach(() => {
    vi.useFakeTimers();
    store = createNoteDraftStore(storageMock(), 'teacher1');
    save = vi.fn().mockResolvedValue({ updated: 'new' });
    states = vi.fn();
    queue = createNoteSaveQueue({ store, save, onState: states });
  });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('сразу сохраняет локально заголовок и тело, объединяет их в один запрос', async () => {
    queue.enqueue('a', { title: 'Урок' }, 'base');
    queue.enqueue('a', { body: [{ type: 'paragraph', content: 'Новый текст' }] }, 'base');
    expect(store.read('a').patch).toEqual({ title: 'Урок', body: [{ type: 'paragraph', content: 'Новый текст' }] });
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(800);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][1].title).toBe('Урок');
    expect(store.read('a')).toBeNull();
    expect(queue.pending()).toBe(false);
    expect(states.mock.lastCall[1].phase).toBe('saved');
  });

  it('не теряет черновик после ошибки и повторяет отправку', async () => {
    save.mockRejectedValueOnce(new Error('offline'));
    queue.enqueue('a', { title: 'Не терять' });
    await queue.flush('a');
    expect(store.read('a').patch.title).toBe('Не терять');
    expect(states.mock.lastCall[1].phase).toBe('error');
    await vi.advanceTimersByTimeAsync(2000);
    expect(save).toHaveBeenCalledTimes(2);
    expect(store.read('a')).toBeNull();
  });

  it('сериализует запросы и не стирает новый текст поздним ответом', async () => {
    const first = deferred();
    const second = deferred();
    save.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    queue.enqueue('a', { title: 'Первый' });
    const request = queue.flush('a');
    await Promise.resolve();
    queue.enqueue('a', { title: 'Второй' });
    await vi.advanceTimersByTimeAsync(800);
    expect(save).toHaveBeenCalledTimes(1);
    first.resolve({ updated: 'v1' });
    await request;
    await vi.advanceTimersByTimeAsync(0);
    expect(store.read('a').patch.title).toBe('Второй');
    expect(save.mock.lastCall).toEqual(['a', { title: 'Второй' }]);
    second.resolve({ updated: 'v2' });
    await vi.advanceTimersByTimeAsync(0);
    expect(store.read('a')).toBeNull();
    expect(queue.pending()).toBe(false);
  });

  it('после переключения заметки отправляет изменения каждой по её id', async () => {
    queue.enqueue('a', { title: 'Первая' });
    queue.enqueue('b', { title: 'Вторая' });
    await queue.flushAll();
    expect(save).toHaveBeenCalledWith('a', { title: 'Первая' });
    expect(save).toHaveBeenCalledWith('b', { title: 'Вторая' });
  });

  it('при уходе отправляет последнюю версию, при неудаче оставляет черновик без фоновых повторов', async () => {
    save.mockRejectedValue(new Error('offline'));
    queue.enqueue('a', { title: 'На потом' });
    queue.stop();
    await vi.advanceTimersByTimeAsync(60000);
    expect(save).toHaveBeenCalledTimes(1);
    expect(store.read('a').patch.title).toBe('На потом');
    expect(states.mock.calls.at(-1)[1].phase).toBe('pending');
  });

  it('не зацикливает отправку при ошибке прав, позволяет вручную повторить', async () => {
    save.mockRejectedValueOnce(Object.assign(new Error('forbidden'), { status: 403 }));
    queue.enqueue('a', { title: 'На потом' });
    await queue.flush('a');
    await vi.advanceTimersByTimeAsync(60000);
    expect(save).toHaveBeenCalledTimes(1);
    await queue.flush('a');
    expect(save).toHaveBeenCalledTimes(2);
  });

  it('не даёт удалить заметку с неотправленными правками', async () => {
    save.mockRejectedValue(new Error('offline'));
    queue.enqueue('a', { title: 'Черновик' });
    await queue.flush('a');
    expect(queue.forget('a')).toBe(false);
    expect(store.read('a')).not.toBeNull();
  });

  it('при заполненном storage продолжает отправлять текст, сообщает об отсутствии локальной копии', async () => {
    store = createNoteDraftStore({ setItem() { throw new Error('QuotaExceeded'); }, getItem() { return null; } }, 't');
    queue = createNoteSaveQueue({ store, save, onState: states });
    queue.enqueue('a', { title: 'Текст' });
    expect(states.mock.lastCall[1].persisted).toBe(false);
    await queue.flush('a');
    expect(save).toHaveBeenCalledWith('a', { title: 'Текст' });
  });
});

describe('изоляция и восстановление локальных черновиков', () => {
  it('новый экземпляр находит черновик только соответствующего учителя', () => {
    const storage = storageMock();
    const own = createNoteDraftStore(storage, 'first');
    own.write('a', { token: 'one', patch: { title: 'Личное' }, baseUpdated: 'base' });
    expect(createNoteDraftStore(storage, 'first').read('a').patch.title).toBe('Личное');
    expect(createNoteDraftStore(storage, 'second').read('a')).toBeNull();
  });

  it('ответ старой вкладки не удаляет более новый черновик', () => {
    const store = createNoteDraftStore(storageMock(), 't');
    store.write('a', { token: 'old', patch: { title: 'Старое' } });
    store.write('a', { token: 'new', patch: { title: 'Новое' } });
    store.remove('a', 'old');
    expect(store.read('a').patch.title).toBe('Новое');
    store.remove('a', 'new');
    expect(store.read('a')).toBeNull();
  });

  it('повреждённый JSON и некорректное тело не ломают открытие заметки', () => {
    const storage = storageMock();
    const store = createNoteDraftStore(storage, 't');
    storage.setItem('lemma.notes.draft.v1:t:a', '{broken');
    expect(store.read('a')).toBeNull();
    store.write('a', { token: 't', patch: { body: 'wrong' } });
    expect(store.read('a')).toBeNull();
  });
});

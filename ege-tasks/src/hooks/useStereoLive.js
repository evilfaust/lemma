import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../shared/services/pocketbase';
import { clampCamera } from '../utils/stereo/camera';

const ROOM_KEY = 'stereo.roomId';

/**
 * Эфир стереочертежа — сторона учителя.
 *
 * Держит список комнат и выбранную комнату; пока идёт эфир, каждое изменение
 * сцены уходит в запись комнаты. Записи идут ОЧЕРЕДЬЮ: пока летит одна,
 * следующие правки сливаются в одну (последняя версия сцены побеждает) —
 * ученик не получит журнал «из прошлого» из-за гонки запросов.
 *
 * rooms === null — коллекции нет (миграция не применена): эфир недоступен,
 * редактор работает как раньше.
 */
export default function useStereoLive({ scene, enabled = true }) {
  const [rooms, setRooms] = useState(undefined);
  const [roomId, setRoomId] = useState(() => {
    try { return localStorage.getItem(ROOM_KEY) || ''; } catch { return ''; }
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    if (!enabled) return;
    try {
      const list = await api.getStereoRooms();
      setRooms(list);
      setError('');
    } catch (e) {
      setRooms([]);
      setError(e?.message || 'Не удалось загрузить комнаты');
    }
  }, [enabled]);

  useEffect(() => { reload(); }, [reload]);

  const room = useMemo(
    () => (Array.isArray(rooms) ? rooms.find((r) => r.id === roomId) || rooms[0] || null : null),
    [rooms, roomId],
  );
  const isLive = !!room?.live;

  const selectRoom = useCallback((id) => {
    setRoomId(id);
    try { localStorage.setItem(ROOM_KEY, id); } catch { /* приватный режим */ }
  }, []);

  // --- очередь записей ----------------------------------------------------------
  const pendingRef = useRef(null);
  const inflightRef = useRef(false);
  const roomRef = useRef(room);
  roomRef.current = room;

  const flush = useCallback(async () => {
    if (inflightRef.current) return;
    inflightRef.current = true;
    setSaving(true);
    try {
      while (pendingRef.current && roomRef.current) {
        const patch = pendingRef.current;
        pendingRef.current = null;
        const id = roomRef.current.id;
        try {
          const rec = await api.updateStereoRoom(id, patch);
          setRooms((list) => (Array.isArray(list) ? list.map((r) => (r.id === rec.id ? rec : r)) : list));
          setError('');
        } catch (e) {
          setError(e?.message || 'Не удалось отправить в эфир');
        }
      }
    } finally {
      inflightRef.current = false;
      setSaving(false);
    }
  }, []);

  const queue = useCallback((patch) => {
    if (!roomRef.current) return;
    pendingRef.current = { ...(pendingRef.current || {}), ...patch };
    flush();
  }, [flush]);

  // Сцена в эфире — за каждым изменением.
  const liveRef = useRef(isLive);
  liveRef.current = isLive;
  useEffect(() => {
    if (liveRef.current && scene) queue({ scene });
  }, [scene, queue]);

  const seq = () => Date.now();

  const start = useCallback((camera) => {
    queue({ live: true, scene, camera: { ...clampCamera(camera), seq: seq() } });
  }, [queue, scene]);
  const stop = useCallback(() => queue({ live: false }), [queue]);
  const pushCamera = useCallback((camera) => {
    if (liveRef.current) queue({ camera: { ...clampCamera(camera), seq: seq() } });
  }, [queue]);
  const pushPulse = useCallback((target) => {
    if (liveRef.current) queue({ pulse: { points: target.points || [], lines: target.lines || [], seq: seq() } });
  }, [queue]);
  const pushNotice = useCallback((text) => {
    if (liveRef.current) queue({ notice: { text: String(text).slice(0, 300), seq: seq() } });
  }, [queue]);

  const createRoom = useCallback(async ({ code, title, group }) => {
    const rec = await api.createStereoRoom({ code, title, group, scene });
    setRooms((list) => [rec, ...(Array.isArray(list) ? list : [])]);
    selectRoom(rec.id);
    return rec;
  }, [scene, selectRoom]);

  const deleteRoom = useCallback(async (id) => {
    await api.deleteStereoRoom(id);
    setRooms((list) => (Array.isArray(list) ? list.filter((r) => r.id !== id) : list));
  }, []);

  return {
    rooms, room, isLive, saving, error,
    selectRoom, reload, createRoom, deleteRoom,
    start, stop, pushCamera, pushPulse, pushNotice,
  };
}

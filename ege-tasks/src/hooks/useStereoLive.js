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
 *
 * «Все смотрят сюда» (lead): пока включено, ракурс учителя уходит в эфир
 * непрерывно (не чаще раза в LEAD_MS, последний — всегда), а у учеников
 * вращение заблокировано. Флаг живёт в той же записи: camera.lead.
 */
export const LEAD_MS = 120;

const camPatch = (camera, on) => ({ camera: { ...clampCamera(camera), seq: Date.now(), lead: !!on } });

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

  // --- «Все смотрят сюда» ------------------------------------------------------
  const [lead, setLeadState] = useState(false);
  const leadRef = useRef(false);
  leadRef.current = lead && isLive;
  const leadTimer = useRef(0);
  const leadLast = useRef(0);
  const leadCam = useRef(null);

  const sendLead = useCallback(() => {
    clearTimeout(leadTimer.current);
    leadTimer.current = 0;
    if (!leadRef.current || !leadCam.current) return;
    leadLast.current = Date.now();
    queue(camPatch(leadCam.current, true));
  }, [queue]);

  // Ракурс учителя — в эфир, пока ведёт: сразу, если давно не слали, иначе
  // одним отложенным (последний ракурс не теряется).
  const streamCamera = useCallback((camera) => {
    if (!leadRef.current) return;
    leadCam.current = camera;
    const wait = LEAD_MS - (Date.now() - leadLast.current);
    if (wait <= 0) sendLead();
    else if (!leadTimer.current) leadTimer.current = setTimeout(sendLead, wait);
  }, [sendLead]);

  const setLead = useCallback((on, camera) => {
    setLeadState(!!on);
    leadRef.current = !!on && liveRef.current;
    clearTimeout(leadTimer.current);
    leadTimer.current = 0;
    leadCam.current = camera;
    leadLast.current = Date.now();
    if (liveRef.current) queue(camPatch(camera, on));
  }, [queue]);

  // Эфир закончился — вести больше некого.
  useEffect(() => { if (!isLive) setLeadState(false); }, [isLive]);
  useEffect(() => () => clearTimeout(leadTimer.current), []);

  const start = useCallback((camera) => {
    setLeadState(false);
    queue({ live: true, scene, ...camPatch(camera, false) });
  }, [queue, scene]);
  const stop = useCallback(() => {
    setLeadState(false);
    queue({ live: false });
  }, [queue]);
  const pushCamera = useCallback((camera) => {
    if (liveRef.current) queue(camPatch(camera, leadRef.current));
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
    isLeading: lead && isLive, setLead, streamCamera,
  };
}

import { useCallback, useEffect, useState } from 'react';
import {
  RightOutlined, CodeSandboxOutlined, BorderOuterOutlined, FileTextOutlined, ReadOutlined,
} from '@ant-design/icons';
import { api } from '../../services/pocketbase';

const POLL_MS = 20000;
const SHOW_SCENES = 4;

/**
 * Эфир и чертежи учителя в личном кабинете ученика.
 *
 * Эфир показывается, только пока идёт, и только классам, которым его адресовал
 * учитель; пособия — открытые чертежи библиотеки, отмеченные классами ученика.
 * Подбор по классам делает сервер (GET /api/stereo/my). Эфир начинается посреди
 * урока, поэтому кабинет переспрашивает раз в 20 с и при возврате на вкладку.
 * Ссылки — те же /b/<код> и /s/<id>, что учитель даёт на доске.
 * Работы по геометрии (v3.9.284) — открытые учителем, по /w/<id>: только условия.
 * Задания учителя (v3.9.306) — обычные работы в режиме показа, по /r/<id>:
 * только условия, без выдачи и ответов.
 */
/** Лента кабинета с опросом: null — ещё не пришла или хука нет. */
export function useStereoFeed() {
  const [feed, setFeed] = useState(null);

  const load = useCallback(async () => {
    try {
      setFeed(await api.getMyStereoFeed());
    } catch {
      /* сеть моргнула — оставляем прошлый список, следующий опрос поправит */
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, POLL_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  return feed;
}

/** Идущие эфиры — карточками «в эфире». */
export function LiveRoomCards({ rooms }) {
  if (!rooms?.length) return null;
  return rooms.map((r) => (
    <a key={r.code} className="student-live-card" href={`/student/b/${encodeURIComponent(r.code)}`}>
      <span className="student-live-card__dot">в эфире</span>
      <span className="student-live-card__title">{r.title || r.code}</span>
      <span className="student-live-card__go">Смотреть <RightOutlined /></span>
    </a>
  ));
}

export const hasTeacherMaterials = (feed) => !!feed
  && (feed.scenes?.length > 0 || feed.works?.length > 0 || feed.shows?.length > 0);

/** Задания, работы по геометрии и чертежи от учителя. */
export function TeacherMaterials({ feed }) {
  const [showAll, setShowAll] = useState(false);
  if (!hasTeacherMaterials(feed)) return null;
  const works = feed.works || [];
  const shows = feed.shows || [];
  const allScenes = feed.scenes || [];
  const scenes = showAll ? allScenes : allScenes.slice(0, SHOW_SCENES);

  return (
    <>
      {shows.length > 0 && (
        <div className="student-drawings">
          <div className="student-drawings__head">Задания от учителя</div>
          <ul className="student-drawings__list">
            {shows.map((w) => (
              <li key={w.id}>
                <a className="student-drawings__item" href={`/student/r/${w.id}`}>
                  <ReadOutlined />
                  <span className="student-drawings__title">{w.title}</span>
                  <RightOutlined className="student-drawings__arrow" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {works.length > 0 && (
        <div className="student-drawings">
          <div className="student-drawings__head">Работы по геометрии</div>
          <ul className="student-drawings__list">
            {works.map((w) => (
              <li key={w.id}>
                <a className="student-drawings__item" href={`/student/w/${w.id}`}>
                  <FileTextOutlined />
                  <span className="student-drawings__title">{w.title}</span>
                  <RightOutlined className="student-drawings__arrow" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {allScenes.length > 0 && (
        <div className="student-drawings">
          <div className="student-drawings__head">Чертежи от учителя</div>
          <ul className="student-drawings__list">
            {scenes.map((s) => (
              <li key={s.id}>
                <a className="student-drawings__item" href={`/student/s/${s.id}`}>
                  {s.kind === 'planim' ? <BorderOuterOutlined /> : <CodeSandboxOutlined />}
                  <span className="student-drawings__title">{s.title}</span>
                  <RightOutlined className="student-drawings__arrow" />
                </a>
              </li>
            ))}
          </ul>
          {allScenes.length > SHOW_SCENES && (
            <button type="button" className="student-drawings__more" onClick={() => setShowAll((v) => !v)}>
              {showAll ? 'Свернуть' : `Показать все (${allScenes.length})`}
            </button>
          )}
        </div>
      )}
    </>
  );
}

/** Эфир + материалы одним блоком (на главной они разнесены по разделам). */
export default function StudentStereoFeed() {
  const feed = useStereoFeed();
  if (!feed || (!feed.rooms.length && !hasTeacherMaterials(feed))) return null;
  return (
    <div className="student-stereo-feed">
      <LiveRoomCards rooms={feed.rooms} />
      <TeacherMaterials feed={feed} />
    </div>
  );
}

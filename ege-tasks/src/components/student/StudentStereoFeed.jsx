import { useCallback, useEffect, useState } from 'react';
import { RightOutlined, CodeSandboxOutlined, BorderOuterOutlined } from '@ant-design/icons';
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
 */
export default function StudentStereoFeed() {
  const [feed, setFeed] = useState(null);
  const [showAll, setShowAll] = useState(false);

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

  if (!feed || (!feed.rooms.length && !feed.scenes.length)) return null;

  const scenes = showAll ? feed.scenes : feed.scenes.slice(0, SHOW_SCENES);

  return (
    <div className="student-stereo-feed">
      {feed.rooms.map((r) => (
        <a key={r.code} className="student-live-card" href={`/student/b/${encodeURIComponent(r.code)}`}>
          <span className="student-live-card__dot">в эфире</span>
          <span className="student-live-card__title">{r.title || r.code}</span>
          <span className="student-live-card__go">Смотреть <RightOutlined /></span>
        </a>
      ))}

      {feed.scenes.length > 0 && (
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
          {feed.scenes.length > SHOW_SCENES && (
            <button type="button" className="student-drawings__more" onClick={() => setShowAll((v) => !v)}>
              {showAll ? 'Свернуть' : `Показать все (${feed.scenes.length})`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

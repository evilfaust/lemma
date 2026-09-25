import { useEffect, useState } from 'react';
import { Button } from 'antd';
import { PlusOutlined, SolutionOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../shared/services/pocketbase';
import './lessonJournal.css';

const SCALE_TEXT = { points: 'баллы', grade: '2–5', pass: 'зачёт', percent: '%' };

function scaleText(col) {
  if (col.source === 'work' || col.source === 'session') return 'онлайн';
  if ((col.scale || 'points') === 'points' && col.max_score) return `из ${col.max_score}`;
  return SCALE_TEXT[col.scale] || '';
}

/** Ссылка в журнал класса: ?group=…&lesson=… (новая колонка урока) или &entry=… */
export function journalLink(groupId, params = {}) {
  return `/app/journal?${new URLSearchParams({ group: groupId, ...params })}`;
}

/**
 * Блок «Журнал» в карточке урока (окно урока и мобильная шторка, v3.9.239):
 * колонки журнала класса, привязанные к уроку, — «Отметки» открывает журнал
 * сразу на «Вводе списком»; «Колонка в журнал» заводит колонку этого урока
 * (дата — из урока, «н» — из посещаемости). Урок без класса журнала не имеет:
 * блока нет. Журнал недоступен (нет миграции, нет прав) — блока тоже нет.
 */
export default function LessonJournalBlock({ lessonId, groupId, canEdit }) {
  const navigate = useNavigate();
  const [cols, setCols] = useState(null); // null — грузится, false — журнала нет

  useEffect(() => {
    let alive = true;
    setCols(null);
    if (!lessonId || !groupId) return undefined;
    api.getJournalColumnsByLesson(lessonId)
      .then((list) => { if (alive) setCols(list.filter((c) => !c.hidden)); })
      .catch(() => { if (alive) setCols(false); });
    return () => { alive = false; };
  }, [lessonId, groupId]);

  if (!lessonId || !groupId || cols === false) return null;

  return (
    <div className="ljb">
      <div className="ljb__head">
        <span className="ljb__title"><SolutionOutlined /> Журнал</span>
        {canEdit && (
          <Button
            size="small"
            icon={<PlusOutlined />}
            onClick={() => navigate(journalLink(groupId, { lesson: lessonId }))}
          >
            Колонка в журнал
          </Button>
        )}
      </div>
      {cols === null && <div className="ljb__hint">Загрузка…</div>}
      {cols && cols.map((c) => (
        <div key={c.id} className="ljb__row">
          <span className="ljb__name" title={c.title}>{c.title}</span>
          <span className="ljb__meta">{scaleText(c)}</span>
          <Button size="small" type="link" onClick={() => navigate(journalLink(groupId, { entry: c.id }))}>
            {canEdit ? 'Отметки' : 'Открыть'}
          </Button>
        </div>
      ))}
      {cols && !cols.length && (
        <div className="ljb__hint">
          Оценки за урок ведутся в журнале класса. Кто отмечен «нет» в посещаемости,
          получит «н» сам.
        </div>
      )}
    </div>
  );
}

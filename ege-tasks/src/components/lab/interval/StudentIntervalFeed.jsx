import { useEffect, useState } from 'react';
import { Button } from 'antd';
import { api } from '../../../shared/services/pocketbase';
import { intervalExperimentPath } from '../../../utils/lab/intervalContract';

// Вне назначенного состава блок отсутствует. Отдельный запрос не затрагивает
// ленты обычных работ и не требует менять их серверные контракты.
export default function StudentIntervalFeed({ studentId, onPresence }) {
  const [works, setWorks] = useState([]);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let alive = true;
    if (!api.getMyLabIntervals) return undefined;
    setError('');
    api.getMyLabIntervals().then(res => { if (alive) { setWorks(res.works || []); onPresence?.(!!res.works?.length); } }).catch(e => {
      // Постепенная установка: до появления хуков обычный кабинет работает.
      if (alive && e.status !== 404) { console.warn('[lab-interval] Не удалось загрузить назначения', e.status); setError('Не удалось обновить экспериментальные тренировки'); }
    });
    return () => { alive = false; };
  }, [studentId, retry, onPresence]);
  if (!works.length) return null;
  return <section className="sh-section" aria-label="Лаборатория">
    <div className="sh-section-head"><h2 className="sh-section-title">Лаборатория · эксперимент</h2></div>
    {error && <p role="alert">{error} <Button size="small" onClick={() => setRetry(v => v + 1)}>Повторить</Button></p>}
    {works.map(w => <div className="sh-todo" key={w.id}>
      <div className="sh-todo-main"><div className="sh-todo-title">{w.title}</div><div className="sh-todo-due">{w.status === 'completed' ? 'Завершено' : !w.isOpen ? 'Закрыто учителем' : `${w.done} из ${w.count} заданий`}</div></div>
      <Button size="small" className="sh-btn" href={intervalExperimentPath(w.id)}>{w.status === 'completed' ? 'Итог' : !w.isOpen ? 'Посмотреть' : w.status === 'started' ? 'Продолжить' : 'Начать'}</Button>
    </div>)}
  </section>;
}

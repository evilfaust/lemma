import { Tooltip } from 'antd';
import { formatAttemptDuration, getAttemptTiming } from '../../utils/attemptTiming';

const full = (date) => date ? date.toLocaleString('ru-RU') : 'нет данных';
const short = (date) => date ? date.toLocaleString('ru-RU', {
  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
}) : '—';

export default function AttemptTiming({ attempt }) {
  if (attempt.source === 'scan') return <span title="Работа внесена с бумажного бланка">Бланк</span>;
  const { start, end, seconds } = getAttemptTiming(attempt);
  const label = seconds !== null ? `От начала до сдачи · ${formatAttemptDuration(seconds)}`
    : attempt.status === 'started' ? (start ? 'В работе' : 'Не приступил') : 'Время не записано';
  return (
    <Tooltip title={<>
      <div>Начало попытки: {full(start)}</div>
      <div>Сдано: {full(end)}</div>
      {seconds !== null && <div>{label} (включая перерывы)</div>}
    </>}>
      <div style={{ fontSize: 12, whiteSpace: 'nowrap', lineHeight: 1.5 }}>
        <div>{short(start)} → {short(end)}</div>
        <div style={{ color: 'var(--text-secondary, #888)' }}>{label}</div>
      </div>
    </Tooltip>
  );
}

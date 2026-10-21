import { CheckCircleOutlined, ClockCircleOutlined, StopOutlined } from '@ant-design/icons';
import { PAIRS } from '../lessonTime';
import './lessonModal.css';

/**
 * Поля формы урока кнопками вместо выпадающих списков (v3.9.392): статус —
 * три кнопки цветом статуса (как чип урока в календаре), пара — ряд кнопок с
 * временем начала. Совместимы с Form.Item (value/onChange).
 */

export const LESSON_STATUSES = [
  { value: 'planned', label: 'Запланирован', tone: 'blue', icon: <ClockCircleOutlined /> },
  { value: 'done', label: 'Проведён', tone: 'teal', icon: <CheckCircleOutlined /> },
  { value: 'cancelled', label: 'Отменён', tone: 'neutral', icon: <StopOutlined /> },
];

export function LessonStatusField({ value = 'planned', onChange, disabled }) {
  return (
    <div className="lsf-status" role="radiogroup" aria-label="Статус урока">
      {LESSON_STATUSES.map((s) => {
        const on = value === s.value;
        return (
          <button
            key={s.value} type="button" role="radio" aria-checked={on} disabled={disabled}
            className={`lsf-status-btn lsf-tone-${s.tone}${on ? ' is-on' : ''}`}
            onClick={() => { if (!on) onChange?.(s.value); }}
          >
            {s.icon}<span>{s.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// Подпись кнопки пары: номер крупно, начало мелко («1» / «10:15»).
const pairShort = (p) => (p.key === '0' ? '0' : Number(p.key) >= 6 ? `В${Number(p.key) - 5}` : p.key);

/** Выбор пары кнопками. `allowNone` — кнопка «своё» (время вручную). */
export function PairButtons({ value, onChange, disabled, allowNone = true, isDisabled }) {
  return (
    <div className="lsf-pairs" role="radiogroup" aria-label="Пара">
      {PAIRS.map((p) => {
        const on = value === p.key;
        const off = disabled || isDisabled?.(p.key);
        return (
          <button
            key={p.key} type="button" role="radio" aria-checked={on} disabled={off}
            className={`lsf-pair${on ? ' is-on' : ''}`} title={`${p.label} · ${p.full[0]}–${p.full[1]}`}
            onClick={() => onChange?.(on && allowNone ? null : p.key)}
          >
            <b>{pairShort(p)}</b>
            <small>{p.full[0]}</small>
          </button>
        );
      })}
      {allowNone && (
        <button
          type="button" role="radio" aria-checked={!value} disabled={disabled}
          className={`lsf-pair lsf-pair--free${!value ? ' is-on' : ''}`} title="Без пары — время вручную"
          onClick={() => onChange?.(null)}
        >
          <b>своё</b>
          <small>время</small>
        </button>
      )}
    </div>
  );
}

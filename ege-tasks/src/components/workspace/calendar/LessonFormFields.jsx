import { useCallback, useState } from 'react';
import { Form, Segmented, Typography } from 'antd';
import { CheckCircleOutlined, ClockCircleOutlined, StopOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { Chip, GroupColorPicker } from '../ui';
import { PAIRS, guessSlot, slotRangeFromCode } from '../lessonTime';
import './lessonModal.css';

/**
 * Поля формы урока кнопками вместо выпадающих списков (v3.9.392): статус —
 * три кнопки цветом статуса (как чип урока в календаре), пара — ряд кнопок с
 * временем начала. Совместимы с Form.Item (value/onChange).
 * С v3.9.393 здесь же общий выбор времени урока (`useLessonSlot` +
 * `LessonSlotPicker`) — им живут и окно урока, и окно создания события.
 */

/**
 * Пара / половина / интенсив урока. Выбор пары ставит время начала в поле
 * формы `field`; код слота (`lessons.time_slot`) — `slot.code`.
 */
export function useLessonSlot(form, field) {
  const [mode, setModeRaw] = useState('single');
  const [pair, setPair] = useState(null);
  const [part, setPart] = useState('full');
  const [endPair, setEndPair] = useState(null);

  const setStartTime = useCallback((str) => {
    const [h, m] = str.split(':').map(Number);
    const cur = form.getFieldValue(field) || dayjs();
    form.setFieldsValue({ [field]: dayjs(cur).hour(h).minute(m).second(0).millisecond(0) });
  }, [form, field]);

  const applySlot = (p, prt) => {
    setPair(p);
    setPart(prt);
    if (!p) return;
    const def = PAIRS.find((x) => x.key === p);
    if (def) setStartTime((p === '0' || prt === 'full') ? def.full[0] : (prt === '1' ? def.halves[0][0] : def.halves[1][0]));
  };

  const applyIntensive = (s, e) => {
    setPair(s);
    setEndPair(e);
    if (!s) return;
    const def = PAIRS.find((x) => x.key === s);
    if (def) setStartTime(def.full[0]);
  };

  const setMode = (m) => {
    setModeRaw(m);
    if (m === 'intensive') { if (pair) applyIntensive(pair, endPair); }
    else if (pair) applySlot(pair, part);
  };

  /** Состояние из сохранённого урока: код слота, иначе пара из ячейки, иначе по времени. */
  const load = useCallback(({ timeSlot = '', slotPair = null, date } = {}) => {
    const inten = /^(\d)-(\d)$/.exec(timeSlot);
    const half = /^(\d)([ab])$/.exec(timeSlot);
    if (inten) { setModeRaw('intensive'); setPair(inten[1]); setEndPair(inten[2]); setPart('full'); return; }
    setModeRaw('single'); setEndPair(null);
    if (half) { setPair(half[1]); setPart(half[2] === 'a' ? '1' : '2'); }
    else if (timeSlot && PAIRS.some((p) => p.key === timeSlot)) { setPair(timeSlot); setPart('full'); }
    else if (slotPair) { setPair(slotPair); setPart('full'); }
    else if (date) { const g = guessSlot(dayjs(date).toDate()); setPair(g.pair); setPart(g.part); }
    else { setPair(null); setPart('full'); }
  }, []);

  /** Время поменяли руками — подобрать пару, если оно на неё попало. */
  const guess = (d) => {
    if (!d || mode === 'intensive') return;
    const g = guessSlot(d.toDate());
    setPair(g.pair); setPart(g.part);
  };

  let code = '';
  if (mode === 'intensive') {
    if (pair && endPair && Number(endPair) > Number(pair)) code = `${pair}-${endPair}`;
  } else if (pair) {
    code = (pair === '0' || part === 'full') ? pair : pair + (part === '1' ? 'a' : 'b');
  }
  const intensiveCount = mode === 'intensive' && code ? Number(endPair) - Number(pair) + 1 : 0;

  return {
    mode, pair, part, endPair, code, intensiveCount,
    range: slotRangeFromCode(code),
    invalid: mode === 'intensive' && !!pair && !!endPair && Number(endPair) <= Number(pair),
    setMode, applySlot, applyIntensive, load, guess,
  };
}

/** Блок «Пара / Интенсив» поверх `useLessonSlot`. */
export function LessonSlotPicker({ slot, disabled }) {
  const { mode, pair, part, endPair, range, intensiveCount } = slot;
  return (
    <div className="lsf-slot">
      <Segmented value={mode} onChange={slot.setMode} disabled={disabled}
        options={[
          { value: 'single', label: 'Пара' },
          { value: 'intensive', label: 'Интенсив (2–4 пары)' },
        ]} />
      {mode === 'single' ? (
        <>
          <PairButtons value={pair} disabled={disabled}
            onChange={(v) => slot.applySlot(v, v === '0' ? 'full' : part)} />
          {pair && (
            <div className="lsf-sub">
              <Segmented value={part} disabled={disabled || pair === '0'}
                onChange={(v) => slot.applySlot(pair, v)}
                options={[
                  { value: 'full', label: 'Вся пара' },
                  { value: '1', label: '1-я пол.' },
                  { value: '2', label: '2-я пол.' },
                ]} />
              {range && <Chip tone="blue" dot={false}>{range[0]}–{range[1]}</Chip>}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="lsf-sub">
            <span className="lsf-sub-label">с</span>
            <PairButtons value={pair} allowNone={false} disabled={disabled}
              onChange={(v) => slot.applyIntensive(v, endPair)} />
          </div>
          <div className="lsf-sub">
            <span className="lsf-sub-label">по</span>
            <PairButtons value={endPair} allowNone={false} disabled={disabled}
              isDisabled={(k) => !!pair && Number(k) <= Number(pair)}
              onChange={(v) => slot.applyIntensive(pair, v)} />
          </div>
          {range && (
            <div><Chip tone="violet" dot={false}>{range[0]}–{range[1]} · {intensiveCount} пары</Chip></div>
          )}
          {slot.invalid && (
            <Typography.Text type="danger" style={{ fontSize: 12 }}>конец должен быть позже начала</Typography.Text>
          )}
        </>
      )}
    </div>
  );
}

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

/**
 * Цвет урока без класса (v3.9.228). С выбранным классом поле прячется: урок
 * красится цветом класса, и второй источник цвета только запутал бы.
 * Значение при этом держится в форме — снял класс, и выбор вернулся.
 */
export function LessonColorField({ form }) {
  const group = Form.useWatch('group', form);
  return (
    <Form.Item name="color" label="Цвет" hidden={!!group}
      tooltip="Урок без класса. С классом урок красится цветом класса">
      <GroupColorPicker />
    </Form.Item>
  );
}

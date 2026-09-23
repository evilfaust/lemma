import { DatePicker, TimePicker } from 'antd';
import dayjs from 'dayjs';
import useIsMobile from '../../../hooks/useIsMobile';

/**
 * Дата + время двумя полями вместо DatePicker showTime. Панель showTime рисует
 * календарь и колонки часов рядом (~470px) и на телефоне уезжает за экран;
 * по отдельности обе панели влезают в 320px. Совместим с Form.Item (value/onChange).
 */
export default function DateTimeField({ value, onChange, disabled }) {
  // На телефоне поле только открывает панель — иначе вылезает клавиатура.
  const mobile = useIsMobile();
  const cur = value ? dayjs(value) : null;
  const setDate = (d) => {
    if (!d) { onChange?.(null); return; }
    const base = cur || dayjs().hour(9).minute(0);
    onChange?.(d.hour(base.hour()).minute(base.minute()).second(0).millisecond(0));
  };
  const setTime = (t) => {
    if (!t) return;
    const base = cur || dayjs();
    onChange?.(base.hour(t.hour()).minute(t.minute()).second(0).millisecond(0));
  };
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <DatePicker
        value={cur} onChange={setDate} format="DD.MM.YYYY" disabled={disabled}
        inputReadOnly={mobile} allowClear={false} style={{ flex: 1, minWidth: 0 }}
      />
      <TimePicker
        value={cur} onChange={setTime} format="HH:mm" minuteStep={5} disabled={disabled}
        inputReadOnly={mobile} allowClear={false} needConfirm={false} style={{ width: 104 }}
      />
    </div>
  );
}

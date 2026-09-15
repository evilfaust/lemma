import { CheckOutlined } from '@ant-design/icons';
import {
  GROUP_COLORS, GROUP_COLOR_LABELS, TONE_HEX, autoGroupTone,
} from './groupColor';

/**
 * Палитра цвета класса: «авто» (оттенок по id, как было до v3.9.203) плюс
 * 13 оттенков. Поле формы Ant Design — value/onChange, пустая строка = авто.
 *
 * autoKey — id (или имя) группы: по нему рисуется превью автоцвета, чтобы
 * учитель видел, от чего отказывается.
 */
export default function GroupColorPicker({ value = '', onChange, autoKey = '' }) {
  const auto = TONE_HEX[autoGroupTone(autoKey)];
  const pick = (v) => onChange?.(v === value ? '' : v);

  return (
    <div className="ws-palette">
      <button
        type="button"
        className={`ws-palette__auto${value ? '' : ' is-active'}`}
        onClick={() => onChange?.('')}
        title="Цвет подберётся автоматически"
      >
        <span className="ws-palette__dot" style={{ background: auto.base }} />
        авто
      </button>
      {GROUP_COLORS.map((tone) => (
        <button
          key={tone}
          type="button"
          className={`ws-palette__swatch${value === tone ? ' is-active' : ''}`}
          style={{ background: TONE_HEX[tone].base }}
          onClick={() => pick(tone)}
          title={GROUP_COLOR_LABELS[tone]}
          aria-label={GROUP_COLOR_LABELS[tone]}
          aria-pressed={value === tone}
        >
          {value === tone && <CheckOutlined />}
        </button>
      ))}
    </div>
  );
}

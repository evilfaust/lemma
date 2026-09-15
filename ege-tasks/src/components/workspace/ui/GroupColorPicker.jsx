import { CheckOutlined } from '@ant-design/icons';
import {
  GROUP_COLORS, GROUP_COLOR_LABELS, TONE_HEX, autoGroupTone,
} from './groupColor';

/**
 * Палитра цвета: «авто» плюс 13 оттенков. Поле формы Ant Design —
 * value/onChange, пустая строка = авто.
 *
 * autoKey  — id (или имя) сущности: по нему рисуется превью автоцвета, чтобы
 *            учитель видел, от чего отказывается (класс красится по хешу id).
 * autoTone — готовый оттенок вместо хеша: у школьных мероприятий «авто» = цвет
 *            по типу события, а не по случайному id.
 * autoLabel — подпись кнопки «авто» (например «по типу»).
 */
export default function GroupColorPicker({
  value = '', onChange, autoKey = '', autoTone = '', autoLabel = 'авто',
}) {
  const auto = TONE_HEX[autoTone] || TONE_HEX[autoGroupTone(autoKey)];
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
        {autoLabel}
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

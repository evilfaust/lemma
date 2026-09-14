import { Alert, Divider, InputNumber, Segmented, Space, Switch, Typography } from 'antd';
import { CARD_COUNTS, FONT_PT_OPTIONS, cardFormatLabel } from '../../utils/marathonCards';
import { MAX_SHEETS } from '../../utils/marathonWorksheet';
import SettingRow from './SettingRow';

const { Text } = Typography;

const COUNT_OPTIONS = CARD_COUNTS.map(n => ({ value: n, label: String(n) }));
const TEXT_OPTIONS = FONT_PT_OPTIONS.map(pt => ({ value: pt, label: String(pt) }));
const DRAWING_OPTIONS = [
  { value: 's', label: 'S' },
  { value: 'm', label: 'M' },
  { value: 'l', label: 'L' },
  { value: 'xl', label: 'XL' },
];
const FONT_OPTIONS = [
  { value: 'sans', label: 'Гротеск' },
  { value: 'serif', label: 'Антиква' },
];
const FILL_OPTIONS = [
  { value: 'none', label: 'Нет' },
  { value: 'repeat', label: 'До целых листов' },
  { value: 'copies', label: 'Столько копий' },
];

/**
 * Настройки листа карточек. Плотность меняет и кегль по умолчанию
 * (см. `applyCardCount`), поэтому у неё свой обработчик, а не общий `patch`.
 */
export default function MarathonCardsSettings({
  settings, patch, onCount, taskCount = 0, summary = null, tooLong = 0,
}) {
  const s = settings;

  return (
    <Space direction="vertical" size={10} style={{ width: '100%' }}>
      <Space wrap size={16}>
        <SettingRow
          label="Карточек на лист:"
          hint="Лист A4 делится на равные карточки; между ними — поле для реза. Чем плотнее лист, тем мельче кегль по умолчанию."
        >
          <Segmented size="small" value={s.count} onChange={onCount} options={COUNT_OPTIONS} />
        </SettingRow>
        <Text type="secondary" style={{ fontSize: 12 }}>{cardFormatLabel(s.count)}</Text>
      </Space>

      <Divider style={{ margin: '2px 0' }} />

      <Space wrap size={16}>
        <SettingRow label="Кегль, pt:" hint="Размер шрифта условия. На плотных листах ставьте мельче.">
          <Segmented size="small" value={s.textSize} onChange={v => patch({ textSize: v })} options={TEXT_OPTIONS} />
        </SettingRow>
        <SettingRow label="Шрифт условия:">
          <Segmented size="small" value={s.fontFamily} onChange={v => patch({ fontFamily: v })} options={FONT_OPTIONS} />
        </SettingRow>
        <SettingRow label="Размер чертежа:">
          <Segmented size="small" value={s.drawingSize} onChange={v => patch({ drawingSize: v })} options={DRAWING_OPTIONS} />
        </SettingRow>
        <SettingRow
          label="Вписывать условие:"
          hint="Длинное условие не влезает в карточку — кегль уменьшается ровно настолько, чтобы текст поместился."
        >
          <Switch size="small" checked={s.autoFit} onChange={v => patch({ autoFit: v })} />
        </SettingRow>
      </Space>

      <Divider style={{ margin: '2px 0' }} />

      <Space wrap size={16}>
        <SettingRow label="Название марафона:" hint="Печатается мелким в шапке карточки — по нему карточки не перепутаются с прошлым марафоном.">
          <Switch size="small" checked={s.showTitle} onChange={v => patch({ showTitle: v })} />
        </SettingRow>
        <SettingRow label="Поле «Ответ»:" hint="Линия внизу карточки: ученик пишет ответ прямо на карточке и приносит её на защиту.">
          <Switch size="small" checked={s.showAnswer} onChange={v => patch({ showAnswer: v })} />
        </SettingRow>
        <SettingRow label="Сложность:">
          <Switch size="small" checked={s.showDifficulty} onChange={v => patch({ showDifficulty: v })} />
        </SettingRow>
        <SettingRow label="Код задачи:">
          <Switch size="small" checked={s.showCode} onChange={v => patch({ showCode: v })} />
        </SettingRow>
        <SettingRow label="Марка Lemma:">
          <Switch size="small" checked={s.showLogo} onChange={v => patch({ showLogo: v })} />
        </SettingRow>
      </Space>

      <Divider style={{ margin: '2px 0' }} />

      {/* Карточки печатаются пачкой на весь класс: одной задачи нужно столько
          копий, сколько участников. */}
      <Space wrap size={16}>
        <SettingRow
          label="Заполнять лист:"
          hint="«До целых листов» — повторять весь набор задач подряд, пока пачка не закончится ровно на краю листа (все задачи поровну). «Столько копий» — печатать заданное число копий каждой задачи."
        >
          <Segmented size="small" value={s.fill} onChange={v => patch({ fill: v })} options={FILL_OPTIONS} />
        </SettingRow>
        {s.fill === 'copies' && (
          <SettingRow label="Копий каждой задачи:" hint="Обычно — число участников марафона.">
            <InputNumber size="small" min={1} max={200} value={s.copies} onChange={v => patch({ copies: v || 1 })} />
          </SettingRow>
        )}
      </Space>

      {s.fill !== 'none' && summary && taskCount > 0 && (
        <Alert
          type={summary.capped ? 'warning' : 'info'}
          showIcon
          style={{ padding: '4px 10px' }}
          message={
            <span style={{ fontSize: 12 }}>
              {summary.capped
                ? `Пачка упёрлась в потолок ${MAX_SHEETS} листов — уменьшите число копий.`
                : `${taskCount} задач → ${summary.sheets} листов, по ${summary.copiesEach} копий каждой задачи`}
              {!summary.capped && summary.empty > 0 && `, пустых мест: ${summary.empty}`}
            </span>
          }
        />
      )}

      {tooLong > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ padding: '4px 10px' }}
          message={
            <span style={{ fontSize: 12 }}>
              {tooLong === 1 ? 'Одно условие не влезает' : `Условий не влезает: ${tooLong}`} —
              {' '}возьмите меньше карточек на лист или мельче кегль.
            </span>
          }
        />
      )}
    </Space>
  );
}

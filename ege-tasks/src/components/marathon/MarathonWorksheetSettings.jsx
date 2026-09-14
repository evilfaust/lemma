import { Alert, Divider, InputNumber, Segmented, Space, Switch, Tooltip, Typography } from 'antd';
import { FONT_PT_OPTIONS, MAX_SHEETS, countsFor } from '../../utils/marathonWorksheet';

const { Text } = Typography;

const MODE_OPTIONS = [
  { value: 'work', label: 'С местом для решения' },
  { value: 'card', label: 'Только карточка' },
];
const TEXT_OPTIONS = FONT_PT_OPTIONS.map(pt => ({ value: pt, label: String(pt) }));
const DRAWING_OPTIONS = [
  { value: 's', label: 'S' },
  { value: 'm', label: 'M' },
  { value: 'l', label: 'L' },
  { value: 'xl', label: 'XL' },
];
const FILL_OPTIONS = [
  { value: 'blank', label: 'Пусто' },
  { value: 'lines', label: 'Линейка' },
  { value: 'grid', label: 'Клетка' },
];
const FONT_OPTIONS = [
  { value: 'sans', label: 'Гротеск' },
  { value: 'serif', label: 'Антиква' },
];
const ATTEMPT_OPTIONS = [0, 2, 3, 4, 5, 6].map(n => ({ value: n, label: n === 0 ? 'Нет' : String(n) }));
const FILL_OPTIONS_LIST = [
  { value: 'none', label: 'Нет' },
  { value: 'repeat', label: 'До целых листов' },
  { value: 'copies', label: 'Столько копий' },
];

const Row = ({ label, hint, children }) => {
  const text = <Text style={{ fontSize: 13 }}>{label}</Text>;
  return (
    <Space size={6}>
      {hint ? <Tooltip title={hint}>{text}</Tooltip> : text}
      {children}
    </Space>
  );
};

/**
 * Настройки отрезного листа марафона. Режим меняет плотность листа и наличие
 * места для решения (см. MARATHON_WORKSHEET_PRESETS), поэтому у него свой
 * обработчик, а не общий `patch`.
 */
export default function MarathonWorksheetSettings({ settings, patch, onMode, taskCount = 0, summary = null }) {
  const s = settings;
  const work = s.mode === 'work';
  const counts = countsFor(s.mode).map(n => ({ value: n, label: String(n) }));

  return (
    <Space direction="vertical" size={10} style={{ width: '100%' }}>
      <Space wrap size={16}>
        <Row
          label="Режим листа:"
          hint="«С местом для решения» — под условием клетка или линейка. «Только карточка» — одно условие, ученик решает в тетради; карточек на лист влезает больше."
        >
          <Segmented size="small" value={s.mode} onChange={onMode} options={MODE_OPTIONS} />
        </Row>
        <Row label="Блоков на лист:" hint="Лист делится на равные части, между ними — линия разреза.">
          <Segmented size="small" value={s.count} onChange={v => patch({ count: v })} options={counts} />
        </Row>
      </Space>

      <Divider style={{ margin: '2px 0' }} />

      <Space wrap size={16}>
        <Row label="Поле ФИ:">
          <Switch size="small" checked={s.showName} onChange={v => patch({ showName: v })} />
        </Row>
        <Row label="Клетки попыток:" hint="Квадратики в шапке блока: учитель отмечает попытки защиты задачи.">
          <Segmented size="small" value={s.attempts} onChange={v => patch({ attempts: v })} options={ATTEMPT_OPTIONS} />
        </Row>
        {work && (
          <Row label="Разлиновка:">
            <Segmented size="small" value={s.solutionFill} onChange={v => patch({ solutionFill: v })} options={FILL_OPTIONS} />
          </Row>
        )}
      </Space>

      <Divider style={{ margin: '2px 0' }} />

      {/* Добивка листа: марафон печатается пачкой на весь класс, и лист с
          пустым хвостом — выброшенная бумага. */}
      <Space wrap size={16}>
        <Row
          label="Заполнять лист:"
          hint="«До целых листов» — повторять весь набор задач подряд, пока пачка не закончится ровно на краю листа (все задачи поровну). «Столько копий» — печатать заданное число копий каждой задачи, хвост добивается повтором."
        >
          <Segmented size="small" value={s.fill} onChange={v => patch({ fill: v })} options={FILL_OPTIONS_LIST} />
        </Row>
        {s.fill === 'copies' && (
          <Row label="Копий каждой задачи:" hint="Обычно — число участников марафона.">
            <InputNumber
              size="small"
              min={1}
              max={200}
              value={s.copies}
              onChange={v => patch({ copies: v || 1 })}
            />
          </Row>
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

      <Space wrap size={16}>
        <Row label="Кегль, pt:" hint="Размер шрифта условия. Мелкий кегль нужен плотным листам — 10 и 12 карточек.">
          <Segmented size="small" value={s.textSize} onChange={v => patch({ textSize: v })} options={TEXT_OPTIONS} />
        </Row>
        <Row label="Размер чертежа:">
          <Segmented size="small" value={s.drawingSize} onChange={v => patch({ drawingSize: v })} options={DRAWING_OPTIONS} />
        </Row>
        <Row label="Шрифт условия:">
          <Segmented size="small" value={s.fontFamily} onChange={v => patch({ fontFamily: v })} options={FONT_OPTIONS} />
        </Row>
        <Row label="Код задачи:">
          <Switch size="small" checked={s.showTaskCode} onChange={v => patch({ showTaskCode: v })} />
        </Row>
      </Space>
    </Space>
  );
}

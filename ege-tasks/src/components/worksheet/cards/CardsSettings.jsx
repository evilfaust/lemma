import { Alert, Divider, Input, InputNumber, Segmented, Space, Switch, Tooltip, Typography } from 'antd';
import { KIM_IMAGE_SIZE_OPTIONS } from '../../../utils/kimImageSize';
import {
  CARD_LAYOUTS, CARD_LAYOUT_KEYS, FONT_PT_OPTIONS, canSplitColumns, cardsSummary, layoutLabel,
  sheetsWord, variantVisible,
} from '../../../utils/worksheetCards';

const { Text } = Typography;

/** Мини-схема раскладки: лист A4 с карточками, как он ляжет под нож. */
function LayoutThumb({ layoutKey }) {
  const { cols, rows } = CARD_LAYOUTS[layoutKey];
  const w = 21;
  const h = 29.6;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" style={{ display: 'block', margin: '0 auto' }}>
      <rect x="0.5" y="0.5" width={w - 1} height={h - 1} fill="#fff" stroke="currentColor" strokeWidth="1" />
      {Array.from({ length: cols - 1 }, (_, i) => {
        const x = 0.5 + ((i + 1) * (w - 1)) / cols;
        return <line key={`v${i}`} x1={x} x2={x} y1="0.5" y2={h - 0.5} stroke="currentColor" strokeWidth="0.8" strokeDasharray="1.5 1" />;
      })}
      {Array.from({ length: rows - 1 }, (_, i) => {
        const y = 0.5 + ((i + 1) * (h - 1)) / rows;
        return <line key={`h${i}`} y1={y} y2={y} x1="0.5" x2={w - 0.5} stroke="currentColor" strokeWidth="0.8" strokeDasharray="1.5 1" />;
      })}
    </svg>
  );
}

const LAYOUT_OPTIONS = CARD_LAYOUT_KEYS.map(key => ({
  value: key,
  label: (
    <Tooltip title={`${CARD_LAYOUTS[key].hint} · ${layoutLabel(key)}`}>
      <div style={{ padding: '4px 2px 2px', lineHeight: 1.2 }}>
        <LayoutThumb layoutKey={key} />
        <div style={{ fontSize: 12, marginTop: 3 }}>{CARD_LAYOUTS[key].count}</div>
      </div>
    </Tooltip>
  ),
}));

const FILL_OPTIONS = [
  { value: 'sheet', label: 'Добить лист' },
  { value: 'count', label: 'На класс' },
  { value: 'none', label: 'По одной' },
];

const ANSWER_OPTIONS = [
  { value: 'line', label: 'Строка' },
  { value: 'box', label: 'Рамка' },
  { value: 'strip', label: 'Таблица внизу' },
  { value: 'none', label: 'Нет' },
];

const FONT_OPTIONS = FONT_PT_OPTIONS.map(pt => ({ value: pt, label: `${pt}` }));
const FAMILY_OPTIONS = [
  { value: 'sans', label: 'Гротеск' },
  { value: 'serif', label: 'Антиква' },
];

const Subtitle = ({ children }) => (
  <Text style={{ fontSize: 12, fontWeight: 600, color: '#8c8c8c', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
    {children}
  </Text>
);

const Field = ({ label, children }) => (
  <Space size={6}>
    <Text style={{ fontSize: 13, color: '#595959' }}>{label}:</Text>
    {children}
  </Space>
);

const SwitchField = ({ label, hint, ...props }) => {
  const text = <Text style={{ fontSize: 13, color: '#595959' }}>{label}</Text>;
  return (
    <Space size={6}>
      <Switch size="small" {...props} />
      {hint ? <Tooltip title={hint}>{text}</Tooltip> : text}
    </Space>
  );
};

/**
 * Настройки режима «Карточки» (секция «Оформление» Генератора).
 * Все значения — один объект `settings` (utils/worksheetCards.js), правка —
 * `patch(delta)`, смена раскладки — `onLayout` (тянет кегль пресета).
 */
export default function CardsSettings({
  settings, patch, onLayout, variantsCount = 1, variantLabel, setVariantLabel,
}) {
  const summary = cardsSummary({
    variantsCount, layout: settings.layout, fill: settings.fill, copies: settings.copies,
  });
  const wide = canSplitColumns(settings.layout);
  const showVariant = variantVisible(settings, variantsCount);

  return (
    <>
      <Alert
        type="info"
        showIcon={false}
        style={{ marginBottom: 12, fontSize: 12 }}
        message="Лист A4 режется по пунктиру на одинаковые карточки, на каждой — вся работа. Пустых мест не остаётся: лист добивается копиями вариантов, соседние карточки — разные варианты. Если работа не влезает, кегль уменьшается сам."
      />

      <Subtitle>Раскладка и тираж</Subtitle>
      <div style={{ marginTop: 6 }}>
        <Segmented value={settings.layout} onChange={onLayout} options={LAYOUT_OPTIONS} />
        <Text style={{ fontSize: 12, color: '#8c8c8c', display: 'block', marginTop: 4 }}>
          {CARD_LAYOUTS[settings.layout].hint} · {layoutLabel(settings.layout)}
        </Text>
      </div>

      <Space wrap size={[16, 10]} style={{ width: '100%', marginTop: 10 }}>
        <Field label="Экземпляры">
          <Tooltip title="«Добить лист» — пустые места листа заполняются копиями. «На класс» — сколько карточек нужно всего (округляется до целого листа, остаток — запасные). «По одной» — карточка на вариант, как раньше.">
            <Segmented size="small" value={settings.fill} onChange={(fill) => patch({ fill })} options={FILL_OPTIONS} />
          </Tooltip>
        </Field>
        {settings.fill === 'count' && (
          <Field label="Учеников">
            <InputNumber
              size="small"
              min={1}
              max={500}
              value={settings.copies}
              onChange={(v) => patch({ copies: v || 1 })}
              style={{ width: 72 }}
            />
          </Field>
        )}
        <Text style={{ fontSize: 13 }}>
          → <b>{summary.cards}</b> карт., <b>{summary.sheets}</b> {sheetsWord(summary.sheets)}
          {summary.spare > 0 && <Text type="secondary"> (запасных {summary.spare})</Text>}
        </Text>
      </Space>

      <Divider style={{ margin: '12px 0' }} />

      <Subtitle>Текст</Subtitle>
      <Space wrap size={[16, 10]} style={{ width: '100%', marginTop: 6 }}>
        <Field label="Кегль, pt">
          <Segmented size="small" value={settings.fontPt} onChange={(fontPt) => patch({ fontPt })} options={FONT_OPTIONS} />
        </Field>
        <Field label="Шрифт">
          <Segmented size="small" value={settings.fontFamily} onChange={(fontFamily) => patch({ fontFamily })} options={FAMILY_OPTIONS} />
        </Field>
        <SwitchField
          label="Подгонять кегль"
          hint="Длинная работа не обрезается рамкой карточки: кегль этого варианта уменьшается ровно настолько, чтобы влезла (но не мельче ~⅔ от заданного)."
          checked={settings.autoFit}
          onChange={(autoFit) => patch({ autoFit })}
        />
        <SwitchField
          label="Две колонки задач"
          hint={wide ? 'Короткие задачи в две колонки внутри карточки.' : 'Только для широких карточек (A4, A5, ⅓ листа).'}
          checked={settings.innerColumns === 2}
          disabled={!wide}
          onChange={(v) => patch({ innerColumns: v ? 2 : 1 })}
        />
        <SwitchField
          label="Линии между задачами"
          checked={settings.dividers}
          onChange={(dividers) => patch({ dividers })}
        />
        <SwitchField
          label="Скрыть типовые фразы"
          checked={settings.hidePrefixes}
          onChange={(hidePrefixes) => patch({ hidePrefixes })}
        />
        <SwitchField label="Код задачи" checked={settings.showCode} onChange={(showCode) => patch({ showCode })} />
      </Space>

      <Space wrap size={[16, 10]} style={{ width: '100%', marginTop: 10 }}>
        <SwitchField
          label="Чертежи"
          checked={settings.showFigures}
          onChange={(showFigures) => patch({ showFigures })}
        />
        {settings.showFigures && (
          <Field label="Размер">
            <Segmented
              size="small"
              value={settings.figureSize}
              onChange={(figureSize) => patch({ figureSize })}
              options={KIM_IMAGE_SIZE_OPTIONS}
            />
          </Field>
        )}
      </Space>

      <Divider style={{ margin: '12px 0' }} />

      <Subtitle>Шапка карточки</Subtitle>
      <Space wrap size={[16, 10]} style={{ width: '100%', marginTop: 6 }}>
        <SwitchField label="Название" checked={settings.showTitle} onChange={(showTitle) => patch({ showTitle })} />
        {settings.showTitle && (
          <Input
            size="small"
            value={settings.title}
            onChange={(e) => patch({ title: e.target.value })}
            placeholder="Название работы"
            style={{ width: 220 }}
          />
        )}
        <SwitchField
          label="Номер варианта"
          hint="Надпись «Вариант N» в рамке. Сама включается, когда вариантов несколько."
          checked={showVariant}
          onChange={(v) => patch({ showVariant: v })}
        />
        {showVariant && (
          <Input
            size="small"
            value={variantLabel}
            onChange={(e) => setVariantLabel(e.target.value)}
            placeholder="Вариант"
            style={{ width: 110 }}
          />
        )}
        <SwitchField label="Поле ФИ" checked={settings.showStudentInfo} onChange={(showStudentInfo) => patch({ showStudentInfo })} />
        <SwitchField
          label="Поле «Класс»"
          checked={settings.showClassField}
          disabled={!settings.showStudentInfo}
          onChange={(showClassField) => patch({ showClassField })}
        />
      </Space>
      <div style={{ marginTop: 10 }}>
        <Field label="Строка задания">
          <Input
            size="small"
            value={settings.note}
            onChange={(e) => patch({ note: e.target.value })}
            placeholder="Например: Вычислите. Ответ запишите в таблицу."
            style={{ width: 360, maxWidth: '100%' }}
            allowClear
          />
        </Field>
      </div>

      <Divider style={{ margin: '12px 0' }} />

      <Subtitle>Ответы</Subtitle>
      <Space wrap size={[16, 10]} style={{ width: '100%', marginTop: 6 }}>
        <Field label="Поле ответа">
          <Tooltip title="«Таблица внизу» — клетки с номерами под задачами: проверять быстрее, приложив ключ.">
            <Segmented size="small" value={settings.answerStyle} onChange={(answerStyle) => patch({ answerStyle })} options={ANSWER_OPTIONS} />
          </Tooltip>
        </Field>
        <SwitchField
          label="Ответы на карточках"
          hint="Экземпляр учителя: ответы вписаны прямо в поля."
          checked={settings.answersOnCards}
          onChange={(answersOnCards) => patch({ answersOnCards })}
        />
        <SwitchField
          label="Лист ответов"
          hint="Последней страницей: ответы всех вариантов — по одному разу, а не на каждую копию."
          checked={settings.showKey}
          onChange={(showKey) => patch({ showKey })}
        />
        {settings.showKey && (
          <SwitchField
            label="С решениями"
            checked={settings.keySolutions}
            onChange={(keySolutions) => patch({ keySolutions })}
          />
        )}
      </Space>
    </>
  );
}

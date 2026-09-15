import { Segmented, Space, Switch, Tooltip, Typography } from 'antd';

const { Text } = Typography;

/** Строка панели: подпись (с подсказкой) + контрол. */
function Row({ label, hint, children }) {
  const text = <Text style={{ fontSize: 13 }}>{label}</Text>;
  return (
    <Space size={6}>
      {hint ? <Tooltip title={hint}>{text}</Tooltip> : text}
      {children}
    </Space>
  );
}

const ORIENTATION_OPTIONS = [
  { value: 'landscape', label: 'Альбомный' },
  { value: 'portrait', label: 'Книжный' },
];
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
  { value: 'grid', label: 'Клетка' },
  { value: 'lines', label: 'Линейка' },
  { value: 'blank', label: 'Пусто' },
];
const PAGES_OPTIONS = [
  { value: 1, label: '1 лист' },
  { value: 2, label: '2 листа' },
];

/**
 * Панель настроек печатного листа ТДФ. Состав зависит от того, что печатаем:
 * у эталонного конспекта нет полей для записи, у бланка — содержимого колонок.
 */
export default function TDFSheetSettings({ settings, patch, isBlank, geoMode }) {
  const s = settings;

  if (geoMode) {
    return (
      <Space wrap size={16}>
        <Row
          label="Полосок на лист:"
          hint="Лист A4 делится на равные полоски-варианты; каждая достаётся своему ученику."
        >
          <Segmented size="small" value={s.geoStrips} onChange={v => patch({ geoStrips: v })} options={[1, 2]} />
        </Row>
        <Row label="Шрифт:">
          <Segmented size="small" value={s.font} onChange={v => patch({ font: v })} options={FONT_OPTIONS} />
        </Row>
      </Space>
    );
  }

  return (
    <>
      <Space wrap size={16}>
        <Row label="Лист:">
          <Segmented size="small" value={s.orientation} onChange={v => patch({ orientation: v })} options={ORIENTATION_OPTIONS} />
        </Row>
        <Row label="Чертёж:" hint="Ширина колонки чертежа и потолок высоты картинки.">
          <Segmented size="small" value={s.drawingSize} onChange={v => patch({ drawingSize: v })} options={DRAWING_OPTIONS} disabled={!s.showDrawing} />
        </Row>
        <Row label="Шрифт:" hint="Начертание формулировок. Антиква ближе к формулам KaTeX.">
          <Segmented size="small" value={s.font} onChange={v => patch({ font: v })} options={FONT_OPTIONS} />
        </Row>
        {isBlank && (
          <Row label="Поле для записи:" hint="Чем разлиновано место, которое заполняет ученик.">
            <Segmented size="small" value={s.fill} onChange={v => patch({ fill: v })} options={FILL_OPTIONS} />
          </Row>
        )}
        {isBlank && (
          <Row label="Объём:" hint="На двух листах каждому пункту достаётся вдвое больше места.">
            <Segmented size="small" value={s.pages} onChange={v => patch({ pages: v })} options={PAGES_OPTIONS} />
          </Row>
        )}
      </Space>

      <Space wrap size={16}>
        <Row label="Колонки:" hint="Что печатать в строке пункта. В бланке колонка — это место для записи.">
          <Space size={10}>
            <Space size={4}>
              <Switch size="small" checked={s.showFormulation} onChange={v => patch({ showFormulation: v })} />
              <Text style={{ fontSize: 12.5 }}>формулировка</Text>
            </Space>
            <Space size={4}>
              <Switch size="small" checked={s.showDrawing} onChange={v => patch({ showDrawing: v })} />
              <Text style={{ fontSize: 12.5 }}>чертёж</Text>
            </Space>
            <Space size={4}>
              <Switch size="small" checked={s.showNotation} onChange={v => patch({ showNotation: v })} />
              <Text style={{ fontSize: 12.5 }}>краткая запись</Text>
            </Space>
          </Space>
        </Row>
        <Row label="Тип пункта:" hint="Подпись «теорема / определение / формула» под номером.">
          <Switch size="small" checked={s.showType} onChange={v => patch({ showType: v })} />
        </Row>
        {isBlank && (
          <Row label="ФИО и дата:">
            <Switch size="small" checked={s.showFio} onChange={v => patch({ showFio: v })} />
          </Row>
        )}
        {isBlank && (
          <Row label="Поле оценки:">
            <Switch size="small" checked={s.showScore} onChange={v => patch({ showScore: v })} />
          </Row>
        )}
        <Row label="Колонтитул:" hint="Название набора и номер листа внизу страницы.">
          <Switch size="small" checked={s.showFooter} onChange={v => patch({ showFooter: v })} />
        </Row>
      </Space>
    </>
  );
}

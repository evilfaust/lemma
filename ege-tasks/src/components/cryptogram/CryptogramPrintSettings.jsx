import { Segmented, Switch, Input, InputNumber, Space, Typography, Divider, Tooltip, Collapse } from 'antd';
import {
  MARGIN_OPTIONS, SOLUTION_SPACE_OPTIONS, SOLUTION_FILL_OPTIONS,
} from '../print-sheet/geometry';
import { KIM_IMAGE_SIZE_OPTIONS } from '../../utils/kimImageSize';
import { DEFAULT_INSTRUCTION } from './CryptogramSheet';

const { Text } = Typography;

const MODE_OPTIONS = [
  { value: 'single', label: 'A4' },
  { value: 'duo', label: '2 на листе' },
];
const HEADER_OPTIONS = [
  { value: 'full', label: 'Полная' },
  { value: 'compact', label: 'Компактная' },
];
const COLUMN_OPTIONS = [{ value: 1, label: '1' }, { value: 2, label: '2' }];
const FONT_SCALE_OPTIONS = [
  { value: 0.9, label: '10' },
  { value: 1, label: '11' },
  { value: 1.12, label: '12' },
  { value: 1.25, label: '14' },
];
const FONT_FAMILY_OPTIONS = [
  { value: 'sans', label: 'Гротеск' },
  { value: 'serif', label: 'Антиква' },
];
const ANSWER_STYLE_OPTIONS = [
  { value: 'none', label: 'Нет' },
  { value: 'line', label: 'Строка' },
  { value: 'box', label: 'Справа' },
];

const Row = ({ label, hint, children }) => {
  const text = <Text style={{ fontSize: 12, color: 'var(--ink-3)' }}>{label}</Text>;
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      {hint ? <Tooltip title={hint}>{text}</Tooltip> : text}
      {children}
    </div>
  );
};

const Toggle = ({ label, hint, ...props }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
    <Switch size="small" {...props} />
    {hint
      ? <Tooltip title={hint}><Text style={{ fontSize: 12 }}>{label}</Text></Tooltip>
      : <Text style={{ fontSize: 12 }}>{label}</Text>}
  </div>
);

const TextField = ({ label, value, onChange, placeholder, rows }) => (
  <div>
    <div style={{ fontSize: 11, color: 'var(--ink-4)', marginBottom: 2 }}>{label}</div>
    {rows
      ? <Input.TextArea size="small" rows={rows} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
      : <Input size="small" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />}
  </div>
);

/**
 * Настройки печатного листа шифровки. Язык тот же, что в «Оформлении»
 * Генератора, — это один и тот же движок `print-sheet`.
 *
 * `onMode` меняет не только формат страницы: компактный режим тянет за собой
 * пресет (см. CRYPTOGRAM_MODE_PRESETS), иначе полная шапка на половине A4 не
 * оставила бы места задачам.
 */
export default function CryptogramPrintSettings({ settings, patch, onMode }) {
  const s = settings;
  const full = s.headerMode === 'full';

  return (
    <Space direction="vertical" size={8} style={{ width: '100%' }}>
      <Row label="Режим" hint="«2 на листе» — две одинаковые шифровки на одном A4: лист режется поперёк по пунктиру, половинки раздаются двум ученикам.">
        <Segmented size="small" value={s.mode} onChange={onMode} options={MODE_OPTIONS} />
      </Row>
      <Row label="Шапка" hint={s.mode === 'duo' ? 'На половине листа полная шапка съедает треть высоты.' : 'Полная — надзаголовок, метаданные, поля ученика и инструкция.'}>
        <Segmented size="small" value={s.headerMode} onChange={v => patch({ headerMode: v })} options={HEADER_OPTIONS} />
      </Row>
      <Row label="Колонки">
        <Segmented size="small" value={s.columns} onChange={v => patch({ columns: v })} options={COLUMN_OPTIONS} />
      </Row>
      <Row label="Поля">
        <Segmented size="small" value={s.margins} onChange={v => patch({ margins: v })} options={MARGIN_OPTIONS} />
      </Row>
      <Row label="Кегль, pt">
        <Segmented size="small" value={s.fontScale} onChange={v => patch({ fontScale: v })} options={FONT_SCALE_OPTIONS} />
      </Row>
      <Row label="Шрифт">
        <Segmented size="small" value={s.fontFamily} onChange={v => patch({ fontFamily: v })} options={FONT_FAMILY_OPTIONS} />
      </Row>

      <Divider style={{ margin: '2px 0' }} />

      <Row label="Поле ответа">
        <Segmented size="small" value={s.answerStyle} onChange={v => patch({ answerStyle: v })} options={ANSWER_STYLE_OPTIONS} />
      </Row>
      <Row label="Место для решения">
        <Segmented size="small" value={s.solutionSpace} onChange={v => patch({ solutionSpace: v })} options={SOLUTION_SPACE_OPTIONS} />
      </Row>
      {s.solutionSpace !== 'none' && (
        <Row label="Разлиновка">
          <Segmented size="small" value={s.solutionFill} onChange={v => patch({ solutionFill: v })} options={SOLUTION_FILL_OPTIONS} />
        </Row>
      )}
      {s.showFigures && (
        <Row label="Размер чертежей">
          <Segmented size="small" value={s.figureSize} onChange={v => patch({ figureSize: v })} options={KIM_IMAGE_SIZE_OPTIONS} />
        </Row>
      )}

      <Divider style={{ margin: '2px 0' }} />

      <Space wrap size={[12, 6]}>
        <Toggle label="Поля ФИО" checked={s.showStudentFields} onChange={v => patch({ showStudentFields: v })} />
        <Toggle label="Класс" checked={s.showClassField} onChange={v => patch({ showClassField: v })} disabled={!s.showStudentFields} />
        <Toggle label="Число заданий" checked={s.showTasksCount} onChange={v => patch({ showTasksCount: v })} />
        <Toggle label="Подвал" checked={s.showFooter} onChange={v => patch({ showFooter: v })} />
        <Toggle label="Чертежи" checked={s.showFigures} onChange={v => patch({ showFigures: v })} />
        <Toggle label="Ключ учителя" hint="Отдельная страница с ответами, буквами и загаданной фразой." checked={s.showKey} onChange={v => patch({ showKey: v })} />
        <Toggle label="Описание слова" hint="Блок «Узнай: …» под строкой ответа." checked={s.showDefinition} onChange={v => patch({ showDefinition: v })} />
      </Space>

      <Collapse
        size="small"
        ghost
        items={[{
          key: 'head',
          label: <span style={{ fontSize: 12 }}>Тексты шапки</span>,
          children: (
            <Space direction="vertical" size={6} style={{ width: '100%' }}>
              {full && (
                <TextField label="Надзаголовок" value={s.eyebrow} onChange={v => patch({ eyebrow: v })} placeholder="Шифровка по ответам" />
              )}
              <TextField label="Подзаголовок" value={s.subtitle} onChange={v => patch({ subtitle: v })} placeholder="Тема урока" />
              <div style={{ display: 'flex', gap: 6 }}>
                <div style={{ flex: 1 }}>
                  <TextField label="Класс" value={s.classLabel} onChange={v => patch({ classLabel: v })} placeholder="8 класс" />
                </div>
                <div style={{ flex: 1 }}>
                  <TextField label="Дата" value={s.dateLabel} onChange={v => patch({ dateLabel: v })} placeholder="12 сентября" />
                </div>
                <div style={{ width: 72 }}>
                  <div style={{ fontSize: 11, color: 'var(--ink-4)', marginBottom: 2 }}>Мин</div>
                  <InputNumber
                    size="small"
                    min={0}
                    max={300}
                    value={s.duration}
                    onChange={v => patch({ duration: v || null })}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>
              <TextField label="Заголовок блока шифровки" value={s.cryptTitle} onChange={v => patch({ cryptTitle: v })} placeholder="Шифровка по ответам" />
              {full && (
                <>
                  <TextField label="Инструкция" value={s.instruction} onChange={v => patch({ instruction: v })} placeholder={DEFAULT_INSTRUCTION} rows={3} />
                  <TextField label="Заголовок доп. блока" value={s.notesTitle} onChange={v => patch({ notesTitle: v })} placeholder="Дополнительная информация" />
                  <TextField label="Дополнительная информация" value={s.notes} onChange={v => patch({ notes: v })} placeholder="Работа не влияет на оценку." rows={2} />
                </>
              )}
              {s.showFooter && (
                <TextField label="Подпись в подвале" value={s.footerNote} onChange={v => patch({ footerNote: v })} placeholder="Lemma" />
              )}
            </Space>
          ),
        }]}
      />
    </Space>
  );
}

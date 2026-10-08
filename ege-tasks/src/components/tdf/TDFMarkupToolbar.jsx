import { Button, Popover, Tooltip, Typography } from 'antd';
import {
  BorderOutlined, OrderedListOutlined, SwapOutlined, FunctionOutlined,
  LineChartOutlined, QuestionCircleOutlined,
} from '@ant-design/icons';
import FieldInsertToolbar from '../shared/FieldInsertToolbar';
import TdfText from './TdfText';
import { TDF_SNIPPETS } from '../../utils/tdfMarkup';

const { Text } = Typography;
const btn = { fontWeight: 400 };

/** Курсор внутри формулы `$…$` / `$$…$$`? Считаем неэкранированные доллары. */
function insideMath(text, pos) {
  let open = false;
  for (let i = 0; i < pos && i < text.length; i++) {
    if (text[i] === '\\') { i += 1; continue; }
    if (text[i] === '$') {
      if (text[i + 1] === '$') i += 1;
      open = !open;
    }
  }
  return open;
}

const HELP = [
  {
    title: 'Пропуск',
    text: 'Выделите слово или часть формулы и нажмите «Пропуск». В эталоне — как написано, в листе с пропусками — линия той же длины. Внутри формулы работает так же.',
    md: 'Корнем называется [[неотрицательное]] число, $n$-я степень которого равна $a$: $\\sqrt[n]{a} = b \\Leftrightarrow \\begin{cases} b \\ge [[0]] \\\\ [[b^n = a]] \\end{cases}$',
  },
  {
    title: 'Свойства + условия',
    text: 'Каждая строка — формула (без $), номера ставятся сами. Ниже черты «---» — условия, общая фигурная скобка справа на всю высоту списка.',
    md: TDF_SNIPPETS.properties.trim(),
  },
  {
    title: 'Соответствие',
    text: 'Строка «левое -> правое». Правый столбец перемешивается (одинаково в эталоне и бланке), под ним — таблица ответа: в эталоне с цифрами, в бланке пустая. Строка «# ЗАГОЛОВОК -> ЗАГОЛОВОК» — шапка столбцов.',
    md: TDF_SNIPPETS.matching.trim(),
  },
  {
    title: 'Пустые оси',
    text: 'Слово «пропуск» после ```plot: в эталоне — график, в листе с пропусками — только оси и сетка, график строит ученик.',
    md: TDF_SNIPPETS.axes.trim(),
  },
];

function MarkupHelp({ onInsert }) {
  const content = (
    <div style={{ width: 560, maxHeight: '70vh', overflowY: 'auto' }}>
      {HELP.map(h => (
        <div key={h.title} style={{ marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid #f0f0f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text strong>{h.title}</Text>
            <Button size="small" type="link" onClick={() => onInsert(`\n${h.md}\n`)}>Вставить пример</Button>
          </div>
          <div style={{ fontSize: 12, color: '#646A76', margin: '4px 0 8px' }}>{h.text}</div>
          <pre style={{ fontSize: 11, background: '#fafafa', padding: 6, margin: 0, whiteSpace: 'pre-wrap' }}>{h.md}</pre>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8, fontSize: 13 }}>
            <div><Text type="secondary" style={{ fontSize: 11 }}>Эталон</Text><TdfText md={h.md} seed="help" /></div>
            <div><Text type="secondary" style={{ fontSize: 11 }}>С пропусками</Text><TdfText md={h.md} mode="gaps" seed="help" /></div>
          </div>
        </div>
      ))}
    </div>
  );
  return (
    <Popover content={content} title="Разметка ТДФ" trigger="click" placement="bottomLeft">
      <Button size="small" icon={<QuestionCircleOutlined />} style={btn}>Разметка ТДФ</Button>
    </Popover>
  );
}

/**
 * Тулбар поля пункта ТДФ: разметка листа (пропуск, свойства + условия,
 * соответствие, кусочная запись, пустые оси) + общие вставки (график,
 * таблица, числовая прямая, планиметрия) из `useFieldInserts`.
 */
export default function TDFMarkupToolbar({ inserts, form, field }) {
  const wrapGap = () => {
    const cur = form.getFieldValue(field) || '';
    const sel = inserts.fieldCaret(field) || { start: cur.length, end: cur.length };
    const selected = cur.slice(sel.start, sel.end);
    // В формуле пропуск — тот же [[…]]: tdfMarkup понимает его и внутри $…$.
    const inner = selected || (insideMath(cur, sel.start) ? 'x' : 'ответ');
    inserts.insertSnippet(field, `[[${inner}]]`);
  };

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
      <Tooltip title="Выделите слово или часть формулы — в листе с пропусками на её месте будет линия">
        <Button size="small" icon={<BorderOutlined />} onClick={wrapGap} style={btn}>Пропуск [[ ]]</Button>
      </Tooltip>
      <Tooltip title="Нумерованный список формул и общая фигурная скобка условий справа">
        <Button size="small" icon={<OrderedListOutlined />} onClick={() => inserts.insertSnippet(field, TDF_SNIPPETS.properties)} style={btn}>
          Свойства + условия
        </Button>
      </Tooltip>
      <Tooltip title="Формула → график (термин → определение): правый столбец перемешан, под ним таблица ответа">
        <Button size="small" icon={<SwapOutlined />} onClick={() => inserts.insertSnippet(field, TDF_SNIPPETS.matching)} style={btn}>
          Соответствие
        </Button>
      </Tooltip>
      <Tooltip title="Запись «если … / если …» фигурной скобкой с пропусками">
        <Button size="small" icon={<FunctionOutlined />} onClick={() => inserts.insertSnippet(field, TDF_SNIPPETS.piecewise)} style={btn}>
          Кусочная запись
        </Button>
      </Tooltip>
      <Tooltip title="График, который в листе с пропусками печатается пустыми осями — строит ученик">
        <Button size="small" icon={<LineChartOutlined />} onClick={() => inserts.insertSnippet(field, TDF_SNIPPETS.axes)} style={btn}>
          Пустые оси
        </Button>
      </Tooltip>
      <MarkupHelp onInsert={(md) => inserts.insertSnippet(field, md)} />
      <FieldInsertToolbar tools={inserts} field={field} items={['table', 'plot', 'chart', 'numline', 'planim', 'help']} />
    </div>
  );
}

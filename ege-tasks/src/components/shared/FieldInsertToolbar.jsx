import { Button, Dropdown, Tooltip } from 'antd';
import {
  BorderOuterOutlined, ClearOutlined, CodeSandboxOutlined, DashOutlined,
  LineChartOutlined, RiseOutlined, TableOutlined,
} from '@ant-design/icons';
import TableModifiersHelp from './TableModifiersHelp';

const ALL = ['roots', 'table', 'numline', 'plot', 'vectors', 'grid', 'stereo'];
const btn = { fontWeight: 400 };

/**
 * Кнопки вставки над markdown-полем. Действия — из хука useFieldInserts.
 * @param tools — результат useFieldInserts
 * @param field — имя поля формы ('statement_md' | 'solution_md' | …)
 * @param items — какие кнопки показать (по умолчанию все)
 * @param rootsFields / rootsLabel — какие поля чинит «🧹 Корни»
 */
export default function FieldInsertToolbar({
  tools, field, items = ALL, rootsFields = null, rootsLabel = null,
}) {
  const has = (k) => items.includes(k);
  return (
    <>
      {has('roots') && (
        <Tooltip title="Чинит битые корни: \sqrt: начало аргумента: 3 конец аргумента → \sqrt{3}. Мгновенно, без сети.">
          <Button
            size="small"
            icon={<ClearOutlined />}
            onClick={() => tools.fixRootsIn(rootsFields || [field], rootsLabel || 'поле')}
            style={btn}
          >
            🧹 Корни
          </Button>
        </Tooltip>
      )}
      {has('table') && (
        <>
          <Dropdown menu={tools.tableMenu(field)} trigger={['click']}>
            <Button size="small" icon={<TableOutlined />} style={btn}>Таблица ▾</Button>
          </Dropdown>
          <TableModifiersHelp onInsert={(md) => tools.insertSnippet(field, md)} />
        </>
      )}
      {has('numline') && (
        <Tooltip title="Вставить числовую прямую со штриховкой (конструктор)">
          <Button size="small" icon={<DashOutlined />} onClick={() => tools.openNumline(field)} style={btn}>
            Числовая прямая
          </Button>
        </Tooltip>
      )}
      {has('plot') && (
        <Tooltip title="Конструктор графика функции. Курсор внутри готового чертежа — откроется его правка">
          <Button size="small" icon={<LineChartOutlined />} onClick={() => tools.openPlot(field, 'function')} style={btn}>
            График
          </Button>
        </Tooltip>
      )}
      {has('vectors') && (
        <Tooltip title="Конструктор векторов. Курсор внутри готового чертежа — откроется его правка">
          <Button size="small" icon={<RiseOutlined />} onClick={() => tools.openPlot(field, 'vectors')} style={btn}>
            Векторы
          </Button>
        </Tooltip>
      )}
      {has('grid') && (
        <Tooltip title="Место для записи решения: поле в клетку, в линейку или чистое">
          <Button size="small" icon={<BorderOuterOutlined />} onClick={() => tools.openGrid(field)} style={btn}>
            Клетка
          </Button>
        </Tooltip>
      )}
      {has('stereo') && (
        <Tooltip title="Стереочертёж: куб, призма, пирамида, сечения, пунктир невидимых линий. Курсор внутри готового чертежа — откроется его правка">
          <Button size="small" icon={<CodeSandboxOutlined />} onClick={() => tools.openStereo(field)} style={btn}>
            Стерео
          </Button>
        </Tooltip>
      )}
    </>
  );
}

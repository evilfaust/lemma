import { Button, Dropdown, Tooltip } from 'antd';
import {
  BarChartOutlined, BorderOuterOutlined, ClearOutlined, CodeSandboxOutlined, DashOutlined,
  LineChartOutlined, PictureOutlined, RadiusSettingOutlined, RiseOutlined, TableOutlined,
} from '@ant-design/icons';
import TableModifiersHelp from './TableModifiersHelp';
import FieldHelp from './FieldHelp';

const ALL = ['roots', 'table', 'image', 'numline', 'plot', 'chart', 'vectors', 'grid', 'planim', 'stereo', 'help'];
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
      {has('image') && tools.openImage && (
        <Tooltip title="Картинка из Библиотеки или с компьютера (файл сохранится в Библиотеке). Скриншот можно просто вставить в поле Ctrl+V или перетащить файл. Курсор в строке таблицы — картинка встанет в ячейку. Несколько картинок сразу — друг под другом или в ряд">
          <Button size="small" icon={<PictureOutlined />} onClick={() => tools.openImage(field)} style={btn}>
            Картинка
          </Button>
        </Tooltip>
      )}
      {has('numline') && (
        <Tooltip title="Конструктор числовой прямой. Курсор внутри готовой прямой — откроется её правка">
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
      {has('chart') && tools.openChart && (
        <Tooltip title="График или диаграмма по таблице значений: осадки по дням, температура по часам, столбики по месяцам. У каждой оси свой масштаб и подпись. Курсор внутри готового графика — откроется его правка">
          <Button size="small" icon={<BarChartOutlined />} onClick={() => tools.openChart(field)} style={btn}>
            Диаграмма
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
      {has('planim') && tools.openPlanim && (
        <Tooltip title="Планиметрический чертёж: треугольники, четырёхугольники, окружности, высоты, углы, равные отрезки. Курсор внутри готового чертежа — откроется его правка">
          <Button size="small" icon={<RadiusSettingOutlined />} onClick={() => tools.openPlanim(field)} style={btn}>
            Планиметрия
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
      {has('help') && <FieldHelp onInsert={(md) => tools.insertSnippet(field, md)} />}
    </>
  );
}

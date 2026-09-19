import {
  Button, Slider, Space, Switch, Divider, Segmented, Checkbox,
} from 'antd';
import {
  PrinterOutlined, ThunderboltOutlined, LineChartOutlined,
} from '@ant-design/icons';
import { useGraphTasks } from '../../hooks/useGraphTasks';
import {
  CATEGORY_LABELS_GRAPH, CATEGORY_GROUPS_GRAPH,
} from '../../utils/derivativeGraphTasks';
import { SheetOrderPanel } from '../trig/SheetOrderPanel';
import { CategoryChecklist } from '../trig/CategoryChecklist';
import { plannedTotal } from '../../utils/questionPlan';
import { useSheetLayout } from '../../hooks/useSheetLayout';
import { useSheetStorage } from '../../hooks/useSheetStorage';
import { SheetStorageActions } from '../trig/SheetStorageActions';
import {
  TrigGeneratorLayout, TrigSettingsSection, TrigActions, TrigPreviewPane,
  TrigStatBadge, TrigBlockToggle,
} from '../trig/TrigGeneratorLayout';
import { SheetLayoutOptions } from '../trig/sheetOptions';
import GraphSheetPrintLayout from './GraphSheetPrintLayout';

// Генератор заданий «производная и график»: варианты бесконечные, потому что
// график рисуется по случайным целым точкам, а ответ считается по той же
// модели, что и картинка (см. utils/derivativeGraphTasks.js).
//
// Раздел «Функции» покрывает оба экзамена: профиль №9 (графики f, f′ и
// первообразной) и базу №3/№7 (чтение графика) — это просто разные блоки
// категорий на одном листе.

const INSTRUCTION = 'Рассмотрите рисунок и ответьте на вопрос:';
const FIGURE_SIZES = [
  { value: 's', label: 'S' },
  { value: 'm', label: 'M' },
  { value: 'l', label: 'L' },
];

export default function GraphTasksGenerator() {
  const {
    title, setTitle,
    settings, updateSetting, updateCategory,
    tasksData, applySheet,
    generate, reset,
  } = useGraphTasks();

  const order = useSheetLayout(tasksData);
  // Правки задания «по месту» у этого листа нет намеренно: задание — чертёж,
  // а общая модалка правки умеет только формулу. Не понравилось задание —
  // «Сформировать» ещё раз, варианты бесконечные.
  const storage = useSheetStorage({
    generator: 'graph_derivative',
    title,
    settings,
    tasksData,
    layout: order.layout,
    onLoad: (sheet) => { applySheet(sheet); order.apply?.(sheet.tasksData, sheet.layout); },
  });

  const updateCount = (cat, value) => updateSetting('categoryCounts', {
    ...(settings.categoryCounts || {}),
    [cat]: value || undefined,
  });

  const toggleBlock = (keys, checked) => keys.forEach((k) => updateCategory(k, checked));

  const plannedCount = plannedTotal(
    settings.categories, settings.questionsCount, settings.categoryCounts,
  );
  const enabledCount = Object.values(settings.categories).filter(Boolean).length;
  const varCount = tasksData?.length ?? 0;
  const qCount = tasksData?.[0]?.length ?? plannedCount;

  // Формат страницы задаёт сам лист (@page), как в остальных генераторах.
  const handlePrint = () => {
    const style = document.createElement('style');
    style.id = 'graph-print-page-style';
    style.textContent = '@page { size: A4 portrait; margin: 0; }';
    document.head.appendChild(style);
    window.print();
    setTimeout(() => {
      const s = document.getElementById('graph-print-page-style');
      if (s) s.remove();
    }, 1500);
  };

  const sheetProps = {
    tasksData,
    settings,
    title,
    layout: order.layout,
    instruction: INSTRUCTION,
  };

  return (
    <>
      <TrigGeneratorLayout
        icon={<LineChartOutlined style={{ fontSize: 14 }} />}
        title={title}
        onTitleChange={setTitle}
        titlePlaceholder="Название листа"
        leftWidth={350}
        left={
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 10 }}>
            {CATEGORY_GROUPS_GRAPH.map((group) => (
              <TrigSettingsSection
                key={group.label}
                label={
                  <TrigBlockToggle
                    label={`${group.label} · ${group.hint}`}
                    keys={group.keys}
                    categories={settings.categories}
                    onToggleBlock={toggleBlock}
                  />
                }
              >
                <CategoryChecklist
                  keys={group.keys}
                  labels={CATEGORY_LABELS_GRAPH}
                  categories={settings.categories}
                  counts={settings.categoryCounts || {}}
                  onToggle={updateCategory}
                  onCount={updateCount}
                />
              </TrigSettingsSection>
            ))}

            <TrigSettingsSection label="Параметры">
              <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 6 }}>
                Заданий в варианте: <b style={{ color: 'var(--ink)', fontFamily: 'var(--font-mono)' }}>{plannedCount}</b>
                {plannedCount !== settings.questionsCount && (
                  <span style={{ color: 'var(--ink-4)' }}> — по количеству типов</span>
                )}
              </div>
              <Slider
                min={2} max={16} step={1}
                value={settings.questionsCount}
                onChange={(v) => updateSetting('questionsCount', v)}
                marks={{ 2: '2', 6: '6', 10: '10', 16: '16' }}
                size="small"
              />
              <Divider style={{ margin: '10px 0' }} />
              <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 6 }}>
                Вариантов: <b style={{ color: 'var(--ink)', fontFamily: 'var(--font-mono)' }}>{settings.variantsCount}</b>
              </div>
              <Slider
                min={1} max={16}
                value={settings.variantsCount}
                onChange={(v) => updateSetting('variantsCount', v)}
                marks={{ 1: '1', 4: '4', 8: '8', 16: '16' }}
                size="small"
              />
            </TrigSettingsSection>

            <TrigSettingsSection label="Печать и вид">
              <Space direction="vertical" size={6}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Switch
                    size="small"
                    checked={settings.columnsCount === 2}
                    onChange={(v) => updateSetting('columnsCount', v ? 2 : 1)}
                  />
                  <span style={{ fontSize: 13 }}>2 колонки на листе</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13 }}>Чертёж:</span>
                  <Segmented
                    size="small"
                    options={FIGURE_SIZES}
                    value={settings.figureSize || 'm'}
                    onChange={(v) => updateSetting('figureSize', v)}
                  />
                </div>
                <Checkbox
                  checked={!!settings.showTeacherKey}
                  onChange={(e) => updateSetting('showTeacherKey', e.target.checked)}
                >
                  Лист ответов (учитель)
                </Checkbox>
              </Space>
              <Divider style={{ margin: '10px 0' }} />
              <SheetLayoutOptions settings={settings} onChange={updateSetting} />
            </TrigSettingsSection>

            {tasksData && (
              <SheetOrderPanel
                layout={order.layout}
                categoryLabels={CATEGORY_LABELS_GRAPH}
                sample={tasksData[0] || []}
                onMove={order.move}
                onAddDivider={order.addDivider}
                onRemoveAt={order.removeAt}
                onReset={order.reset}
              />
            )}

            <TrigActions>
              <Button
                type="primary" block
                icon={<ThunderboltOutlined />}
                onClick={() => generate()}
                disabled={enabledCount === 0}
              >
                Сформировать
              </Button>
              {tasksData && (
                <>
                  <Button block icon={<PrinterOutlined />} onClick={handlePrint}>Печать</Button>
                  <SheetStorageActions
                    storage={storage}
                    hasData={Boolean(tasksData)}
                    generator="graph_derivative"
                    instruction={INSTRUCTION}
                  />
                  <Button block onClick={reset}>Сбросить</Button>
                </>
              )}
            </TrigActions>
          </div>
        }
        right={
          <TrigPreviewPane
            hasData={Boolean(tasksData)}
            emptyIcon={<LineChartOutlined />}
            emptyTitle="Выберите типы заданий и нажмите «Сформировать»"
            emptyHint={`Активных типов: ${enabledCount}`}
            summary={[
              <TrigStatBadge key="cats" tone="accent">{enabledCount} тип.</TrigStatBadge>,
              <TrigStatBadge key="q">{qCount} зад.</TrigStatBadge>,
              <TrigStatBadge key="v" tone="success">{varCount || settings.variantsCount} вар.</TrigStatBadge>,
            ]}
          >
            {tasksData && <GraphSheetPrintLayout {...sheetProps} screenMode />}
          </TrigPreviewPane>
        }
      />

      {/* Печатная вёрстка */}
      {tasksData && <GraphSheetPrintLayout {...sheetProps} />}
    </>
  );
}

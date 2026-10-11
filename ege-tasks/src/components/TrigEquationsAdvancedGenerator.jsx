import { Button, Slider, Checkbox, Space, Switch, Divider, Segmented } from 'antd';
import { PrinterOutlined, FunctionOutlined, CheckSquareOutlined, ThunderboltOutlined } from '@ant-design/icons';
import {
  useTrigEquationsAdvanced,
  trigAdvInstruction,
  CATEGORY_LABELS_TRIG_ADV,
  CATEGORY_GROUPS_TRIG_ADV,
} from '../hooks/useTrigEquationsAdvanced';
import { useTrigMCModal } from '../hooks/useTrigMCModal';
import OralCountingPrintLayout from './trig/OralCountingPrintLayout';
import { SheetOrderPanel } from './trig/SheetOrderPanel';
import { CategoryChecklist } from './trig/CategoryChecklist';
import { plannedTotal } from '../utils/questionPlan';
import { useSheetLayout } from '../hooks/useSheetLayout';
import { useSheetTools } from '../hooks/useSheetTools';
import { SheetStorageActions } from './trig/SheetStorageActions';
import { SheetToolsModals } from './trig/SheetTools';
import { TrigMCSection } from './trig/TrigMCSection';
import {
  TrigGeneratorLayout,
  TrigSettingsSection,
  TrigActions,
  TrigPreviewPane,
  TrigStatBadge,
  TrigBlockToggle,
} from './trig/TrigGeneratorLayout';
import { SheetLayoutOptions } from './trig/sheetOptions';

/**
 * Уравнения f(kx + b) = a. Задания и ответы строит ядро
 * `utils/trig/equations.js` (серии корней точно, с проверкой подстановкой);
 * экран — по образцу генераторов «Уравнений»: блоки категорий, план листа,
 * общая печатная раскладка с ключом учителя.
 */
export default function TrigEquationsAdvancedGenerator() {
  const {
    title, setTitle, settings, updateSetting, updateCategory, tasksData, generate, reset,
    setTasksData, applySheet,
  } = useTrigEquationsAdvanced();

  const { modalOpen, setModalOpen, printTest, handlePrint: handleMCPrint } = useTrigMCModal();
  const order = useSheetLayout(tasksData);
  const sheet = useSheetTools({
    generator: 'trig_equations_advanced',
    hook: { title, settings, tasksData, setTasksData, applySheet },
    order,
  });

  const updateCount = (cat, value) => updateSetting('categoryCounts', {
    ...(settings.categoryCounts || {}),
    [cat]: value || undefined,
  });
  const plannedCount = plannedTotal(settings.categories, settings.questionsCount, settings.categoryCounts);

  const handlePrint = () => {
    const style = document.createElement('style');
    style.id = 'oral-print-page-style';
    style.textContent = '@page { size: A4 portrait; margin: 0; }';
    document.head.appendChild(style);
    window.print();
    setTimeout(() => document.getElementById('oral-print-page-style')?.remove(), 1500);
  };

  const toggleBlock = (keys, checked) => keys.forEach(k => updateCategory(k, checked));
  const enabledCount = Object.values(settings.categories || {}).filter(Boolean).length;
  const qCount = tasksData?.[0]?.length ?? plannedCount;
  const instruction = trigAdvInstruction(settings.categories);

  const printProps = {
    tasksData,
    settings,
    title,
    layout: order.layout,
    equationMode: true,
    promptMode: 'answer',
    instruction,
    fontSize: settings.fontSize || 's',
    wideAnswers: true,
  };

  return (
    <>
      <TrigGeneratorLayout
        icon={<FunctionOutlined style={{ fontSize: 14 }} />}
        title={title}
        onTitleChange={setTitle}
        titlePlaceholder="Название листа"
        leftWidth={350}
        left={
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 10 }}>
            {CATEGORY_GROUPS_TRIG_ADV.map(group => (
              <TrigSettingsSection
                key={group.label}
                label={
                  <TrigBlockToggle
                    label={group.label}
                    keys={group.keys}
                    categories={settings.categories}
                    onToggleBlock={toggleBlock}
                  />
                }
              >
                <CategoryChecklist
                  keys={group.keys}
                  labels={CATEGORY_LABELS_TRIG_ADV}
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
              </div>
              <Slider min={2} max={20} value={settings.questionsCount}
                onChange={v => updateSetting('questionsCount', v)}
                marks={{ 2: '2', 6: '6', 12: '12', 20: '20' }} size="small" />
              <Divider style={{ margin: '10px 0' }} />
              <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 6 }}>
                Вариантов: <b style={{ color: 'var(--ink)', fontFamily: 'var(--font-mono)' }}>{settings.variantsCount}</b>
              </div>
              <Slider min={1} max={32} value={settings.variantsCount}
                onChange={v => updateSetting('variantsCount', v)}
                marks={{ 1: '1', 8: '8', 16: '16', 32: '32' }} size="small" />
            </TrigSettingsSection>

            <TrigSettingsSection label="Печать и вид">
              <Space direction="vertical" size={6}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Switch size="small" checked={settings.columnsCount === 2}
                    onChange={v => updateSetting('columnsCount', v ? 2 : 1)} />
                  <span style={{ fontSize: 13 }}>2 колонки на листе</span>
                </div>
                <Checkbox checked={settings.showTeacherKey}
                  onChange={e => updateSetting('showTeacherKey', e.target.checked)}>
                  Лист ответов (учитель)
                </Checkbox>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13 }}>Шрифт:</span>
                  <Segmented size="small" options={['S', 'M', 'L']}
                    value={(settings.fontSize || 's').toUpperCase()}
                    onChange={v => updateSetting('fontSize', v.toLowerCase())} />
                </div>
              </Space>
              <Divider style={{ margin: '10px 0' }} />
              <SheetLayoutOptions settings={settings} onChange={updateSetting} showPerPage />
            </TrigSettingsSection>

            {tasksData && (
              <SheetOrderPanel
                layout={order.layout}
                categoryLabels={CATEGORY_LABELS_TRIG_ADV}
                sample={tasksData[0] || []}
                onMove={order.move}
                onAddDivider={order.addDivider}
                onRemoveAt={order.removeAt}
                onReset={order.reset}
                onEditTask={sheet.openTask}
                onAddTask={sheet.openAdd}
              />
            )}

            <TrigActions>
              <Button type="primary" block icon={<ThunderboltOutlined />}
                onClick={() => generate()} disabled={enabledCount === 0}>
                Сформировать
              </Button>
              {tasksData && (
                <>
                  <Button block icon={<PrinterOutlined />} onClick={handlePrint}>Печать</Button>
                  <SheetStorageActions
                    storage={sheet.storage}
                    hasData={Boolean(tasksData)}
                    generator="trig_equations_advanced"
                    instruction={instruction}
                  />
                  <Button block icon={<CheckSquareOutlined />} onClick={() => setModalOpen(true)}>
                    Тест A/B/C/D
                  </Button>
                  <Button block onClick={reset}>Сбросить</Button>
                </>
              )}
            </TrigActions>
          </div>
        }
        right={
          <TrigPreviewPane
            hasData={Boolean(tasksData)}
            emptyIcon={<FunctionOutlined />}
            emptyTitle="Настройте параметры и нажмите «Сформировать»"
            emptyHint={`Активных категорий: ${enabledCount}`}
            summary={[
              <TrigStatBadge key="cats" tone="accent">{enabledCount} кат.</TrigStatBadge>,
              <TrigStatBadge key="q">{qCount} зад.</TrigStatBadge>,
              <TrigStatBadge key="v" tone="success">{tasksData?.length || settings.variantsCount} вар.</TrigStatBadge>,
            ]}
          >
            {tasksData && <OralCountingPrintLayout {...printProps} screenMode />}
          </TrigPreviewPane>
        }
      />

      {tasksData && <OralCountingPrintLayout {...printProps} />}

      <SheetToolsModals sheet={sheet} />

      <TrigMCSection
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        printTest={printTest}
        onPrint={handleMCPrint}
        tasksData={tasksData}
        generatorType="trig_equations_advanced"
        generatorTitle={title}
        settings={settings}
      />
    </>
  );
}

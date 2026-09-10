import { useState } from 'react';
import {
  Button, Segmented, Checkbox, InputNumber, Input, Alert, Space, Divider, Tooltip,
} from 'antd';
import {
  PrinterOutlined, PlusOutlined, UnorderedListOutlined, ThunderboltOutlined,
  SwapOutlined, DatabaseOutlined, AppstoreOutlined,
} from '@ant-design/icons';
import { useClassifySheet } from '../../hooks/useClassifySheet';
import { useSheetStorage } from '../../hooks/useSheetStorage';
import { planSheet, isClassifyOnly } from '../../utils/classifySheet';
import {
  TrigGeneratorLayout, TrigSettingsSection, TrigActions,
  TrigStatBadge,
} from '../trig/TrigGeneratorLayout';
import { SheetStorageActions } from '../trig/SheetStorageActions';
import TaskSelectModal from '../TaskSelectModal';
import BucketsPanel from './BucketsPanel';
import EquationBankPanel from './EquationBankPanel';
import BulkAddModal from './BulkAddModal';
import QuadImportModal from './QuadImportModal';
import ClassifyPrintLayout from './ClassifyPrintLayout';

const { TextArea } = Input;

/**
 * «Сортировщик» — лист на классификацию уравнений.
 *
 * Здесь нечего «формировать»: уравнения пишет учитель, поэтому левая панель —
 * это типы и параметры печати, а правая переключается между банком уравнений
 * (основная работа) и предпросмотром готового листа.
 *
 * Лист сохраняется целиком в `generator_sheets` (kind `classify`): банк и
 * разметка — снимок, восстанавливать его перегенерацией не из чего.
 */
export default function ClassifySheetGenerator() {
  const sheet = useClassifySheet();
  const {
    title, setTitle, buckets, items, settings, stats, warnings,
    updateSetting, addBucket, addPresetBuckets, addBuckets, patchBucket,
    removeBucket, moveBucket, addItem, addItems, patchItem, removeItem,
    moveItem, shuffle, reset, tasksData, applySheet,
  } = sheet;

  const [view, setView] = useState('bank');
  const [bulkOpen, setBulkOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);

  const storage = useSheetStorage({
    generator: 'classify_equations',
    title,
    settings,
    tasksData,
    layout: [],
    onLoad: applySheet,
  });

  const handlePrint = () => {
    const style = document.createElement('style');
    style.id = 'classify-print-page-style';
    style.textContent = '@page { size: A4 portrait; margin: 0; }';
    document.head.appendChild(style);
    window.print();
    setTimeout(() => {
      const s = document.getElementById('classify-print-page-style');
      if (s) s.remove();
    }, 1500);
  };

  const handleCatalogSelect = (task) => {
    addItem({ md: task.statement_md || '', answerLatex: task.answer || '' });
    setCatalogOpen(false);
  };

  const classifyOnly = isClassifyOnly(settings);
  const { pageCount } = planSheet(stats, settings, items);
  const hasData = items.length > 0 || buckets.length > 0;

  return (
    <>
      <TrigGeneratorLayout
        icon={<AppstoreOutlined style={{ fontSize: 14 }} />}
        title={title}
        onTitleChange={setTitle}
        titlePlaceholder="Название листа"
        leftWidth={380}
        left={
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 10 }}>

            <TrigSettingsSection label="Типы уравнений">
              <BucketsPanel
                buckets={buckets}
                stats={stats}
                showPoints={settings.showPoints}
                onPatch={patchBucket}
                onRemove={removeBucket}
                onMove={moveBucket}
                onAdd={addBucket}
                onAddPreset={addPresetBuckets}
              />
            </TrigSettingsSection>

            <TrigSettingsSection label="Лист">
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Tooltip title="«Только классификация» — одна страница: банк и таблица «тип → номера», без места на решение">
                    <span style={{ fontSize: 12, flex: 1 }}>Режим листа</span>
                  </Tooltip>
                  <Segmented
                    size="small"
                    options={[
                      { value: 'full', label: 'С решением' },
                      { value: 'classify', label: 'Только типы' },
                    ]}
                    value={settings.mode}
                    onChange={v => updateSetting('mode', v)}
                  />
                </div>

                {!classifyOnly && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, flex: 1 }}>Место для решения</span>
                  <Segmented
                    size="small"
                    options={[
                      { value: 'grid', label: 'Клетка' },
                      { value: 'lines', label: 'Линейка' },
                      { value: 'blank', label: 'Пусто' },
                    ]}
                    value={settings.fill}
                    onChange={v => updateSetting('fill', v)}
                  />
                </div>
                )}

                {!classifyOnly && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Tooltip title="Сколько клеток по 5 мм отводится на одно уравнение — из них складывается высота поля в типе">
                    <span style={{ fontSize: 12, flex: 1 }}>Клеток на уравнение</span>
                  </Tooltip>
                  <InputNumber
                    size="small" min={1} max={20}
                    value={settings.solveCells}
                    onChange={v => updateSetting('solveCells', v ?? 4)}
                    style={{ width: 64 }}
                  />
                  <span style={{ fontSize: 11, color: 'var(--ink-4)', minWidth: 36 }}>
                    {Math.max(1, settings.solveCells || 1) * 5} мм
                  </span>
                </div>
                )}

                {!classifyOnly && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Tooltip title="Два в ряд экономят почти половину бумаги">
                    <span style={{ fontSize: 12, flex: 1 }}>Типов в ряд</span>
                  </Tooltip>
                  <Segmented
                    size="small"
                    options={[{ value: 1, label: '1' }, { value: 2, label: '2' }]}
                    value={settings.bucketColumns}
                    onChange={v => updateSetting('bucketColumns', v)}
                  />
                </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Tooltip title="Сколько уравнений вмещает поле типа. Поровну — лист не выдаёт, сколько уравнений в каком типе">
                    <span style={{ fontSize: 12, flex: 1 }}>Вмещает уравнений</span>
                  </Tooltip>
                  <Segmented
                    size="small"
                    options={[
                      { value: 'uniform', label: 'Поровну' },
                      { value: 'auto', label: 'По разметке' },
                    ]}
                    value={settings.slotMode}
                    onChange={v => updateSetting('slotMode', v)}
                  />
                </div>

                {settings.slotMode === 'uniform' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, flex: 1 }}>По скольку (0 — по максимуму)</span>
                    <InputNumber
                      size="small" min={0} max={10}
                      value={settings.slotsPerBucket}
                      onChange={v => updateSetting('slotsPerBucket', v ?? 0)}
                      style={{ width: 64 }}
                    />
                  </div>
                )}

                <Checkbox
                  checked={settings.showChecksum}
                  onChange={e => updateSetting('showChecksum', e.target.checked)}
                >
                  Контрольная сумма номеров
                </Checkbox>
                <Checkbox
                  checked={settings.showOther}
                  onChange={e => updateSetting('showOther', e.target.checked)}
                >
                  Тип «не подходит ни к одному»
                </Checkbox>
                <Checkbox
                  checked={settings.showHints}
                  onChange={e => updateSetting('showHints', e.target.checked)}
                >
                  Печатать признак типа
                </Checkbox>
                <Checkbox
                  checked={settings.showClassField}
                  onChange={e => updateSetting('showClassField', e.target.checked)}
                >
                  Поле «Класс» в шапке
                </Checkbox>
                <Checkbox
                  checked={settings.showPoints}
                  onChange={e => updateSetting('showPoints', e.target.checked)}
                >
                  Баллы за тип
                </Checkbox>
                <Checkbox
                  checked={settings.showKey}
                  onChange={e => updateSetting('showKey', e.target.checked)}
                >
                  Страница ключа для учителя
                </Checkbox>

                <Divider style={{ margin: '4px 0' }} />

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, flex: 1 }}>Банк в колонок</span>
                  <Segmented
                    size="small"
                    options={[{ value: 1, label: '1' }, { value: 2, label: '2' }]}
                    value={settings.bankColumns}
                    onChange={v => updateSetting('bankColumns', v)}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, flex: 1 }}>Размер шрифта</span>
                  <Segmented
                    size="small"
                    options={['S', 'M', 'L']}
                    value={(settings.fontSize || 's').toUpperCase()}
                    onChange={v => updateSetting('fontSize', v.toLowerCase())}
                  />
                </div>

                <TextArea
                  value={settings.instruction || ''}
                  onChange={e => updateSetting('instruction', e.target.value)}
                  autoSize={{ minRows: 2, maxRows: 5 }}
                  placeholder="Инструкция на листе (по умолчанию — стандартная)"
                  style={{ fontSize: 12 }}
                />
              </Space>
            </TrigSettingsSection>

            <TrigActions>
              <Button type="primary" block icon={<PrinterOutlined />} onClick={handlePrint}>
                Печать
              </Button>
              <SheetStorageActions
                storage={storage}
                hasData={hasData}
                generator="classify_equations"
                exportMd={false}
              />
              <Button block onClick={reset}>Сбросить</Button>
            </TrigActions>
          </div>
        }
        right={
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 12, marginBottom: 12, flexWrap: 'wrap',
            }}>
              <Segmented
                options={[
                  { value: 'bank', label: 'Уравнения' },
                  { value: 'sheet', label: 'Лист' },
                ]}
                value={view}
                onChange={setView}
              />
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <TrigStatBadge tone="accent">{buckets.length} тип.</TrigStatBadge>
                <TrigStatBadge>{items.length} ур.</TrigStatBadge>
                {stats.unassigned.length > 0 && (
                  <TrigStatBadge>{stats.unassigned.length} без типа</TrigStatBadge>
                )}
                <TrigStatBadge tone="success">{pageCount} стр.</TrigStatBadge>
              </div>
            </div>

            {view === 'bank' && (
              <>
                <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                  <Button size="small" icon={<PlusOutlined />} onClick={() => addItem()}>
                    Уравнение
                  </Button>
                  <Button
                    size="small" icon={<UnorderedListOutlined />}
                    onClick={() => setBulkOpen(true)}
                  >
                    Списком
                  </Button>
                  <Button
                    size="small" icon={<ThunderboltOutlined />}
                    onClick={() => setImportOpen(true)}
                  >
                    Из генератора
                  </Button>
                  <Button
                    size="small" icon={<DatabaseOutlined />}
                    onClick={() => setCatalogOpen(true)}
                  >
                    Из каталога
                  </Button>
                  <Button
                    size="small" icon={<SwapOutlined />}
                    onClick={shuffle}
                    disabled={items.length < 2}
                  >
                    Перемешать
                  </Button>
                </div>

                {warnings.length > 0 && (
                  <Alert
                    type="warning"
                    showIcon
                    style={{ marginBottom: 10 }}
                    message={warnings.map((w, i) => <div key={i}>{w}</div>)}
                  />
                )}

                <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
                  <EquationBankPanel
                    items={items}
                    buckets={buckets}
                    settings={settings}
                    onPatch={patchItem}
                    onRemove={removeItem}
                    onMove={moveItem}
                  />
                </div>
              </>
            )}

            {view === 'sheet' && (
              <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
                <ClassifyPrintLayout
                  title={title}
                  buckets={buckets}
                  items={items}
                  settings={settings}
                  screenMode
                />
              </div>
            )}
          </div>
        }
      />

      {/* Печатная вёрстка */}
      <ClassifyPrintLayout
        title={title}
        buckets={buckets}
        items={items}
        settings={settings}
      />

      <BulkAddModal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        onAdd={addItems}
      />

      <QuadImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        buckets={buckets}
        onAdd={addItems}
        onAddBuckets={addBuckets}
      />

      <TaskSelectModal
        visible={catalogOpen}
        onCancel={() => setCatalogOpen(false)}
        onSelect={handleCatalogSelect}
        excludeIds={[]}
      />
    </>
  );
}

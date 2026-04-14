import { useRef, useState } from 'react';
import katex from 'katex';
import {
  Card, Button, Input, Slider, Radio, Checkbox,
  Divider, Space, Modal, List, Typography, Tag, Popconfirm, Switch,
} from 'antd';
import {
  ReloadOutlined, PrinterOutlined, SaveOutlined, FolderOpenOutlined,
  DeleteOutlined, RadarChartOutlined, TableOutlined,
} from '@ant-design/icons';
import { useTrigValues } from '../hooks/useTrigValues';
import TrigValuesSVG from './trig/TrigValuesSVG';
import TrigValuesPrintLayout from './trig/TrigValuesPrintLayout';
import './TrigValuesGenerator.css';

const { Text } = Typography;

function MathInline({ latex }) {
  let html;
  try { html = katex.renderToString(latex, { throwOnError: false, displayMode: false }); }
  catch { html = latex; }
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}


const LAYOUT_OPTIONS = [
  { value: 'landscape', label: 'Альбомная A4' },
  { value: 'portrait',  label: 'Книжная A4' },
];

// Компактная таблица для превью на экране
function PreviewTable({ points, showSin, showCos, showTan, showCot }) {
  const cols = [
    showSin && { key: 'sin', head: '\\sin' },
    showCos && { key: 'cos', head: '\\cos' },
    showTan && { key: 'tan', head: '\\text{tg}' },
    showCot && { key: 'cot', head: '\\text{ctg}' },
  ].filter(Boolean);

  return (
    <div className="tvg-preview-table-wrap">
      <table className="tvg-preview-table">
        <thead>
          <tr>
            <th>№</th>
            <th><MathInline latex="\alpha" /></th>
            {cols.map(c => <th key={c.key}><MathInline latex={c.head} /></th>)}
          </tr>
        </thead>
        <tbody>
          {points.map(p => (
            <tr key={p.id}>
              <td>{p.id}</td>
              <td><MathInline latex={p.angleDisplayCompact || p.angleDisplay} /></td>
              {cols.map(c => {
                const undef = (c.key === 'tan' && p.tanUndef) || (c.key === 'cot' && p.cotUndef);
                return (
                  <td key={c.key} className="tvg-preview-blank">
                    {undef ? <span style={{ color: '#aaa', fontSize: 11 }}>—</span> : ''}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function TrigValuesGenerator() {
  const [showLoadModal, setShowLoadModal] = useState(false);

  const {
    title, setTitle,
    settings, updateSetting,
    tasksData,
    generate, reset,
    savedId, saved, loadingSaved, saving,
    loadSavedList, saveWorksheet, loadWorksheet, deleteWorksheet,
  } = useTrigValues();

  const handleOpenLoad = async () => {
    await loadSavedList();
    setShowLoadModal(true);
  };

  const handlePrint = () => {
    const size = settings.layout === 'portrait' ? 'A4 portrait' : 'A4 landscape';
    const style = document.createElement('style');
    style.id = 'tvg-print-page-style';
    style.textContent = `@page { size: ${size}; margin: 0; }`;
    document.head.appendChild(style);
    window.print();
    setTimeout(() => {
      const s = document.getElementById('tvg-print-page-style');
      if (s) s.remove();
    }, 1500);
  };

  return (
    <div className="tvg-root">
      {/* ── Заголовок ── */}
      <div className="tvg-header">
        <TableOutlined style={{ fontSize: 20, color: '#1677ff' }} />
        <Input
          className="tvg-title-input"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Название листа"
          size="middle"
        />
      </div>

      <div className="tvg-layout">
        {/* ── Панель настроек ─────────────────────────────────────── */}
        <Card className="tvg-settings-card" size="small" title="Настройки">

          <div className="tvg-settings-row">
            <div className="tvg-settings-label">
              Углов в таблице: {settings.anglesCount ?? 8}
            </div>
            <Slider
              min={4} max={16}
              value={settings.anglesCount ?? 8}
              onChange={v => updateSetting('anglesCount', v)}
              marks={{ 4: '4', 8: '8', 12: '12', 16: '16' }}
              size="small"
            />
          </div>

          <div className="tvg-settings-row">
            <div className="tvg-settings-label">
              Кол-во вариантов: {settings.variantsCount}
            </div>
            <Slider
              min={1} max={32}
              value={settings.variantsCount}
              onChange={v => updateSetting('variantsCount', v)}
              marks={{ 1: '1', 10: '10', 20: '20', 32: '32' }}
              size="small"
            />
          </div>

          <div className="tvg-settings-row">
            <div className="tvg-settings-label">
              Сдвиг углов ±k×2π: {settings.maxK === 0 ? 'нет' : `k до ${settings.maxK}`}
            </div>
            <Slider
              min={0} max={4}
              value={settings.maxK ?? 2}
              onChange={v => updateSetting('maxK', v)}
              marks={{ 0: 'нет', 1: '±1', 2: '±2', 3: '±3', 4: '±4' }}
              size="small"
            />
          </div>

          <div className="tvg-settings-row">
            <div className="tvg-settings-label">Ориентация</div>
            <Radio.Group
              value={settings.layout}
              onChange={e => updateSetting('layout', e.target.value)}
              size="small"
              optionType="button"
              buttonStyle="solid"
            >
              <Radio.Button value="landscape">Альбомная</Radio.Button>
              <Radio.Button value="portrait">Книжная</Radio.Button>
            </Radio.Group>
          </div>

          <Divider style={{ margin: '8px 0' }} />

          <div className="tvg-settings-label" style={{ marginBottom: 6 }}>Колонки в таблице</div>
          <Space wrap size={4}>
            <Checkbox
              checked={settings.showSin}
              onChange={e => updateSetting('showSin', e.target.checked)}
            >sin</Checkbox>
            <Checkbox
              checked={settings.showCos}
              onChange={e => updateSetting('showCos', e.target.checked)}
            >cos</Checkbox>
            <Checkbox
              checked={settings.showTan}
              onChange={e => updateSetting('showTan', e.target.checked)}
            >tg</Checkbox>
            <Checkbox
              checked={settings.showCot}
              onChange={e => updateSetting('showCot', e.target.checked)}
            >ctg</Checkbox>
          </Space>

          <Divider style={{ margin: '8px 0' }} />

          <Space direction="vertical" size={6}>
            <Checkbox
              checked={settings.showHelperLines}
              onChange={e => updateSetting('showHelperLines', e.target.checked)}
            >
              Вспомогательные линии
            </Checkbox>
            <Checkbox
              checked={settings.showAngleLabels}
              onChange={e => updateSetting('showAngleLabels', e.target.checked)}
            >
              Подписи углов на окружности
            </Checkbox>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Switch
                size="small"
                checked={settings.useDegrees ?? false}
                onChange={v => updateSetting('useDegrees', v)}
              />
              <span style={{ fontSize: 13 }}>Градусная мера</span>
            </div>
            <Checkbox
              checked={settings.showTeacherKey}
              onChange={e => updateSetting('showTeacherKey', e.target.checked)}
            >
              Лист ответов (учитель)
            </Checkbox>
          </Space>
        </Card>

        {/* ── Превью ─────────────────────────────────────────────── */}
        <div className="tvg-preview">

          {/* Кнопки */}
          <div className="tvg-actions">
            <Button type="primary" icon={<ReloadOutlined />} onClick={generate}>
              Сгенерировать
            </Button>
            {tasksData && (
              <>
                <Button icon={<PrinterOutlined />} onClick={handlePrint}>Печать</Button>
                <Button icon={<SaveOutlined />} loading={saving} onClick={saveWorksheet}>
                  {savedId ? 'Обновить' : 'Сохранить'}
                </Button>
              </>
            )}
            <Button icon={<FolderOpenOutlined />} onClick={handleOpenLoad}>Загрузить</Button>
            {tasksData && (
              <Popconfirm title="Сбросить?" onConfirm={reset} okText="Да" cancelText="Нет">
                <Button danger>Сброс</Button>
              </Popconfirm>
            )}
          </div>

          {/* Пустое состояние */}
          {!tasksData ? (
            <div className="tvg-empty">
              <RadarChartOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
              <div>Нажмите «Сгенерировать» чтобы создать лист</div>
            </div>
          ) : (
            <>
              {/* Превью всех вариантов */}
              {tasksData.map((variant, vi) => (
                <div key={vi} className="tvg-preview-card">
                  <div className="tvg-preview-card-title">
                    Вариант {vi + 1}
                  </div>
                  <div className="tvg-preview-body">
                    <div className="tvg-preview-circle">
                      <TrigValuesSVG
                        points={variant}
                        showHelperLines={settings.showHelperLines}
                        showAngleLabels={settings.showAngleLabels}
                      />
                    </div>
                    <PreviewTable
                      points={variant}
                      showSin={settings.showSin}
                      showCos={settings.showCos}
                      showTan={settings.showTan}
                      showCot={settings.showCot}
                    />
                  </div>
                </div>
              ))}

              {/* Сводка */}
              <div className="tvg-summary">
                <Tag color="blue">{tasksData[0].length} углов</Tag>
                <Tag color="geekblue">
                  {[settings.showSin && 'sin', settings.showCos && 'cos',
                    settings.showTan && 'tg', settings.showCot && 'ctg']
                    .filter(Boolean).join(', ')}
                </Tag>
                <Tag color="purple">{settings.variantsCount} вар.</Tag>
                <Tag color="cyan">
                  {settings.layout === 'landscape' ? 'Альбомная A4' : 'Книжная A4'}
                </Tag>
                {settings.showTeacherKey && <Tag color="orange">+ Ответы</Tag>}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Печатная вёрстка (скрыта на экране) */}
      {tasksData && (
        <TrigValuesPrintLayout
          tasksData={tasksData}
          settings={settings}
          title={title}
        />
      )}

      {/* ── Модал загрузки ─────────────────────────────────────────────── */}
      <Modal
        title="Загрузить сохранённый лист"
        open={showLoadModal}
        onCancel={() => setShowLoadModal(false)}
        footer={null}
        width={520}
      >
        {!loadingSaved && saved.length === 0 ? (
          <Text type="secondary">Нет сохранённых листов</Text>
        ) : (
          <List
            loading={loadingSaved}
            dataSource={saved}
            renderItem={item => (
              <div className="tvg-saved-item">
                <div>
                  <div className="tvg-saved-title">{item.title}</div>
                  <div className="tvg-saved-meta">
                    <Tag>{item.task_type}</Tag>
                    {item.variants_count} вар. ·{' '}
                    {new Date(item.created).toLocaleDateString('ru')}
                  </div>
                </div>
                <Space>
                  <Button size="small" onClick={() => {
                    loadWorksheet(item);
                    setShowLoadModal(false);
                  }}>
                    Загрузить
                  </Button>
                  <Popconfirm
                    title="Удалить?"
                    onConfirm={() => deleteWorksheet(item.id)}
                    okText="Да"
                    cancelText="Нет"
                  >
                    <Button size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Space>
              </div>
            )}
          />
        )}
      </Modal>
    </div>
  );
}

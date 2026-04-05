import { useRef, useState } from 'react';
import katex from 'katex';
import {
  Card, Button, Input, Select, Slider, Radio, Checkbox,
  Divider, Space, Tooltip, Modal, List, Typography, Tag, Popconfirm,
} from 'antd';
import {
  ReloadOutlined, PrinterOutlined, SaveOutlined, FolderOpenOutlined,
  DeleteOutlined, RadarChartOutlined,
} from '@ant-design/icons';
import { useUnitCircle } from '../hooks/useUnitCircle';
import UnitCircleSVG from './trig/UnitCircleSVG';
import UnitCirclePrintLayout from './trig/UnitCirclePrintLayout';
import './UnitCircleGenerator.css';

const { Text } = Typography;

function MathInline({ latex }) {
  let html;
  try { html = katex.renderToString(latex, { throwOnError: false, displayMode: false }); }
  catch { html = latex; }
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

const TASK_TYPE_OPTIONS = [
  { value: 'direct',  label: 'Прямая (подписать точки)' },
  { value: 'inverse', label: 'Обратная (отметить точки)' },
  { value: 'mixed',   label: 'Смешанная' },
];

const SHOW_AXES_OPTIONS = [
  { value: 'none', label: 'Ничего' },
  { value: 'axes', label: 'Только оси (0, π/2, π, 3π/2)' },
  { value: 'all',  label: 'Все стандартные углы' },
];

const MAX_K_OPTIONS = [
  { value: 0, label: '0  (только [0, 2π))' },
  { value: 1, label: '±1  (±2π)' },
  { value: 2, label: '±2  (±4π)' },
  { value: 3, label: '±3  (±6π)' },
  { value: 4, label: '±4  (±8π)' },
];

export default function UnitCircleGenerator() {
  const printRef = useRef(null);
  const [showLoadModal, setShowLoadModal] = useState(false);

  const {
    title, setTitle,
    settings, updateSetting,
    tasksData,
    savedId,
    saved, loadingSaved,
    saving,
    generate,
    reset,
    loadSavedList,
    saveWorksheet,
    loadWorksheet,
    deleteWorksheet,
  } = useUnitCircle();

  const handlePrint = () => {
    const style = document.createElement('style');
    style.id = 'ucg-print-page-style';
    style.textContent = '@page { size: A4 portrait; margin: 7mm; }';
    document.head.appendChild(style);
    window.print();
    setTimeout(() => {
      const s = document.getElementById('ucg-print-page-style');
      if (s) s.remove();
    }, 1500);
  };

  const handleOpenLoad = async () => {
    await loadSavedList();
    setShowLoadModal(true);
  };

  const taskLabel = (type) =>
    type === 'direct' ? 'Подписать точки' : 'Отметить точки';

  return (
    <div className="ucg-root">
      {/* Заголовок */}
      <div className="ucg-header">
        <RadarChartOutlined style={{ fontSize: 22, color: '#1677ff' }} />
        <Input
          className="ucg-title-input"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Название (для сохранения)"
          size="middle"
        />
      </div>

      <div className="ucg-layout">
        {/* ── Панель настроек ─────────────────────────────────────── */}
        <Card className="ucg-settings-card" size="small" title="Настройки">

          <div className="ucg-settings-section">
            <div className="ucg-settings-label">Тип задания</div>
            <Select
              value={settings.taskType}
              onChange={v => updateSetting('taskType', v)}
              options={TASK_TYPE_OPTIONS}
              style={{ width: '100%' }}
              size="small"
            />
          </div>

          <div className="ucg-settings-section">
            <div className="ucg-settings-label">Кол-во вариантов: {settings.variantsCount}</div>
            <Slider
              min={1} max={30}
              value={settings.variantsCount}
              onChange={v => updateSetting('variantsCount', v)}
              marks={{ 1: '1', 10: '10', 20: '20', 30: '30' }}
            />
          </div>

          <div className="ucg-settings-section">
            <div className="ucg-settings-label">Кружков на странице A4</div>
            <Radio.Group
              value={settings.circlesPerPage}
              onChange={e => updateSetting('circlesPerPage', e.target.value)}
              size="small"
            >
              <Radio.Button value={2}>2</Radio.Button>
              <Radio.Button value={4}>4</Radio.Button>
            </Radio.Group>
          </div>

          <div className="ucg-settings-section">
            <div className="ucg-settings-label">Точек на кружок: {settings.pointsPerCircle}</div>
            <Slider
              min={4} max={12}
              value={settings.pointsPerCircle}
              onChange={v => updateSetting('pointsPerCircle', v)}
              marks={{ 4: '4', 8: '8', 12: '12' }}
            />
          </div>

          <div className="ucg-settings-section">
            <div className="ucg-settings-label">Смещение по ±k×2π</div>
            <Select
              value={settings.maxK}
              onChange={v => updateSetting('maxK', v)}
              options={MAX_K_OPTIONS}
              style={{ width: '100%' }}
              size="small"
            />
          </div>

          <Divider style={{ margin: '10px 0' }} />

          <div className="ucg-settings-section">
            <div className="ucg-settings-label">Подписи на окружности</div>
            <Select
              value={settings.showAxes}
              onChange={v => updateSetting('showAxes', v)}
              options={SHOW_AXES_OPTIONS}
              style={{ width: '100%' }}
              size="small"
            />
          </div>

          <div className="ucg-settings-section">
            <Space direction="vertical" size={4}>
              <Checkbox
                checked={settings.showDegrees}
                onChange={e => updateSetting('showDegrees', e.target.checked)}
              >
                Показывать градусы (0°, 90°, 180°, 270°)
              </Checkbox>
              <Checkbox
                checked={settings.showTicks}
                onChange={e => updateSetting('showTicks', e.target.checked)}
              >
                Засечки на всех стандартных позициях
              </Checkbox>
              <Checkbox
                checked={settings.showTeacherKey}
                onChange={e => updateSetting('showTeacherKey', e.target.checked)}
              >
                Лист ответов учителя
              </Checkbox>
            </Space>
          </div>
        </Card>

        {/* ── Область превью ─────────────────────────────────────────── */}
        <div className="ucg-preview">
          {/* Кнопки */}
          <div className="ucg-actions">
            <Button
              type="primary"
              icon={<ReloadOutlined />}
              onClick={generate}
            >
              Сгенерировать
            </Button>

            {tasksData && (
              <>
                <Button
                  icon={<PrinterOutlined />}
                  onClick={handlePrint}
                >
                  Печать
                </Button>
                <Button
                  icon={<SaveOutlined />}
                  loading={saving}
                  onClick={saveWorksheet}
                >
                  {savedId ? 'Обновить' : 'Сохранить'}
                </Button>
              </>
            )}

            <Button
              icon={<FolderOpenOutlined />}
              onClick={handleOpenLoad}
            >
              Загрузить
            </Button>

            {tasksData && (
              <Popconfirm
                title="Сбросить всё?"
                onConfirm={reset}
                okText="Да"
                cancelText="Нет"
              >
                <Button danger>Сброс</Button>
              </Popconfirm>
            )}
          </div>

          {/* Превью вариантов */}
          {!tasksData ? (
            <div className="ucg-empty-hint">
              <RadarChartOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
              <span>Нажмите «Сгенерировать» чтобы создать варианты</span>
            </div>
          ) : (
            <div className="ucg-variants-list">
              {tasksData.map((variant, vi) => (
                <Card
                  key={vi}
                  className="ucg-variant-card"
                  size="small"
                  title={`Вариант ${vi + 1}`}
                >
                  <div className={`ucg-circles-grid layout-${settings.circlesPerPage}`}>
                    {variant.map((task, ti) => (
                      <div key={ti} className="ucg-circle-preview">
                        <div className="ucg-preview-label">{taskLabel(task.type)}</div>

                        <div className="ucg-circle-svg-wrap">
                          <UnitCircleSVG
                            points={task.points}
                            taskType={task.type}
                            isAnswer={false}
                            showAxes={settings.showAxes}
                            showDegrees={settings.showDegrees}
                            showTicks={settings.showTicks}
                          />
                        </div>

                        {task.type === 'direct' && (
                          <div className="ucg-answers-preview">
                            {task.points.map(p => (
                              <div key={p.id} className="ucg-answer-preview-item">
                                <b>{p.id}.</b>
                                <span style={{ color: '#bbb', fontSize: 10 }}>____</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {task.type === 'inverse' && (
                          <div className="ucg-angle-list-preview">
                            {task.points.map(p => (
                              <span key={p.id} style={{ marginRight: 8 }}>
                                <b>{p.id}.</b> <MathInline latex={p.display} />
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Печатная вёрстка (скрыта на экране) ──────────────────────────── */}
      <UnitCirclePrintLayout
        tasksData={tasksData}
        settings={settings}
        title={title}
      />

      {/* ── Модал загрузки ────────────────────────────────────────────────── */}
      <Modal
        title="Загрузить сохранённый лист"
        open={showLoadModal}
        onCancel={() => setShowLoadModal(false)}
        footer={null}
        width={500}
      >
        {saved.length === 0 && !loadingSaved ? (
          <Text type="secondary">Нет сохранённых листов</Text>
        ) : (
          <List
            loading={loadingSaved}
            dataSource={saved}
            renderItem={item => (
              <div className="ucg-saved-item">
                <div>
                  <div>{item.title}</div>
                  <div className="ucg-saved-meta">
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

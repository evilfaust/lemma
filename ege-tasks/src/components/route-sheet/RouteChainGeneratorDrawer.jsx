import { useMemo, useCallback } from 'react';
import {
  Alert, Button, Checkbox, Drawer, Input, Radio, Slider,
  Space, Spin, Tag, Tooltip, Typography,
} from 'antd';
import {
  ArrowLeftOutlined, DeleteOutlined, ReloadOutlined, ThunderboltOutlined,
} from '@ant-design/icons';
import MathRenderer from '../../shared/components/MathRenderer';
import useRouteChainGenerator from '../../hooks/useRouteChainGenerator';
import { circleNum } from '../../hooks/useRouteSheet';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

const DIFFICULTY_OPTIONS = [
  { value: 1, label: 'Базовая' },
  { value: 2, label: 'Средняя' },
  { value: 3, label: 'Повышенная' },
];

const labelStyle = {
  fontSize: 12,
  fontWeight: 500,
  color: '#555',
  display: 'block',
  marginBottom: 6,
};

function SettingsStep({ gen, existingTasks, onGenerate }) {
  const handleGenerate = useCallback(() => {
    onGenerate({ existingTasks });
  }, [existingTasks, onGenerate]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Описание */}
      <div>
        <label style={labelStyle}>Описание</label>
        <TextArea
          value={gen.description}
          onChange={e => gen.setDescription(e.target.value)}
          placeholder={'Например:\n«Задачи на проценты для 7 класса, про скидки в магазине»\n«Цепочка по теореме Пифагора, прямоугольные треугольники»\n«Уравнения с одной переменной, простые»'}
          rows={4}
          maxLength={300}
          showCount
        />
        <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
          Опишите свободно что хотите сгенерировать — тему, класс, стиль задач
        </div>
      </div>

      {/* Количество задач */}
      <div>
        <label style={labelStyle}>
          Задач в цепочке:&nbsp;<Text strong style={{ color: '#1890ff' }}>{gen.length}</Text>
        </label>
        <Slider
          min={2} max={6} step={1}
          value={gen.length}
          onChange={gen.setLength}
          marks={{ 2: '2', 3: '3', 4: '4', 5: '5', 6: '6' }}
          style={{ margin: '8px 4px 4px' }}
        />
      </div>

      {/* Сложность */}
      <div>
        <label style={labelStyle}>Сложность</label>
        <Radio.Group
          value={gen.difficulty}
          onChange={e => gen.setDifficulty(e.target.value)}
          optionType="button"
          buttonStyle="solid"
          size="small"
        >
          {DIFFICULTY_OPTIONS.map(o => (
            <Radio.Button key={o.value} value={o.value}>{o.label}</Radio.Button>
          ))}
        </Radio.Group>
      </div>

      {/* Нарратив */}
      <div>
        <label style={labelStyle}>
          Нарратив&nbsp;<Text type="secondary" style={{ fontWeight: 400 }}>(необязательно)</Text>
        </label>
        <Input
          value={gen.narrative}
          onChange={e => gen.setNarrative(e.target.value)}
          placeholder="про поездку на поезде, про ремонт квартиры, про магазин…"
          maxLength={100}
          showCount
        />
        <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
          Единый сюжет, связывающий все задачи
        </div>
      </div>

      {/* Пожелания */}
      <div>
        <label style={labelStyle}>
          Пожелания&nbsp;<Text type="secondary" style={{ fontWeight: 400 }}>(необязательно)</Text>
        </label>
        <TextArea
          value={gen.wishes}
          onChange={e => gen.setWishes(e.target.value)}
          placeholder={'Например:\n«Ответы — целые числа от 1 до 20»\n«Первая задача на нахождение площади»\n«Не использовать дроби»'}
          rows={3}
          maxLength={300}
          showCount
        />
        <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
          Конкретные требования к задачам и ответам
        </div>
      </div>

      {/* Продолжить цепочку */}
      {existingTasks.length > 0 && (
        <div style={{
          background: '#f0f5ff',
          border: '1px solid #adc6ff',
          borderRadius: 8,
          padding: '10px 14px',
        }}>
          <Checkbox
            checked={gen.continueChain}
            onChange={e => gen.setContinueChain(e.target.checked)}
          >
            <Text strong>Продолжить текущую цепочку</Text>
          </Checkbox>
          <Paragraph style={{ margin: '6px 0 0 24px', fontSize: 12, color: '#555' }}>
            LLM учтёт уже имеющиеся {existingTasks.length} задач и продолжит цепочку логично.
          </Paragraph>
          {gen.continueChain && (
            <div style={{ marginTop: 8, marginLeft: 24, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {existingTasks.map((t, i) => (
                <Tooltip key={t.id} title={`Ответ: ${t.answer || '—'}`}>
                  <Tag color="blue" style={{ fontFamily: 'monospace' }}>
                    {circleNum(i)} = {t.answer || '?'}
                  </Tag>
                </Tooltip>
              ))}
            </div>
          )}
        </div>
      )}

      {gen.error && (
        <Alert type="error" message={gen.error} showIcon closable onClose={gen.backToSettings} />
      )}

      <Button
        type="primary"
        icon={<ThunderboltOutlined />}
        size="large"
        block
        loading={gen.loading}
        onClick={handleGenerate}
        style={{ marginTop: 4 }}
      >
        {gen.loading ? 'Генерирую (~15 сек)…' : 'Сгенерировать цепочку'}
      </Button>
    </div>
  );
}

function PreviewStep({ gen, existingCount, onAccept }) {
  const offset = existingCount;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <Alert
        type="success"
        showIcon
        message={`Сгенерировано ${gen.generatedTasks.length} задач. Проверьте и при необходимости отредактируйте.`}
        style={{ marginBottom: 16 }}
      />

      {gen.generatedTasks.map((task, idx) => {
        const globalIdx = offset + idx;
        return (
          <div key={idx}>
            {(idx > 0 || offset > 0) && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                paddingLeft: 20, color: '#aaa', fontSize: 11,
                fontStyle: 'italic', margin: '4px 0',
              }}>
                ↓ ответ {circleNum(globalIdx - 1)} → эта задача
              </div>
            )}

            <div style={{
              border: '1px solid #d9d9d9',
              borderRadius: 8,
              padding: '12px 14px',
              background: '#fafafa',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text strong style={{ fontSize: 18, color: '#1890ff', lineHeight: 1 }}>
                  {circleNum(globalIdx)}
                </Text>
                <Tooltip title="Убрать эту задачу">
                  <Button size="small" icon={<DeleteOutlined />} danger type="text" onClick={() => gen.removeTask(idx)} />
                </Tooltip>
              </div>

              {task.statement_md && (
                <div style={{
                  background: '#fff', border: '1px solid #e8e8e8', borderRadius: 6,
                  padding: '6px 10px', marginBottom: 8, fontSize: 13, lineHeight: 1.5,
                }}>
                  <MathRenderer content={task.statement_md} />
                </div>
              )}

              <TextArea
                value={task.statement_md}
                onChange={e => gen.updateTask(idx, 'statement_md', e.target.value)}
                rows={3}
                placeholder="Условие задачи"
                style={{ fontFamily: 'monospace', fontSize: 12, marginBottom: 8 }}
              />

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 12, whiteSpace: 'nowrap' }}>Ответ:</Text>
                <Input
                  value={task.answer}
                  onChange={e => gen.updateTask(idx, 'answer', e.target.value)}
                  placeholder="числовой ответ"
                  style={{ width: 140, fontWeight: 600 }}
                  size="small"
                />
              </div>
            </div>
          </div>
        );
      })}

      <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={gen.backToSettings}>Назад</Button>
        <Button icon={<ReloadOutlined />} onClick={gen.backToSettings}>Перегенерировать</Button>
        <Button
          type="primary" block
          disabled={!gen.generatedTasks.length}
          onClick={onAccept}
        >
          Добавить в маршрут ({gen.generatedTasks.length})
        </Button>
      </div>
    </div>
  );
}

export default function RouteChainGeneratorDrawer({ open, onClose, existingTasks, onTasksReady }) {
  const gen = useRouteChainGenerator();

  const handleClose = useCallback(() => {
    gen.reset();
    onClose();
  }, [gen, onClose]);

  const handleAccept = useCallback(() => {
    const valid = gen.generatedTasks.filter(t => t.statement_md?.trim() && t.answer?.trim());
    if (valid.length) onTasksReady(valid);
    gen.reset();
    onClose();
  }, [gen, onTasksReady, onClose]);

  const existingCount = gen.continueChain ? existingTasks.length : 0;

  return (
    <Drawer
      title={<Space><ThunderboltOutlined style={{ color: '#faad14' }} /><span>AI-генерация цепочки</span></Space>}
      open={open}
      onClose={handleClose}
      width={500}
      placement="right"
      destroyOnHidden
      footer={null}
    >
      <Spin spinning={gen.loading} tip="Генерирую задачи (~15 сек)…">
        {gen.step === 'settings' ? (
          <SettingsStep gen={gen} existingTasks={existingTasks} onGenerate={gen.generate} />
        ) : (
          <PreviewStep gen={gen} existingCount={existingCount} onAccept={handleAccept} />
        )}
      </Spin>
    </Drawer>
  );
}

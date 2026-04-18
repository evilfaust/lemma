import { useState } from 'react';
import katex from 'katex';
import {
  Card, Button, Slider, Radio, Checkbox,
  Divider, Space, Input, Switch, Tag, Popconfirm,
} from 'antd';
import {
  ReloadOutlined, PrinterOutlined, FunctionOutlined,
} from '@ant-design/icons';
import { useTrigExpressions } from '../hooks/useTrigExpressions';
import TrigExprPrintLayout from './trig/TrigExprPrintLayout';

function MathInline({ latex }) {
  let html;
  try { html = katex.renderToString(latex, { throwOnError: false, displayMode: false }); }
  catch { html = latex; }
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

const LABELS = Array.from({ length: 20 }, (_, i) => String(i + 1));

const TASK_TYPE_OPTIONS = [
  { value: 'sum',     label: 'Сложение / вычитание' },
  { value: 'product', label: 'Умножение' },
  { value: 'mixed',   label: 'Смешанный' },
];

export default function TrigExpressionsGenerator() {
  const {
    title, setTitle,
    settings, updateSetting,
    tasksData,
    generate, reset,
  } = useTrigExpressions();

  const handlePrint = () => {
    const style = document.createElement('style');
    style.id = 'texpr-print-page-style';
    const size = settings.twoPerPage ? 'A4 portrait' : 'A4 portrait';
    style.textContent = `@page { size: ${size}; margin: 0; }`;
    document.head.appendChild(style);
    window.print();
    setTimeout(() => {
      const s = document.getElementById('texpr-print-page-style');
      if (s) s.remove();
    }, 1500);
  };

  const fnCheckboxes = [
    { key: 'useSin', label: 'sin' },
    { key: 'useCos', label: 'cos' },
    { key: 'useTan', label: 'tg' },
    { key: 'useCot', label: 'ctg' },
  ];

  const activeFns = fnCheckboxes.filter(f => settings[f.key]).map(f => f.label);
  const typeLabel = TASK_TYPE_OPTIONS.find(o => o.value === settings.taskType)?.label ?? '';

  return (
    <div style={{ padding: 16, maxWidth: 1200 }}>
      {/* Заголовок */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <FunctionOutlined style={{ fontSize: 20, color: '#1677ff' }} />
        <Input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Название листа"
          style={{ maxWidth: 420, fontSize: 15 }}
        />
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        {/* ── Настройки ── */}
        <Card size="small" title="Настройки" style={{ flex: '0 0 250px', minWidth: 220 }}>

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>
              Тип выражений
            </div>
            <Radio.Group
              value={settings.taskType}
              onChange={e => updateSetting('taskType', e.target.value)}
              size="small"
              style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
            >
              {TASK_TYPE_OPTIONS.map(o => (
                <Radio key={o.value} value={o.value}>{o.label}</Radio>
              ))}
            </Radio.Group>
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>
              Слагаемых / множителей: <b>{settings.termsCount}</b>
            </div>
            <Slider
              min={2} max={5}
              value={settings.termsCount}
              onChange={v => updateSetting('termsCount', v)}
              marks={{ 2: '2', 3: '3', 4: '4', 5: '5' }}
              size="small"
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>
              Заданий в варианте: <b>{settings.questionsCount}</b>
            </div>
            <Slider
              min={2} max={12}
              value={settings.questionsCount}
              onChange={v => updateSetting('questionsCount', v)}
              marks={{ 2: '2', 6: '6', 10: '10', 12: '12' }}
              size="small"
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>
              Вариантов: <b>{settings.variantsCount}</b>
            </div>
            <Slider
              min={1} max={32}
              value={settings.variantsCount}
              onChange={v => updateSetting('variantsCount', v)}
              marks={{ 1: '1', 10: '10', 20: '20', 32: '32' }}
              size="small"
            />
          </div>

          <Divider style={{ margin: '8px 0' }} />

          <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>Функции</div>
          <Space wrap size={4}>
            {fnCheckboxes.map(f => (
              <Checkbox
                key={f.key}
                checked={settings[f.key]}
                onChange={e => updateSetting(f.key, e.target.checked)}
              >
                {f.label}
              </Checkbox>
            ))}
          </Space>

          <Divider style={{ margin: '8px 0' }} />

          <Space direction="vertical" size={6}>
            <Checkbox
              checked={settings.useNegAngles}
              onChange={e => updateSetting('useNegAngles', e.target.checked)}
            >
              Отрицательные углы
            </Checkbox>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Switch
                size="small"
                checked={settings.useDegrees}
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
            <Checkbox
              checked={settings.twoPerPage}
              onChange={e => updateSetting('twoPerPage', e.target.checked)}
            >
              2 варианта на листе A4
            </Checkbox>
          </Space>

          <Divider style={{ margin: '8px 0' }} />
          <Checkbox
            checked={settings.showWorkSpace}
            onChange={e => updateSetting('showWorkSpace', e.target.checked)}
          >
            Место для работы
          </Checkbox>
          {settings.showWorkSpace && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>
                Высота: <b>{settings.workSpaceSize} мм</b>
              </div>
              <Slider min={2} max={50} value={settings.workSpaceSize}
                onChange={v => updateSetting('workSpaceSize', v)}
                marks={{ 2: '2', 15: '15', 30: '30', 50: '50' }} size="small" />
            </div>
          )}
        </Card>

        {/* ── Превью ── */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Кнопки */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            <Button type="primary" icon={<ReloadOutlined />} onClick={generate}>
              Сгенерировать
            </Button>
            {tasksData && (
              <Button icon={<PrinterOutlined />} onClick={handlePrint}>
                Печать
              </Button>
            )}
            {tasksData && (
              <Popconfirm title="Сбросить?" onConfirm={reset} okText="Да" cancelText="Нет">
                <Button danger>Сброс</Button>
              </Popconfirm>
            )}
          </div>

          {/* Пустое состояние */}
          {!tasksData ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 12, padding: '60px 0', color: '#bbb', fontSize: 14,
            }}>
              <FunctionOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
              <div>Нажмите «Сгенерировать» чтобы создать лист</div>
            </div>
          ) : (
            <>
              {/* Сводка */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                <Tag color="blue">{typeLabel}</Tag>
                <Tag color="geekblue">{activeFns.join(', ')}</Tag>
                <Tag color="purple">{settings.termsCount} терм.</Tag>
                <Tag color="cyan">{settings.questionsCount} зад./вар.</Tag>
                <Tag color="orange">{settings.variantsCount} вар.</Tag>
                {settings.useNegAngles && <Tag color="volcano">±углы</Tag>}
                {settings.twoPerPage && <Tag color="green">2 вар./лист</Tag>}
                {settings.showTeacherKey && <Tag>+ Ответы</Tag>}
              </div>

              {/* Карточки вариантов */}
              {tasksData.map((variant, vi) => (
                <div key={vi} style={{
                  border: '1px solid #e8e8e8', borderRadius: 8,
                  overflow: 'hidden', marginBottom: 12,
                }}>
                  <div style={{
                    background: '#fafafa', borderBottom: '1px solid #e8e8e8',
                    padding: '8px 14px', fontSize: 13, fontWeight: 600, color: '#333',
                  }}>
                    Вариант {vi + 1}
                    <span style={{ color: '#999', fontSize: 11, fontWeight: 400, marginLeft: 8 }}>
                      {variant.length} заданий
                    </span>
                  </div>
                  <div style={{ padding: '8px 14px' }}>
                    {variant.map((q, qi) => (
                      <div key={qi} style={{
                        display: 'flex', alignItems: 'baseline', gap: 4,
                        padding: '4px 0',
                        borderBottom: qi < variant.length - 1 ? '1px dotted #eee' : 'none',
                        fontSize: 13,
                      }}>
                        <span style={{ fontWeight: 600, minWidth: 18, color: '#555' }}>
                          {LABELS[qi]})
                        </span>
                        <span style={{ flex: 1 }}>
                          <MathInline latex={q.exprLatex} />
                        </span>
                        <span style={{ color: '#999', padding: '0 4px' }}>=</span>
                        <span style={{ color: '#c0392b', fontWeight: 500 }}>
                          <MathInline latex={q.resultLatex} />
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Печатная вёрстка — скрыта на экране */}
      {tasksData && (
        <TrigExprPrintLayout
          tasksData={tasksData}
          settings={settings}
          title={title}
        />
      )}
    </div>
  );
}

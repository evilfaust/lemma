import { useState } from 'react';
import katex from 'katex';
import {
  Card, Button, Slider, Checkbox,
  Divider, Space, Input, Switch, Tag, Row, Col,
} from 'antd';
import { ReloadOutlined, PrinterOutlined, FunctionOutlined } from '@ant-design/icons';
import { useAdditionFormulas } from '../hooks/useAdditionFormulas';
import TrigExprPrintLayout from './trig/TrigExprPrintLayout';

function MathInline({ latex }) {
  let html;
  try { html = katex.renderToString(latex, { throwOnError: false, displayMode: false }); }
  catch { html = latex; }
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

const LABELS = Array.from({ length: 20 }, (_, i) => String(i + 1));

const TASK_TYPE_OPTIONS = [
  { value: 'formula_eval', label: 'Числовое распознавание', desc: 'sin12°cos78° + cos12°sin78° = ?' },
  { value: 'symbolic',     label: 'Символьное упрощение',  desc: 'sin5α cos3α − cos5α sin3α = ?' },
  { value: 'nonstandard',  label: 'Нестандартные углы',    desc: 'sin75° (=45°+30°) = ?' },
];

const FUNC_OPTIONS = [
  { value: 'sin', label: 'sin' },
  { value: 'cos', label: 'cos' },
  { value: 'tan', label: 'tg' },
];

function getInstruction(taskTypes) {
  const hasEval = taskTypes.includes('formula_eval') || taskTypes.includes('nonstandard');
  const hasSym  = taskTypes.includes('symbolic');
  if (hasSym && !hasEval) return 'Упростите выражение:';
  if (!hasSym && hasEval) return 'Вычислите:';
  return 'Вычислите или упростите:';
}

export default function AdditionFormulasGenerator() {
  const {
    title, setTitle,
    settings, updateSetting,
    tasksData,
    generate, reset,
  } = useAdditionFormulas();

  const handlePrint = () => {
    const style = document.createElement('style');
    style.id = 'af-print-page-style';
    style.textContent = '@page { size: A4 portrait; margin: 0; }';
    document.head.appendChild(style);
    window.print();
    setTimeout(() => document.getElementById('af-print-page-style')?.remove(), 1500);
  };

  const { taskTypes, funcs, incSum, incDiff, variantsCount, tasksPerVariant,
          twoPerPage, showTeacherKey } = settings;

  const instruction = getInstruction(taskTypes);

  const typeTags = TASK_TYPE_OPTIONS.filter(o => taskTypes.includes(o.value)).map(o => o.label);
  const funcTags = FUNC_OPTIONS.filter(o => funcs.includes(o.value)).map(o => o.label);

  return (
    <div style={{ padding: 16, maxWidth: 1200 }}>
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
        <Card size="small" title="Настройки" style={{ flex: '0 0 270px', minWidth: 240 }}>

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>Типы задач</div>
            <Space direction="vertical" size={4}>
              {TASK_TYPE_OPTIONS.map(o => (
                <div key={o.value} style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <Checkbox
                    checked={taskTypes.includes(o.value)}
                    onChange={e => {
                      const next = e.target.checked
                        ? [...taskTypes, o.value]
                        : taskTypes.filter(t => t !== o.value);
                      if (next.length) updateSetting('taskTypes', next);
                    }}
                  >
                    {o.label}
                  </Checkbox>
                  <span style={{ fontSize: 11, color: '#8c8c8c' }}>{o.desc}</span>
                </div>
              ))}
            </Space>
          </div>

          <Divider style={{ margin: '10px 0' }} />

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>Функции</div>
            <Checkbox.Group
              options={FUNC_OPTIONS}
              value={funcs}
              onChange={v => { if (v.length) updateSetting('funcs', v); }}
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>Операция</div>
            <Space>
              <Checkbox checked={incSum}  onChange={e => { if (e.target.checked || incDiff) updateSetting('incSum',  e.target.checked); }}>
                Сумма (A+B)
              </Checkbox>
              <Checkbox checked={incDiff} onChange={e => { if (e.target.checked || incSum)  updateSetting('incDiff', e.target.checked); }}>
                Разность (A−B)
              </Checkbox>
            </Space>
          </div>

          <Divider style={{ margin: '10px 0' }} />

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>
              Задач в варианте: <b>{tasksPerVariant}</b>
            </div>
            <Slider min={4} max={20} value={tasksPerVariant} onChange={v => updateSetting('tasksPerVariant', v)} />
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>
              Вариантов: <b>{variantsCount}</b>
            </div>
            <Slider min={1} max={8} value={variantsCount} onChange={v => updateSetting('variantsCount', v)} />
          </div>

          <Divider style={{ margin: '10px 0' }} />

          <div style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: '#666' }}>2 варианта на стр.</span>
              <Switch size="small" checked={twoPerPage} onChange={v => updateSetting('twoPerPage', v)} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: '#666' }}>Лист ответов</span>
              <Switch size="small" checked={showTeacherKey} onChange={v => updateSetting('showTeacherKey', v)} />
            </div>
          </div>

          <Divider style={{ margin: '10px 0' }} />

          <Space direction="vertical" style={{ width: '100%' }}>
            <Button type="primary" block icon={<ReloadOutlined />} onClick={generate}>
              Сформировать
            </Button>
            {tasksData && (
              <>
                <Button block icon={<PrinterOutlined />} onClick={handlePrint}>Печать</Button>
                <Button block size="small" onClick={reset}>Сбросить</Button>
              </>
            )}
          </Space>
        </Card>

        {/* ── Превью ── */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {!tasksData ? (
            <Card size="small">
              <div style={{ padding: '40px 0', textAlign: 'center', color: '#8c8c8c' }}>
                <FunctionOutlined style={{ fontSize: 32, marginBottom: 12 }} />
                <div style={{ fontSize: 15 }}>Настройте параметры и нажмите «Сформировать»</div>
                <div style={{ fontSize: 12, marginTop: 8 }}>
                  Типы: {typeTags.join(', ')} · Функции: {funcTags.join(', ')}
                </div>
              </div>
            </Card>
          ) : (
            <Card
              size="small"
              title={
                <span>
                  Предпросмотр
                  <Tag style={{ marginLeft: 8 }} color="blue">{variantsCount} вар.</Tag>
                  <Tag color="geekblue">{tasksPerVariant} задач</Tag>
                </span>
              }
            >
              {tasksData.map((variant, vi) => (
                <div key={vi} style={{ marginBottom: 20 }}>
                  <div style={{ fontWeight: 600, marginBottom: 8, color: '#1677ff' }}>
                    Вариант {vi + 1}
                  </div>
                  <Row gutter={[8, 4]}>
                    {variant.map((q, qi) => (
                      <Col key={qi} xs={24} sm={12}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'baseline', fontSize: 13 }}>
                          <span style={{ color: '#8c8c8c', minWidth: 20 }}>{LABELS[qi]})</span>
                          <MathInline latex={q.exprLatex} />
                          <span style={{ color: '#8c8c8c', margin: '0 2px' }}>=</span>
                          <span style={{ color: '#c0392b', fontWeight: 500 }}>
                            <MathInline latex={q.resultLatex} />
                          </span>
                        </div>
                      </Col>
                    ))}
                  </Row>
                </div>
              ))}
            </Card>
          )}
        </div>
      </div>

      {tasksData && (
        <TrigExprPrintLayout
          tasksData={tasksData}
          settings={settings}
          title={title}
          instruction={instruction}
          questionMode="inline"
        />
      )}
    </div>
  );
}

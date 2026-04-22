import { useState } from 'react';
import katex from 'katex';
import {
  Card, Button, Slider, Checkbox,
  Divider, Space, Input, Tag, Popconfirm,
} from 'antd';
import { ReloadOutlined, PrinterOutlined, FunctionOutlined, CheckSquareOutlined } from '@ant-design/icons';
import { useTrigEquations } from '../hooks/useTrigEquations';
import { useTrigMCModal } from '../hooks/useTrigMCModal';
import TrigExprPrintLayout from './trig/TrigExprPrintLayout';
import TrigMCSaveModal from './trig/TrigMCSaveModal';
import TrigMCPrintLayout from './trig/TrigMCPrintLayout';

function MathInline({ latex }) {
  let html;
  try { html = katex.renderToString(latex, { throwOnError: false, displayMode: false }); }
  catch { html = latex; }
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

const LABELS = Array.from({ length: 20 }, (_, i) => String(i + 1));

export default function TrigEquationsGenerator() {
  const { title, setTitle, settings, updateSetting, tasksData, generate, reset } = useTrigEquations();
  const { modalOpen, setModalOpen, printTest, handlePrint: handleMCPrint } = useTrigMCModal();

  const handlePrint = () => {
    const style = document.createElement('style');
    style.id = 'texpr-print-page-style';
    style.textContent = '@page { size: A4 portrait; margin: 0; }';
    document.head.appendChild(style);
    window.print();
    setTimeout(() => document.getElementById('texpr-print-page-style')?.remove(), 1500);
  };

  const fnBoxes = [
    { key: 'useSin', label: 'sin t = a' },
    { key: 'useCos', label: 'cos t = a' },
    { key: 'useTan', label: 'tg t = a' },
    { key: 'useCot', label: 'ctg t = a' },
  ];

  return (
    <div style={{ padding: 16, maxWidth: 1200 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <FunctionOutlined style={{ fontSize: 20, color: '#13c2c2' }} />
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
          <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>Типы уравнений</div>
          <Space direction="vertical" size={4}>
            {fnBoxes.map(f => (
              <Checkbox key={f.key} checked={settings[f.key]}
                onChange={e => updateSetting(f.key, e.target.checked)}>{f.label}</Checkbox>
            ))}
          </Space>

          <Divider style={{ margin: '8px 0' }} />
          <Space direction="vertical" size={6}>
            <Checkbox checked={settings.showTeacherKey}
              onChange={e => updateSetting('showTeacherKey', e.target.checked)}>
              Лист ответов (учитель)
            </Checkbox>
            <Checkbox checked={settings.twoPerPage}
              onChange={e => updateSetting('twoPerPage', e.target.checked)}>
              2 варианта на листе A4
            </Checkbox>
          </Space>

          <Divider style={{ margin: '8px 0' }} />
          <Checkbox checked={settings.showWorkSpace}
            onChange={e => updateSetting('showWorkSpace', e.target.checked)}>
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
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            <Button type="primary" icon={<ReloadOutlined />} onClick={generate}>Сгенерировать</Button>
            {tasksData && <Button icon={<PrinterOutlined />} onClick={handlePrint}>Печать</Button>}
            {tasksData && (
              <Button icon={<CheckSquareOutlined />} onClick={() => setModalOpen(true)}>
                Тест с выбором
              </Button>
            )}
            {tasksData && (
              <Popconfirm title="Сбросить?" onConfirm={reset} okText="Да" cancelText="Нет">
                <Button danger>Сброс</Button>
              </Popconfirm>
            )}
          </div>

          {!tasksData ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 12, padding: '60px 0', color: '#bbb', fontSize: 14 }}>
              <FunctionOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
              <div>Нажмите «Сгенерировать» чтобы создать лист</div>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                <Tag color="cyan">{settings.questionsCount} зад./вар.</Tag>
                <Tag color="orange">{settings.variantsCount} вар.</Tag>
                {settings.twoPerPage && <Tag color="green">2 вар./лист</Tag>}
                {settings.showTeacherKey && <Tag>+ Ответы</Tag>}
              </div>

              {tasksData.map((variant, vi) => (
                <div key={vi} style={{ border: '1px solid #e8e8e8', borderRadius: 8,
                  overflow: 'hidden', marginBottom: 12 }}>
                  <div style={{ background: '#fafafa', borderBottom: '1px solid #e8e8e8',
                    padding: '8px 14px', fontSize: 13, fontWeight: 600 }}>
                    Вариант {vi + 1}
                    <span style={{ color: '#999', fontSize: 11, fontWeight: 400, marginLeft: 8 }}>
                      {variant.length} заданий
                    </span>
                  </div>
                  <div style={{ padding: '8px 14px' }}>
                    {variant.map((q, qi) => (
                      <div key={qi} style={{ display: 'flex', alignItems: 'baseline', gap: 4,
                        padding: '4px 0', borderBottom: qi < variant.length - 1 ? '1px dotted #eee' : 'none',
                        fontSize: 13 }}>
                        <span style={{ fontWeight: 600, minWidth: 18, color: '#555' }}>{LABELS[qi]})</span>
                        <span style={{ flex: 1 }}><MathInline latex={q.exprLatex} /></span>
                        <span style={{ color: '#13c2c2', fontWeight: 500, fontSize: 11, maxWidth: 280, textAlign: 'right' }}>
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

      {tasksData && (
        <TrigExprPrintLayout
          tasksData={tasksData}
          settings={settings}
          title={title}
          instruction="Решите уравнение:"
          questionMode="plain"
        />
      )}

      <TrigMCSaveModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        tasksData={tasksData}
        generatorType="trig_equations"
        generatorTitle={title}
        settings={settings}
        onPrint={handleMCPrint}
      />
      {printTest && (
        <TrigMCPrintLayout
          variants={printTest.variants}
          title={printTest.title}
          shuffleMode={printTest.shuffle_mode || 'fixed'}
        />
      )}
    </div>
  );
}

import React, { useState, useCallback } from 'react';
import katex from 'katex';
import {
  Button, Switch, Slider, Select, Checkbox, Space,
  Input, Row, Col, Typography, InputNumber, Tabs,
} from 'antd';
import {
  PrinterOutlined, ThunderboltOutlined, FunctionOutlined,
  HolderOutlined,
} from '@ant-design/icons';
import { SplitLayout, ConfigLabel } from '../ui';
import UnitCircleSVG from './trig/UnitCircleSVG';
import { useTrigExpressions }      from '../hooks/useTrigExpressions';
import { useInverseTrig }           from '../hooks/useInverseTrig';
import { useReductionFormulas }     from '../hooks/useReductionFormulas';
import { useAdditionFormulas }      from '../hooks/useAdditionFormulas';
import { useTrigEquations }         from '../hooks/useTrigEquations';
import { useUnitCircle }            from '../hooks/useUnitCircle';
import { useDoubleAngle }           from '../hooks/useDoubleAngle';
import { useTrigEquationsAdvanced } from '../hooks/useTrigEquationsAdvanced';
import TrigMixedPrintLayout     from './trig/TrigMixedPrintLayout';

const { Text } = Typography;

function MathInline({ latex }) {
  let html;
  try { html = katex.renderToString(latex, { throwOnError: false, displayMode: false }); }
  catch { html = latex; }
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

// ─── Реестр генераторов ───────────────────────────────────────────────────────
// Чтобы добавить новый генератор — добавить запись в этот массив.
const GENERATOR_REGISTRY = [
  {
    id: 'trigExpressions',
    label: 'Тригонометрические выражения',
    instruction: 'Вычислите:',
    questionMode: 'inline',
  },
  {
    id: 'inverseTrig',
    label: 'Обратные тригонометрические функции',
    instruction: 'Вычислите:',
    questionMode: 'inline',
  },
  {
    id: 'reductionFormulas',
    label: 'Формулы приведения',
    instruction: 'Упростите или вычислите:',
    questionMode: 'inline',
  },
  {
    id: 'additionFormulas',
    label: 'Формулы сложения',
    instruction: 'Упростите или вычислите:',
    questionMode: 'inline',
  },
  {
    id: 'trigEquations',
    label: 'Простейшие тригонометрические уравнения',
    instruction: 'Решите уравнение:',
    questionMode: 'twoLine',
  },
  {
    id: 'unitCircle',
    label: 'Единичная окружность',
    instruction: null,
    questionMode: 'unitcircle',
  },
  {
    id: 'doubleAngle',
    label: 'Формулы двойного аргумента',
    instruction: 'Вычислите или упростите:',
    questionMode: 'inline',
  },
  {
    id: 'trigEquationsAdvanced',
    label: 'Уравнения f(kx + b) = a',
    instruction: 'Решите уравнение:',
    questionMode: 'twoLine',
  },
];

// ─── Начальные настройки каждого генератора ───────────────────────────────────
const INITIAL_GEN_CONFIGS = {
  trigExpressions: {
    enabled: true,
    twoColumns: false,
    questionsCount: 4,
    taskType: 'mixed',
    useSin: true, useCos: true, useTan: false, useCot: false,
    useNegAngles: true, useDegrees: false, termsCount: 3,
  },
  inverseTrig: {
    enabled: false,
    twoColumns: false,
    questionsCount: 4,
    taskType: 'mixed',
    useArcsin: true, useArccos: true, useArctan: false, useArccot: false,
    useOuterSin: true, useOuterCos: true, useOuterTan: false, useOuterCot: false,
    useDegrees: false,
  },
  reductionFormulas: {
    enabled: false,
    twoColumns: false,
    tasksPerVariant: 4,
    taskTypes: ['basic', 'reversed'],
    funcs: ['sin', 'cos', 'tan', 'cot'],
    angleMode: 'both',
    numPatterns: { sqrt3: true, sqrt2: true, complementary: true },
  },
  additionFormulas: {
    enabled: false,
    twoColumns: false,
    tasksPerVariant: 4,
    taskTypes: ['formula_eval', 'symbolic'],
    funcs: ['sin', 'cos', 'tan'],
    incSum: true, incDiff: true, showHint: false,
  },
  trigEquations: {
    enabled: true,
    twoColumns: true,
    questionsCount: 4,
    useSin: true, useCos: true, useTan: false, useCot: false,
  },
  unitCircle: {
    enabled: false,
    circlesPerPage: 2,
    pointsPerCircle: 8,
    maxK: 1,
    taskType: 'mixed',
    showAxes: 'axes',
    showDegrees: false,
    showTicks: true,
    useDegrees: false,
  },
  doubleAngle: {
    enabled: false,
    twoColumns: false,
    tasksPerVariant: 4,
    taskTypes: ['numeric', 'symbolic'],
    funcs: ['sin', 'cos'],
    incSin: true, incCos: true, incTan: false,
  },
  trigEquationsAdvanced: {
    enabled: false,
    twoColumns: true,
    questionsCount: 4,
    useType1: true,
    useType2: false,
  },
};

// ─── Настройки конкретного генератора (компакт) ───────────────────────────────
function GenSettings({ id, cfg, onChange }) {
  const set = (key, val) => onChange({ ...cfg, [key]: val });

  if (id === 'trigExpressions') {
    return (
      <Space direction="vertical" size={4} style={{ width: '100%' }}>
        <Row align="middle" gutter={8}>
          <Col>
            <Text type="secondary" style={{ fontSize: 12 }}>Заданий:</Text>
          </Col>
          <Col>
            <InputNumber min={2} max={12} value={cfg.questionsCount}
              onChange={v => set('questionsCount', v)} size="small" style={{ width: 60 }} />
          </Col>
          <Col>
            <Text type="secondary" style={{ fontSize: 12 }}>Тип:</Text>
          </Col>
          <Col>
            <Select size="small" value={cfg.taskType} onChange={v => set('taskType', v)}
              style={{ width: 110 }}
              options={[
                { value: 'sum',     label: 'Суммы' },
                { value: 'product', label: 'Произведения' },
                { value: 'mixed',   label: 'Смешанные' },
              ]}
            />
          </Col>
          <Col>
            <Text type="secondary" style={{ fontSize: 12 }}>Термов:</Text>
          </Col>
          <Col>
            <InputNumber min={2} max={4} value={cfg.termsCount}
              onChange={v => set('termsCount', v)} size="small" style={{ width: 55 }} />
          </Col>
        </Row>
        <Row gutter={8} align="middle">
          <Col><Text type="secondary" style={{ fontSize: 12 }}>Функции:</Text></Col>
          <Col>
            <Checkbox.Group
              options={[
                { label: 'sin', value: 'sin' },
                { label: 'cos', value: 'cos' },
                { label: 'tg',  value: 'tan' },
                { label: 'ctg', value: 'cot' },
              ]}
              value={[cfg.useSin && 'sin', cfg.useCos && 'cos', cfg.useTan && 'tan', cfg.useCot && 'cot'].filter(Boolean)}
              onChange={vals => onChange({
                ...cfg,
                useSin: vals.includes('sin'),
                useCos: vals.includes('cos'),
                useTan: vals.includes('tan'),
                useCot: vals.includes('cot'),
              })}
            />
          </Col>
        </Row>
      </Space>
    );
  }

  if (id === 'inverseTrig') {
    return (
      <Space direction="vertical" size={4} style={{ width: '100%' }}>
        <Row align="middle" gutter={8}>
          <Col><Text type="secondary" style={{ fontSize: 12 }}>Заданий:</Text></Col>
          <Col>
            <InputNumber min={2} max={12} value={cfg.questionsCount}
              onChange={v => set('questionsCount', v)} size="small" style={{ width: 60 }} />
          </Col>
          <Col><Text type="secondary" style={{ fontSize: 12 }}>Тип:</Text></Col>
          <Col>
            <Select size="small" value={cfg.taskType} onChange={v => set('taskType', v)}
              style={{ width: 110 }}
              options={[
                { value: 'basic',  label: 'Простые' },
                { value: 'sum',    label: 'Суммы' },
                { value: 'nested', label: 'Вложенные' },
                { value: 'mixed',  label: 'Смешанные' },
              ]}
            />
          </Col>
        </Row>
        <Row gutter={8} align="middle">
          <Col><Text type="secondary" style={{ fontSize: 12 }}>Функции:</Text></Col>
          <Col>
            <Checkbox.Group
              options={[
                { label: 'arcsin', value: 'arcsin' },
                { label: 'arccos', value: 'arccos' },
                { label: 'arctg',  value: 'arctan' },
                { label: 'arcctg', value: 'arccot' },
              ]}
              value={[
                cfg.useArcsin && 'arcsin', cfg.useArccos && 'arccos',
                cfg.useArctan && 'arctan', cfg.useArccot && 'arccot',
              ].filter(Boolean)}
              onChange={vals => onChange({
                ...cfg,
                useArcsin: vals.includes('arcsin'),
                useArccos: vals.includes('arccos'),
                useArctan: vals.includes('arctan'),
                useArccot: vals.includes('arccot'),
              })}
            />
          </Col>
        </Row>
      </Space>
    );
  }

  if (id === 'reductionFormulas') {
    const RF_TYPES = [
      { value: 'basic',    label: 'Формулы приведения',    desc: 'sin(π/2 + α) = ?' },
      { value: 'reversed', label: 'Перевёрнутый аргумент', desc: 'cos(α − π/2) = ?' },
      { value: 'numeric',  label: 'Числовые выражения',    desc: '14√3·cos750° = ?' },
    ];
    return (
      <Space direction="vertical" size={4} style={{ width: '100%' }}>
        <Row align="middle" gutter={8}>
          <Col><Text type="secondary" style={{ fontSize: 12 }}>Заданий:</Text></Col>
          <Col>
            <InputNumber min={2} max={12} value={cfg.tasksPerVariant}
              onChange={v => set('tasksPerVariant', v)} size="small" style={{ width: 60 }} />
          </Col>
          <Col><Text type="secondary" style={{ fontSize: 12 }}>Углы:</Text></Col>
          <Col>
            <Select size="small" value={cfg.angleMode} onChange={v => set('angleMode', v)}
              style={{ width: 110 }}
              options={[
                { value: 'radians', label: 'Радианы' },
                { value: 'degrees', label: 'Градусы' },
                { value: 'both',    label: 'Смешанно' },
              ]}
            />
          </Col>
        </Row>
        <Space direction="vertical" size={2}>
          {RF_TYPES.map(o => (
            <div key={o.value} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Checkbox
                checked={cfg.taskTypes.includes(o.value)}
                onChange={e => {
                  const next = e.target.checked
                    ? [...cfg.taskTypes, o.value]
                    : cfg.taskTypes.filter(t => t !== o.value);
                  if (next.length) set('taskTypes', next);
                }}
              >
                <Text style={{ fontSize: 12 }}>{o.label}</Text>
              </Checkbox>
              <Text type="secondary" style={{ fontSize: 11 }}>{o.desc}</Text>
            </div>
          ))}
        </Space>
      </Space>
    );
  }

  if (id === 'additionFormulas') {
    return (
      <Space direction="vertical" size={4} style={{ width: '100%' }}>
        <Row align="middle" gutter={8}>
          <Col><Text type="secondary" style={{ fontSize: 12 }}>Заданий:</Text></Col>
          <Col>
            <InputNumber min={2} max={12} value={cfg.tasksPerVariant}
              onChange={v => set('tasksPerVariant', v)} size="small" style={{ width: 60 }} />
          </Col>
        </Row>
        <Row gutter={8} align="middle">
          <Col><Text type="secondary" style={{ fontSize: 12 }}>Типы:</Text></Col>
          <Col>
            <Checkbox.Group
              options={[
                { label: 'Числовые',    value: 'formula_eval' },
                { label: 'Символьные',  value: 'symbolic' },
                { label: 'Нестандарт.', value: 'nonstandard' },
              ]}
              value={cfg.taskTypes}
              onChange={vals => set('taskTypes', vals)}
            />
          </Col>
        </Row>
        <Row gutter={8} align="middle">
          <Col><Text type="secondary" style={{ fontSize: 12 }}>Функции:</Text></Col>
          <Col>
            <Checkbox.Group
              options={[
                { label: 'sin', value: 'sin' },
                { label: 'cos', value: 'cos' },
                { label: 'tg',  value: 'tan' },
              ]}
              value={cfg.funcs}
              onChange={vals => set('funcs', vals)}
            />
          </Col>
        </Row>
      </Space>
    );
  }

  if (id === 'trigEquations') {
    return (
      <Space direction="vertical" size={4} style={{ width: '100%' }}>
        <Row align="middle" gutter={8}>
          <Col><Text type="secondary" style={{ fontSize: 12 }}>Заданий:</Text></Col>
          <Col>
            <InputNumber min={2} max={12} value={cfg.questionsCount}
              onChange={v => set('questionsCount', v)} size="small" style={{ width: 60 }} />
          </Col>
          <Col><Text type="secondary" style={{ fontSize: 12 }}>Функции:</Text></Col>
          <Col>
            <Checkbox.Group
              options={[
                { label: 'sin t=a', value: 'sin' },
                { label: 'cos t=a', value: 'cos' },
                { label: 'tg t=a',  value: 'tan' },
                { label: 'ctg t=a', value: 'cot' },
              ]}
              value={[cfg.useSin && 'sin', cfg.useCos && 'cos', cfg.useTan && 'tan', cfg.useCot && 'cot'].filter(Boolean)}
              onChange={vals => onChange({
                ...cfg,
                useSin: vals.includes('sin'),
                useCos: vals.includes('cos'),
                useTan: vals.includes('tan'),
                useCot: vals.includes('cot'),
              })}
            />
          </Col>
        </Row>
      </Space>
    );
  }

  if (id === 'doubleAngle') {
    return (
      <Space direction="vertical" size={4} style={{ width: '100%' }}>
        <Row align="middle" gutter={8}>
          <Col><Text type="secondary" style={{ fontSize: 12 }}>Заданий:</Text></Col>
          <Col>
            <InputNumber min={2} max={12} value={cfg.tasksPerVariant}
              onChange={v => set('tasksPerVariant', v)} size="small" style={{ width: 60 }} />
          </Col>
        </Row>
        <Row gutter={8} align="middle">
          <Col><Text type="secondary" style={{ fontSize: 12 }}>Типы:</Text></Col>
          <Col>
            <Checkbox.Group
              options={[
                { label: 'Числовые',   value: 'numeric' },
                { label: 'Символьные', value: 'symbolic' },
                { label: 'Распознавание', value: 'mixed' },
              ]}
              value={cfg.taskTypes}
              onChange={vals => set('taskTypes', vals)}
            />
          </Col>
        </Row>
        <Row gutter={8} align="middle">
          <Col><Text type="secondary" style={{ fontSize: 12 }}>Функции:</Text></Col>
          <Col>
            <Checkbox.Group
              options={[
                { label: 'sin', value: 'sin' },
                { label: 'cos', value: 'cos' },
                { label: 'tg',  value: 'tan' },
              ]}
              value={cfg.funcs}
              onChange={vals => set('funcs', vals)}
            />
          </Col>
        </Row>
      </Space>
    );
  }

  if (id === 'trigEquationsAdvanced') {
    return (
      <Space direction="vertical" size={4} style={{ width: '100%' }}>
        <Row align="middle" gutter={8}>
          <Col><Text type="secondary" style={{ fontSize: 12 }}>Заданий:</Text></Col>
          <Col>
            <InputNumber min={2} max={12} value={cfg.questionsCount}
              onChange={v => set('questionsCount', v)} size="small" style={{ width: 60 }} />
          </Col>
        </Row>
        <Row gutter={8} align="middle">
          <Col><Text type="secondary" style={{ fontSize: 12 }}>Типы:</Text></Col>
          <Col>
            <Checkbox.Group
              options={[
                { label: 'f(kx) = a',          value: 'type1' },
                { label: 'A·f(kx+b) = c',       value: 'type2' },
              ]}
              value={[cfg.useType1 && 'type1', cfg.useType2 && 'type2'].filter(Boolean)}
              onChange={vals => onChange({ ...cfg, useType1: vals.includes('type1'), useType2: vals.includes('type2') })}
            />
          </Col>
        </Row>
      </Space>
    );
  }

  if (id === 'unitCircle') {
    return (
      <Space direction="vertical" size={4} style={{ width: '100%' }}>
        <Row align="middle" gutter={8}>
          <Col><Text type="secondary" style={{ fontSize: 12 }}>Окружностей:</Text></Col>
          <Col>
            <Select size="small" value={cfg.circlesPerPage} onChange={v => set('circlesPerPage', v)}
              style={{ width: 55 }}
              options={[{ value: 1, label: '1' }, { value: 2, label: '2' }, { value: 4, label: '4' }]}
            />
          </Col>
          <Col><Text type="secondary" style={{ fontSize: 12 }}>Точек:</Text></Col>
          <Col>
            <InputNumber min={4} max={12} value={cfg.pointsPerCircle}
              onChange={v => set('pointsPerCircle', v)} size="small" style={{ width: 55 }} />
          </Col>
          <Col><Text type="secondary" style={{ fontSize: 12 }}>Тип:</Text></Col>
          <Col>
            <Select size="small" value={cfg.taskType} onChange={v => set('taskType', v)}
              style={{ width: 110 }}
              options={[
                { value: 'direct',  label: 'Прямая' },
                { value: 'inverse', label: 'Обратная' },
                { value: 'mixed',   label: 'Смешанная' },
              ]}
            />
          </Col>
        </Row>
        <Row align="middle" gutter={8}>
          <Col><Text type="secondary" style={{ fontSize: 12 }}>Оси:</Text></Col>
          <Col>
            <Select size="small" value={cfg.showAxes} onChange={v => set('showAxes', v)}
              style={{ width: 100 }}
              options={[
                { value: 'none', label: 'Нет' },
                { value: 'axes', label: 'Оси' },
                { value: 'all',  label: 'Все' },
              ]}
            />
          </Col>
          <Col>
            <Checkbox checked={cfg.showTicks} onChange={e => set('showTicks', e.target.checked)}>
              <Text style={{ fontSize: 12 }}>Засечки</Text>
            </Checkbox>
          </Col>
          <Col>
            <Checkbox checked={cfg.showDegrees} onChange={e => set('showDegrees', e.target.checked)}>
              <Text style={{ fontSize: 12 }}>Градусы</Text>
            </Checkbox>
          </Col>
        </Row>
      </Space>
    );
  }

  return null;
}

// ─── Основной компонент ───────────────────────────────────────────────────────
export default function TrigMixedGenerator() {
  const [workTitle,        setWorkTitle]        = useState('Проверочная работа по тригонометрии');
  const [variantsCount,    setVariantsCount]    = useState(4);
  const [showSectionHeaders, setShowSectionHeaders] = useState(false);
  const [showWorkSpace,    setShowWorkSpace]    = useState(false);
  const [workSpaceSize,    setWorkSpaceSize]    = useState(25);
  const [showTeacherKey,   setShowTeacherKey]   = useState(true);
  const [twoPerPage,       setTwoPerPage]       = useState(false);
  const [genConfigs,       setGenConfigs]       = useState(INITIAL_GEN_CONFIGS);
  const [genOrder,         setGenOrder]         = useState(() => GENERATOR_REGISTRY.map(g => g.id));
  const [dragId,           setDragId]           = useState(null);
  const [dragOverId,       setDragOverId]       = useState(null);

  // Все хуки (инстанциируются всегда)
  const trigExpr           = useTrigExpressions();
  const inverseTrig        = useInverseTrig();
  const reductionForms     = useReductionFormulas();
  const additionForms      = useAdditionFormulas();
  const trigEq             = useTrigEquations();
  const unitCircle         = useUnitCircle();
  const doubleAngle        = useDoubleAngle();
  const trigEqAdvanced     = useTrigEquationsAdvanced();

  // Соответствие id → хук
  const hookMap = {
    trigExpressions:      trigExpr,
    inverseTrig:          inverseTrig,
    reductionFormulas:    reductionForms,
    additionFormulas:     additionForms,
    trigEquations:        trigEq,
    unitCircle:           unitCircle,
    doubleAngle:          doubleAngle,
    trigEquationsAdvanced: trigEqAdvanced,
  };

  const updateGenConfig = useCallback((id, updates) => {
    setGenConfigs(prev => ({ ...prev, [id]: { ...prev[id], ...updates } }));
  }, []);

  // ─── Генерация ─────────────────────────────────────────────────────────────
  const handleGenerate = useCallback(() => {
    for (const g of GENERATOR_REGISTRY) {
      const cfg = genConfigs[g.id];
      if (!cfg.enabled) continue;
      hookMap[g.id].generate({ variantsCount, ...cfg });
    }
  }, [genConfigs, variantsCount]);

  const handleReset = useCallback(() => {
    for (const g of GENERATOR_REGISTRY) {
      hookMap[g.id].reset?.();
    }
  }, []);

  // ─── Drag & drop ────────────────────────────────────────────────────────────
  const handleDragStart = useCallback((e, id) => {
    setDragId(id);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e, id) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverId(id);
  }, []);

  const handleDrop = useCallback((e, targetId) => {
    e.preventDefault();
    setDragId(null);
    setDragOverId(null);
    setGenOrder(prev => {
      if (!dragId || dragId === targetId) return prev;
      const next = [...prev];
      const fromIdx = next.indexOf(dragId);
      const toIdx   = next.indexOf(targetId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      next.splice(fromIdx, 1);
      next.splice(toIdx, 0, dragId);
      return next;
    });
  }, [dragId]);

  const handleDragEnd = useCallback(() => {
    setDragId(null);
    setDragOverId(null);
  }, []);

  // ─── Сборка вариантов для печати ───────────────────────────────────────────
  const orderedRegistry = genOrder.map(id => GENERATOR_REGISTRY.find(g => g.id === id)).filter(Boolean);
  const enabledGens = orderedRegistry.filter(g => genConfigs[g.id].enabled);
  const hasData = enabledGens.some(g => hookMap[g.id].tasksData);

  const mixedVariants = [];
  if (hasData) {
    for (let i = 0; i < variantsCount; i++) {
      const sections = [];
      for (const g of enabledGens) {
        const variantData = hookMap[g.id].tasksData?.[i];
        if (!variantData) continue;
        const isUC = g.id === 'unitCircle';
        sections.push({
          id:           g.id,
          label:        g.label,
          instruction:  g.instruction,
          questionMode: g.questionMode,
          tasks:        variantData,
          ucSettings:   isUC ? genConfigs.unitCircle : undefined,
          twoColumns:   !isUC && (genConfigs[g.id].twoColumns || false),
        });
      }
      if (sections.length) {
        mixedVariants.push({ number: i + 1, sections });
      }
    }
  }

  // ─── Печать ────────────────────────────────────────────────────────────────
  const handlePrint = useCallback(() => {
    const style = document.createElement('style');
    style.id = 'tmixed-print-page-style';
    style.textContent = '@page { size: A4 portrait; margin: 0; }';
    document.head.appendChild(style);
    window.print();
    setTimeout(() => {
      const s = document.getElementById('tmixed-print-page-style');
      if (s) s.remove();
    }, 1500);
  }, []);

  const printSettings = {
    showSectionHeaders,
    showWorkSpace,
    workSpaceSize,
    showTeacherKey,
    twoPerPage,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* ─── Заголовок ───────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 12, borderBottom: '1px solid var(--rule)', marginBottom: 16 }}>
        <div style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--accent-soft)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <FunctionOutlined style={{ fontSize: 14 }} />
        </div>
        <Input
          value={workTitle}
          onChange={e => setWorkTitle(e.target.value)}
          placeholder="Название работы"
          style={{ flex: 1, fontWeight: 500 }}
        />
      </div>

      <SplitLayout leftWidth={340} gap={20} style={{ flex: 1 }}
        left={
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 10 }}>

            {/* Вариантов */}
            <div style={{ padding: '10px 12px', background: 'var(--bg-sunken)', borderRadius: 'var(--radius)', border: '1px solid var(--rule-soft)' }}>
              <ConfigLabel>Настройки</ConfigLabel>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 6 }}>
                Вариантов: <b style={{ color: 'var(--ink)', fontFamily: 'var(--font-mono)' }}>{variantsCount}</b>
              </div>
              <Slider
                min={1} max={30} value={variantsCount}
                onChange={setVariantsCount}
                marks={{ 1: '1', 2: '2', 4: '4', 8: '8', 12: '12', 20: '20', 30: '30' }}
                size="small"
              />
            </div>

            {/* Разделы label */}
            <div style={{ fontSize: 10.5, color: 'var(--ink-4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              Разделы · перетащите для сортировки
            </div>

            {/* Scrollable section blocks */}
            <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 8, margin: '0 -4px', padding: '0 4px 4px' }}>
              {orderedRegistry.map(g => {
                const cfg = genConfigs[g.id];
                const isDragging   = dragId === g.id;
                const isDropTarget = dragOverId === g.id && dragId !== g.id;
                return (
                  <div
                    key={g.id}
                    draggable
                    onDragStart={e => handleDragStart(e, g.id)}
                    onDragOver={e => handleDragOver(e, g.id)}
                    onDrop={e => handleDrop(e, g.id)}
                    onDragEnd={handleDragEnd}
                    style={{
                      padding: '8px 12px',
                      border: `1px solid ${isDropTarget ? 'var(--accent)' : cfg.enabled ? 'var(--accent)' : 'var(--rule)'}`,
                      borderRadius: 'var(--radius)',
                      background: cfg.enabled ? 'var(--accent-soft)' : 'var(--bg-raised)',
                      opacity: isDragging ? 0.5 : 1,
                      transition: 'opacity .15s, border-color .15s, background .15s',
                      cursor: 'default',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <HolderOutlined style={{ color: 'var(--ink-4)', cursor: 'grab', fontSize: 13, flexShrink: 0 }} />
                      <Switch
                        size="small"
                        checked={cfg.enabled}
                        onChange={v => updateGenConfig(g.id, { enabled: v })}
                      />
                      <span style={{ fontSize: 12, fontWeight: cfg.enabled ? 600 : 400, color: 'var(--ink)', lineHeight: 1.3 }}>
                        {g.label}
                      </span>
                    </div>
                    {cfg.enabled && (
                      <div style={{ marginTop: 8, paddingLeft: 32 }}>
                        <GenSettings
                          id={g.id}
                          cfg={cfg}
                          onChange={newCfg => setGenConfigs(prev => ({ ...prev, [g.id]: newCfg }))}
                        />
                        {g.id !== 'unitCircle' && (
                          <div style={{ marginTop: 4 }}>
                            <Checkbox
                              checked={cfg.twoColumns || false}
                              onChange={e => updateGenConfig(g.id, { twoColumns: e.target.checked })}
                              style={{ fontSize: 12 }}
                          >
                            2 колонки
                          </Checkbox>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            </div>

            {/* Параметры печати */}
            <div style={{ padding: '10px 12px', background: 'var(--bg-sunken)', border: '1px solid var(--rule-soft)', borderRadius: 'var(--radius)', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <ConfigLabel>Параметры печати</ConfigLabel>
              {[
                ['Заголовки разделов', showSectionHeaders, setShowSectionHeaders],
                ['2 варианта на стр.', twoPerPage, setTwoPerPage],
                ['Лист ответов', showTeacherKey, setShowTeacherKey],
                ['Место для решения', showWorkSpace, setShowWorkSpace],
              ].map(([label, val, setter]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{label}</span>
                  <Switch size="small" checked={val} onChange={setter} />
                </div>
              ))}
              {showWorkSpace && (
                <div style={{ marginTop: 4 }}>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 4 }}>
                    Высота: <b style={{ color: 'var(--ink)', fontFamily: 'var(--font-mono)' }}>{workSpaceSize} мм</b>
                  </div>
                  <Slider
                    min={10} max={80} value={workSpaceSize}
                    onChange={setWorkSpaceSize}
                    marks={{ 10: '10', 30: '30', 50: '50', 80: '80' }}
                    size="small"
                  />
                </div>
              )}
            </div>

            {/* Кнопки */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Button
                type="primary" block
                icon={<ThunderboltOutlined />}
                onClick={handleGenerate}
                disabled={!enabledGens.length}
              >
                Сформировать
              </Button>
              {hasData && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <Button block icon={<PrinterOutlined />} onClick={handlePrint} style={{ flex: 1 }}>
                    Печать
                  </Button>
                  <Button block onClick={handleReset} style={{ flex: 1 }}>
                    Сбросить
                  </Button>
                </div>
              )}
            </div>
          </div>
        }
        right={
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
          {!hasData ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--ink-3)' }}>
              <FunctionOutlined style={{ fontSize: 32, marginBottom: 12, color: 'var(--ink-4)' }} />
              <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--ink-3)' }}>
                Настройте разделы и нажмите «Сформировать»
              </div>
              <div style={{ fontSize: 12, marginTop: 8, color: 'var(--ink-4)' }}>
                Включено: {enabledGens.map(g => g.label).join(', ') || 'нет'}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
              {/* Preview header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0, letterSpacing: '-0.025em', color: 'var(--ink)' }}>
                    Предпросмотр
                  </h2>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--ink-3)', padding: '2px 8px', background: 'var(--bg-sunken)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--rule)' }}>
                    {variantsCount} вар.
                  </span>
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: 'var(--lvl-1)', padding: '2px 8px', background: 'var(--c-teal-soft)', borderRadius: 'var(--radius-sm)' }}>
                  {mixedVariants[0]?.sections.reduce((n, s) => n + s.tasks.length, 0)} задач
                </span>
              </div>
            <Tabs
              size="small"
              style={{ flex: 1, minHeight: 0 }}
              items={mixedVariants.map((variant, vi) => ({
                key: String(vi),
                label: `Вариант ${variant.number}`,
                children: (
                  <div style={{ overflow: 'auto' }}>
                    {/* NOTE: Card replaced — start removed */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                    {variant.sections.map((sec, si) => {
                      let startIdx = 1;
                      for (let k = 0; k < si; k++) startIdx += variant.sections[k].tasks.length;
                      return (
                        <div key={sec.id}>
                          <div style={{
                            fontSize: 11, fontWeight: 600, color: 'var(--ink-3)',
                            textTransform: 'uppercase', letterSpacing: '0.09em',
                            paddingBottom: 6, borderBottom: '1px solid var(--rule)',
                            marginBottom: 8,
                          }}>
                            {sec.label}
                          </div>
                          {sec.questionMode === 'unitcircle' ? (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, padding: '4px 0' }}>
                              {sec.tasks.map((task, ti) => (
                                <div key={ti} style={{ textAlign: 'center' }}>
                                  <div style={{ fontSize: 11, color: 'var(--ink-4)', marginBottom: 4, fontFamily: 'var(--font-mono)' }}>
                                    {startIdx + ti})
                                  </div>
                                  <div style={{ width: 100, height: 100 }}>
                                    <UnitCircleSVG
                                      points={task.points}
                                      taskType={task.type}
                                      isAnswer={false}
                                      showAxes={sec.ucSettings?.showAxes ?? 'axes'}
                                      showDegrees={sec.ucSettings?.showDegrees ?? false}
                                      showTicks={sec.ucSettings?.showTicks ?? true}
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div style={{ border: '1px solid var(--rule-soft)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                              {sec.tasks.map((q, qi) => (
                                <div key={qi} style={{
                                  display: 'flex', alignItems: 'baseline', gap: 6,
                                  padding: '5px 12px',
                                  borderBottom: qi < sec.tasks.length - 1 ? '1px dotted var(--rule-soft)' : 'none',
                                  fontSize: 13,
                                }}>
                                  <span style={{ fontWeight: 600, minWidth: 20, color: 'var(--ink-3)', flexShrink: 0, fontFamily: 'var(--font-mono)' }}>
                                    {startIdx + qi})
                                  </span>
                                  <span style={{ flex: 1 }}>
                                    <MathInline latex={q.exprLatex} />
                                  </span>
                                  <span style={{ color: 'var(--rule)', padding: '0 4px', flexShrink: 0 }}>
                                    {sec.questionMode === 'twoLine' ? 't =' : '='}
                                  </span>
                                  <span style={{ color: 'var(--accent)', fontStyle: 'italic', fontWeight: 500, flexShrink: 0 }}>
                                    <MathInline latex={q.resultLatex} />
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    </div>
                  </div>
                ),
              }))}
            />
            </div>
          )}
          </div>
        }
      />

      {/* ─── Блок печати (скрыт на экране) ───────────────────────────── */}
      <TrigMixedPrintLayout
        variants={mixedVariants}
        title={workTitle}
        settings={printSettings}
      />
    </div>
  );
}

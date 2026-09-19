import { useState, useEffect, useMemo } from 'react';
import { printPaged } from '../utils/printPage';
import {
  Alert, Button, Input, InputNumber, Space, Tooltip, Select, Segmented, Switch,
  Modal, List, Popconfirm, message,
} from 'antd';
const { TextArea } = Input;
import {
  PlusOutlined, DeleteOutlined, PrinterOutlined, FunctionOutlined,
  ArrowUpOutlined, ArrowDownOutlined, SaveOutlined, FolderOpenOutlined,
  CopyOutlined,
} from '@ant-design/icons';
import katex from 'katex';
import { api } from '../services/pocketbase';
import FormulaSheetPrint from './trig/FormulaSheetPrint';
import {
  COPY_COUNTS, applyCopies, copyFormatLabel, countFormulas, flattenSections,
  normalizeFormulaSheetSettings, readFormulaSheetSettings, writeFormulaSheetSettings,
} from '../utils/formulaSheet';
import {
  TrigGeneratorLayout,
  TrigSettingsSection,
  TrigActions,
} from './trig/TrigGeneratorLayout';

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function MathInline({ latex }) {
  if (!latex) return <span style={{ color: '#bbb', fontStyle: 'italic' }}>…</span>;
  let html;
  try {
    html = katex.renderToString(latex, { throwOnError: false, displayMode: false, trust: true });
  } catch {
    html = latex;
  }
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

const SUBJECT_OPTIONS = [
  { value: 'Тригонометрия', label: 'Тригонометрия' },
  { value: 'Алгебра', label: 'Алгебра' },
  { value: 'Геометрия', label: 'Геометрия' },
  { value: 'Математический анализ', label: 'Мат. анализ' },
];

const PRINT_MODE_OPTIONS = [
  { value: 'both',   label: 'Оба листа' },
  { value: 'etalon', label: 'Эталон' },
  { value: 'blank',  label: 'Проверка' },
];

const COPIES_OPTIONS = COPY_COUNTS.map(n => ({ value: n, label: String(n) }));
const COLUMN_OPTIONS = [{ value: 1, label: '1' }, { value: 2, label: '2' }];
const FONT_OPTIONS = [{ value: 'sans', label: 'Гротеск' }, { value: 'serif', label: 'Антиква' }];
const TEXT_OPTIONS = [8, 8.5, 9, 10, 11, 12].map(pt => ({ value: pt, label: String(pt) }));

/** Строка панели настроек листа: подпись с подсказкой + контрол. */
function SettingRow({ label, hint, children }) {
  const text = <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{label}</span>;
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      {hint ? <Tooltip title={hint}>{text}</Tooltip> : text}
      {children}
    </div>
  );
}

// ─── Редактор одной формулы ───────────────────────────────────────────────────
function FormulaEditor({ formula, onChange, onDelete, onMoveUp, onMoveDown, isFirst, isLast }) {
  return (
    <div style={{
      padding: '8px 0',
      borderBottom: '1px solid var(--rule-soft)',
    }}>
      {/* Строка 1: KaTeX-превью + кнопки справа */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <div style={{
          flex: 1,
          fontFamily: 'Times New Roman, serif',
          fontSize: 15,
          fontStyle: 'italic',
          padding: '5px 10px',
          background: 'var(--bg-sunken)',
          borderRadius: 6,
          minHeight: 32,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
        }}>
          <MathInline latex={formula.left} />
          <span style={{ fontStyle: 'normal', color: '#aaa', fontSize: 17 }}>=</span>
          <span style={{
            border: '1.5px solid #bbb',
            borderRadius: 3,
            padding: '1px 7px',
            background: '#fff',
            color: '#222',
          }}>
            <MathInline latex={formula.right} />
          </span>
        </div>

        {/* Кнопки — выровнены по правому краю превью */}
        <Space size={3} style={{ flexShrink: 0 }}>
          <Tooltip title="Вверх" placement="top">
            <Button size="small" icon={<ArrowUpOutlined />} disabled={isFirst} onClick={onMoveUp} />
          </Tooltip>
          <Tooltip title="Вниз" placement="top">
            <Button size="small" icon={<ArrowDownOutlined />} disabled={isLast} onClick={onMoveDown} />
          </Tooltip>
          <Tooltip title="Дублировать" placement="top">
            <Button
              size="small" icon={<CopyOutlined />}
              onClick={() => onChange({ ...formula, id: uid() }, 'duplicate')}
            />
          </Tooltip>
          <Popconfirm title="Удалить формулу?" onConfirm={onDelete} okText="Да" cancelText="Нет">
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      </div>

      {/* Строка 2: поля ввода */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 10, color: 'var(--ink-3)', lineHeight: 1 }}>Левая часть</span>
          <TextArea
            autoSize={{ minRows: 1, maxRows: 5 }}
            placeholder="sin^2 x + cos^2 x"
            value={formula.left}
            onChange={e => onChange({ ...formula, left: e.target.value })}
            style={{ fontFamily: 'monospace', fontSize: 13, resize: 'none' }}
          />
        </div>

        <span style={{ paddingTop: 20, color: '#ccc', fontSize: 18, flexShrink: 0 }}>=</span>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 10, color: 'var(--ink-3)', lineHeight: 1 }}>Правая часть (ответ)</span>
          <TextArea
            autoSize={{ minRows: 1, maxRows: 5 }}
            placeholder="1"
            value={formula.right}
            onChange={e => onChange({ ...formula, right: e.target.value })}
            style={{ fontFamily: 'monospace', fontSize: 13, resize: 'none' }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Редактор секции ──────────────────────────────────────────────────────────
function SectionEditor({ section, onChange, onDelete, onMoveUp, onMoveDown, isFirst, isLast }) {
  const updateFormula = (idx, updated, action) => {
    const formulas = [...section.formulas];
    if (action === 'duplicate') formulas.splice(idx + 1, 0, updated);
    else formulas[idx] = updated;
    onChange({ ...section, formulas });
  };

  const deleteFormula = (idx) =>
    onChange({ ...section, formulas: section.formulas.filter((_, i) => i !== idx) });

  const moveFormula = (idx, dir) => {
    const formulas = [...section.formulas];
    const t = idx + dir;
    if (t < 0 || t >= formulas.length) return;
    [formulas[idx], formulas[t]] = [formulas[t], formulas[idx]];
    onChange({ ...section, formulas });
  };

  return (
    <div style={{ border: '1px solid var(--rule)', borderRadius: 8, overflow: 'hidden', marginBottom: 10 }}>
      {/* Заголовок */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 10px', background: 'var(--bg-sunken)',
        borderBottom: '1px solid var(--rule)',
      }}>
        <Input
          value={section.title}
          onChange={e => onChange({ ...section, title: e.target.value })}
          placeholder="Название секции (необязательно)"
          style={{ flex: 1, fontWeight: 600, fontSize: 13 }}
          size="small"
        />
        <Space size={2}>
          <Tooltip title="Секцию вверх">
            <Button size="small" icon={<ArrowUpOutlined />} disabled={isFirst} onClick={onMoveUp} />
          </Tooltip>
          <Tooltip title="Секцию вниз">
            <Button size="small" icon={<ArrowDownOutlined />} disabled={isLast} onClick={onMoveDown} />
          </Tooltip>
          <Popconfirm title="Удалить секцию со всеми формулами?" onConfirm={onDelete} okText="Да" cancelText="Нет">
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      </div>

      {/* Формулы */}
      <div style={{ padding: '4px 10px 6px' }}>
        {section.formulas.map((f, fi) => (
          <FormulaEditor
            key={f.id}
            formula={f}
            onChange={(updated, action) => updateFormula(fi, updated, action)}
            onDelete={() => deleteFormula(fi)}
            onMoveUp={() => moveFormula(fi, -1)}
            onMoveDown={() => moveFormula(fi, 1)}
            isFirst={fi === 0}
            isLast={fi === section.formulas.length - 1}
          />
        ))}
        <Button
          type="dashed" size="small" icon={<PlusOutlined />}
          onClick={() => onChange({ ...section, formulas: [...section.formulas, { id: uid(), left: '', right: '' }] })}
          style={{ marginTop: 6, width: '100%' }}
        >
          Добавить формулу
        </Button>
      </div>
    </div>
  );
}

// ─── Модал загрузки ───────────────────────────────────────────────────────────
function LoadModal({ open, onClose, onLoad }) {
  const [sheets, setSheets] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    api.getFormulaSheets().then(data => {
      if (!cancelled) setSheets(data);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [open]);

  return (
    <Modal title="Загрузить лист формул" open={open} onCancel={onClose} footer={null} width={520}>
      <List
        loading={loading}
        dataSource={sheets}
        locale={{ emptyText: 'Нет сохранённых листов' }}
        renderItem={item => (
          <List.Item
            actions={[
              <Button size="small" type="primary" onClick={() => { onLoad(item); onClose(); }}>
                Загрузить
              </Button>,
              <Popconfirm
                title="Удалить этот лист?"
                onConfirm={async () => {
                  await api.deleteFormulaSheet(item.id);
                  setSheets(prev => prev.filter(s => s.id !== item.id));
                }}
                okText="Да" cancelText="Нет"
              >
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>,
            ]}
          >
            <List.Item.Meta
              title={item.title}
              description={[
                item.subtitle, item.subject,
                item.class_number ? `${item.class_number} кл.` : '',
              ].filter(Boolean).join(' · ')}
            />
          </List.Item>
        )}
      />
    </Modal>
  );
}

// ─── Главный компонент ────────────────────────────────────────────────────────
export default function FormulaSheetGenerator() {
  const [title, setTitle] = useState('ТДФ по формулам тригонометрии');
  const [subtitle, setSubtitle] = useState('10 класс — база');
  const [subject, setSubject] = useState('Тригонометрия');
  const [classNumber, setClassNumber] = useState(10);
  const [sections, setSections] = useState([
    {
      id: uid(),
      title: 'Основные формулы',
      formulas: [
        { id: uid(), left: '\\sin^2 x + \\cos^2 x', right: '1' },
        { id: uid(), left: '1 - \\sin^2 x', right: '\\cos^2 x' },
        { id: uid(), left: '1 + \\tg^2 x', right: '\\dfrac{1}{\\cos^2 x}' },
        { id: uid(), left: '\\sin 2x', right: '2\\sin x \\cos x' },
        { id: uid(), left: '\\cos 2x', right: '\\cos^2 x - \\sin^2 x' },
      ],
    },
  ]);
  const [settings, setSettings] = useState(() => readFormulaSheetSettings());
  const [fit, setFit] = useState({ overflow: 0, fill: 0 });
  const [savedId, setSavedId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loadModalOpen, setLoadModalOpen] = useState(false);

  const patch = (p) => setSettings(prev => {
    const next = normalizeFormulaSheetSettings({ ...prev, ...p });
    writeFormulaSheetSettings(next);
    return next;
  });

  const setCopies = (copies) => setSettings(prev => {
    const next = applyCopies(prev, copies);
    writeFormulaSheetSettings(next);
    return next;
  });

  const updateSection = (idx, updated) =>
    setSections(prev => prev.map((s, i) => i === idx ? updated : s));
  const deleteSection = (idx) =>
    setSections(prev => prev.filter((_, i) => i !== idx));
  const moveSection = (idx, dir) =>
    setSections(prev => {
      const arr = [...prev];
      const t = idx + dir;
      if (t < 0 || t >= arr.length) return arr;
      [arr[idx], arr[t]] = [arr[t], arr[idx]];
      return arr;
    });
  const addSection = () =>
    setSections(prev => [...prev, { id: uid(), title: '', formulas: [{ id: uid(), left: '', right: '' }] }]);

  const handleSave = async () => {
    if (!title.trim()) { message.warning('Укажите название листа'); return; }
    setSaving(true);
    try {
      const payload = { title, subtitle, subject, class_number: classNumber || null, sections: JSON.stringify(sections) };
      if (savedId) {
        await api.updateFormulaSheet(savedId, payload);
      } else {
        const result = await api.createFormulaSheet(payload);
        setSavedId(result.id);
      }
      message.success('Сохранено');
    } catch { message.error('Ошибка сохранения'); }
    finally { setSaving(false); }
  };

  const handleLoad = (item) => {
    setTitle(item.title || '');
    setSubtitle(item.subtitle || '');
    setSubject(item.subject || '');
    setClassNumber(item.class_number || null);
    const sec = typeof item.sections === 'string' ? JSON.parse(item.sections) : item.sections;
    setSections(sec || []);
    setSavedId(item.id);
  };

  // 🚨 Формат задаём явно: без `size` лист печатается в формат принтера
  // (в офлайн-проверке вместо A4 выходил Letter). Поля рисует сам лист.
  const handlePrint = () => printPaged({ size: 'A4 portrait', margin: '0' });

  const flatItems = useMemo(() => flattenSections(sections), [sections]);
  const totalFormulas = countFormulas(flatItems);
  const hasContent = totalFormulas > 0;

  return (
    <>
      <TrigGeneratorLayout
        icon={<FunctionOutlined style={{ fontSize: 14 }} />}
        title={title}
        onTitleChange={setTitle}
        titlePlaceholder="Название листа"
        leftWidth="380px"
        left={
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 10, overflowY: 'auto' }}>

            <TrigSettingsSection label="Параметры">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 3 }}>Подзаголовок</div>
                  <Input
                    size="small" value={subtitle}
                    onChange={e => setSubtitle(e.target.value)}
                    placeholder="10 класс — база"
                  />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 3 }}>Предмет</div>
                    <Select
                      size="small" style={{ width: '100%' }}
                      value={subject} onChange={setSubject}
                      options={SUBJECT_OPTIONS} allowClear placeholder="Предмет"
                    />
                  </div>
                  <div style={{ width: 70 }}>
                    <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 3 }}>Класс</div>
                    <InputNumber
                      size="small" style={{ width: '100%' }}
                      min={1} max={12} value={classNumber}
                      onChange={setClassNumber} placeholder="10"
                    />
                  </div>
                </div>
              </div>
            </TrigSettingsSection>

            <TrigSettingsSection label="Лист">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <SettingRow label="Что печатать:">
                  <Segmented size="small" value={settings.printMode} onChange={v => patch({ printMode: v })} options={PRINT_MODE_OPTIONS} />
                </SettingRow>
                <SettingRow
                  label="Копий на лист:"
                  hint={`Лист A4 делится на равные копии, между ними — полоса для реза. Копия: ${copyFormatLabel(settings.copies)}`}
                >
                  <Segmented size="small" value={settings.copies} onChange={setCopies} options={COPIES_OPTIONS} />
                </SettingRow>
                <SettingRow label="Колонок в копии:" hint="Две колонки вмещают вдвое больше формул, но формула должна быть короткой.">
                  <Segmented size="small" value={settings.columns} onChange={v => patch({ columns: v })} options={COLUMN_OPTIONS} />
                </SettingRow>
                <SettingRow label="Кегль, pt:" hint="Размер формул. На плотных листах ставьте мельче.">
                  <Segmented size="small" value={settings.textSize} onChange={v => patch({ textSize: v })} options={TEXT_OPTIONS} />
                </SettingRow>
                <SettingRow label="Шрифт:" hint="Антиква ближе к формулам KaTeX, гротеск — к остальным листам платформы.">
                  <Segmented size="small" value={settings.font} onChange={v => patch({ font: v })} options={FONT_OPTIONS} />
                </SettingRow>

                <SettingRow label="Нумерация формул:">
                  <Switch size="small" checked={settings.showNumbers} onChange={v => patch({ showNumbers: v })} />
                </SettingRow>
                <SettingRow label="Поля ученика:" hint="Фамилия и класс в шапке листа проверки.">
                  <Switch size="small" checked={settings.showFields} onChange={v => patch({ showFields: v })} />
                </SettingRow>
                <SettingRow label="Ответ в рамке:" hint="Эталон: ответ обведён рамкой — глаз находит его мгновенно.">
                  <Switch size="small" checked={settings.boxedAnswer} onChange={v => patch({ boxedAnswer: v })} />
                </SettingRow>
                <SettingRow label="Линия отреза:">
                  <Switch size="small" checked={settings.showCutLine} onChange={v => patch({ showCutLine: v })} />
                </SettingRow>
                <SettingRow label="Растянуть до низа:" hint="Свободное место копии делится между строками — лист не обрывается на середине.">
                  <Switch size="small" checked={settings.stretch} onChange={v => patch({ stretch: v })} />
                </SettingRow>
              </div>
            </TrigSettingsSection>

            <TrigSettingsSection
              label={`Секции и формулы${totalFormulas ? ` (${totalFormulas})` : ''}`}
              style={{ flex: 1 }}
            >
              {sections.map((sec, si) => (
                <SectionEditor
                  key={sec.id}
                  section={sec}
                  onChange={updated => updateSection(si, updated)}
                  onDelete={() => deleteSection(si)}
                  onMoveUp={() => moveSection(si, -1)}
                  onMoveDown={() => moveSection(si, 1)}
                  isFirst={si === 0}
                  isLast={si === sections.length - 1}
                />
              ))}
              <Button type="dashed" block icon={<PlusOutlined />} onClick={addSection}>
                Добавить секцию
              </Button>
            </TrigSettingsSection>

            <TrigActions>
              {hasContent && (
                <Button type="primary" block icon={<PrinterOutlined />} onClick={handlePrint}>
                  Распечатать
                </Button>
              )}
              <div style={{ display: 'flex', gap: 6 }}>
                <Button block icon={<SaveOutlined />} onClick={handleSave} loading={saving} disabled={!hasContent}>
                  {savedId ? 'Обновить' : 'Сохранить'}
                </Button>
                <Button block icon={<FolderOpenOutlined />} onClick={() => setLoadModalOpen(true)}>
                  Загрузить
                </Button>
              </div>
            </TrigActions>
          </div>
        }
        right={
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 10, minHeight: 0 }}>
            {fit.overflow > 0 ? (
              <Alert
                type="warning"
                showIcon
                className="no-print"
                style={{ flexShrink: 0 }}
                message={`В копию не помещается формул: ${fit.overflow}`}
                description="Уменьшите кегль, поставьте две колонки или печатайте по одной копии на лист."
              />
            ) : hasContent && (
              <div className="no-print" style={{ flexShrink: 0, fontSize: 12, color: 'var(--ink-3)' }}>
                Копия заполнена на {Math.round(fit.fill * 100)}% · формат {copyFormatLabel(settings.copies)}
                {fit.fill < 0.6 && ' — на листе много места: попробуйте больше копий или крупнее кегль'}
              </div>
            )}
            <div style={{ flex: 1, overflow: 'auto', minHeight: 0, background: '#E9EAEE', padding: 16, borderRadius: 8 }}>
              {hasContent ? (
                <FormulaSheetPrint
                  title={title}
                  subtitle={subtitle}
                  sections={sections}
                  settings={settings}
                  onFit={setFit}
                />
              ) : (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>
                  Добавьте секции и формулы слева — лист появится здесь ровно таким, каким выйдет из принтера.
                </div>
              )}
            </div>
          </div>
        }
      />

      <LoadModal
        open={loadModalOpen}
        onClose={() => setLoadModalOpen(false)}
        onLoad={handleLoad}
      />
    </>
  );
}

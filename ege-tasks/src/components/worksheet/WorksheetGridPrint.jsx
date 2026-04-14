import { useState, useEffect } from 'react';
import { Button, Card, Input, Radio, Space, Switch, Tooltip } from 'antd';
import { PrinterOutlined } from '@ant-design/icons';
import MathRenderer from '../MathRenderer';
import { filterTaskText } from '../../utils/filterTaskText';
import './WorksheetGridPrint.css';

// ── SVG-клетка ─────────────────────────────────────────────────────────────

function GridArea({ cellMm, heightMm, uid }) {
  const cellPx = cellMm * 3.7795;
  const patId = `wgp-grid-${uid}`;
  return (
    <div className="wgp-grid-area" style={{ height: `${heightMm}mm` }}>
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern
            id={patId}
            x="0" y="0"
            width={cellPx} height={cellPx}
            patternUnits="userSpaceOnUse"
          >
            <path
              d={`M ${cellPx} 0 L 0 0 0 ${cellPx}`}
              fill="none" stroke="#c4cedf" strokeWidth="0.5"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${patId})`} />
      </svg>
    </div>
  );
}

// ── Одна задача ────────────────────────────────────────────────────────────

function TaskBlock({ task, number, cellMm, heightMm, fontSize, hideTaskPrefixes, pageIdx }) {
  const raw = task.statement_md || '';
  const text = hideTaskPrefixes ? filterTaskText(raw) : raw;
  const uid = `${pageIdx}-${number}`;
  return (
    <div className="wgp-task">
      <div className="wgp-task-statement" style={{ fontSize: `${fontSize}pt` }}>
        <span className="wgp-task-num">{number}.</span>
        <span className="wgp-task-text">
          <MathRenderer text={text || ' '} />
        </span>
      </div>
      <GridArea cellMm={cellMm} heightMm={heightMm} uid={uid} />
    </div>
  );
}

// ── Одна страница ──────────────────────────────────────────────────────────

function WorksheetPage({ page, pageIdx, settings, hideTaskPrefixes, showStudentInfo, titleOverride }) {
  const { gridCellMm, gridHeightMm, columns, fontSize } = settings;
  const tasks = page.tasks || [];
  const half = Math.ceil(tasks.length / 2);
  const col1 = columns === 2 ? tasks.slice(0, half) : tasks;
  const col2 = columns === 2 ? tasks.slice(half) : [];

  const renderTasks = (list, offset = 0) =>
    list.map((task, i) => (
      <TaskBlock
        key={task.id || i}
        task={task}
        number={offset + i + 1}
        cellMm={gridCellMm}
        heightMm={gridHeightMm}
        fontSize={fontSize}
        hideTaskPrefixes={hideTaskPrefixes}
        pageIdx={pageIdx}
      />
    ));

  return (
    <div className={`wgp-page${pageIdx > 0 ? ' wgp-page-break' : ''}`}>
      <div className="wgp-header">
        <div className="wgp-header-left">
          {(titleOverride || page.title) && <span className="wgp-work-title">{titleOverride || page.title}</span>}
          {page.label && <span className="wgp-variant-label">{page.label}</span>}
        </div>
        {showStudentInfo && (
          <div className="wgp-student-info">
            <span className="wgp-info-item">
              Фамилия, имя:&nbsp;<span className="wgp-info-line" />
            </span>
            <span className="wgp-info-item">
              Дата:&nbsp;<span className="wgp-info-line wgp-info-line--short" />
            </span>
          </div>
        )}
      </div>
      <div className="wgp-ruler" />
      {columns === 2 ? (
        <div className="wgp-tasks wgp-tasks-2col">
          <div className="wgp-col">{renderTasks(col1, 0)}</div>
          <div className="wgp-col">{renderTasks(col2, half)}</div>
        </div>
      ) : (
        <div className="wgp-tasks">{renderTasks(col1)}</div>
      )}
    </div>
  );
}

// ── Лист ответов учителя ───────────────────────────────────────────────────

function TeacherKeyPage({ pages, hideTaskPrefixes, titleOverride }) {
  return (
    <div className="wgp-key-page">
      <div className="wgp-key-title">Ответы (для учителя)</div>
      <div className="wgp-key-grid">
        {pages.map((page, pi) => (
          <div key={pi} className="wgp-key-variant">
            {(page.title || page.label) && (
              <div className="wgp-key-variant-label">
                {(titleOverride || page.title) && <span className="wgp-key-work-title">{titleOverride || page.title}</span>}
                {page.label && <span className="wgp-key-variant-badge">{page.label}</span>}
              </div>
            )}
            <ol className="wgp-key-list">
              {(page.tasks || []).map((task, ti) => {
                const raw = task.statement_md || '';
                const text = hideTaskPrefixes ? filterTaskText(raw) : raw;
                return (
                  <li key={task.id || ti} className="wgp-key-item">
                    <span className="wgp-key-answer">
                      {task.answer
                        ? <MathRenderer text={task.answer} />
                        : <span className="wgp-key-no-answer">—</span>}
                    </span>
                    <span className="wgp-key-stmt">
                      <MathRenderer text={text || ' '} />
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Главный компонент ───────────────────────────────────────────────────────

/**
 * Рабочий лист с клетчатым полем для решения.
 *
 * @param {Object[]} pages  — массив { title?, label?, tasks[] }
 * @param {boolean}  hideTaskPrefixes — убирать «Вычислите:» и т.п.
 */
export default function WorksheetGridPrint({ pages = [], hideTaskPrefixes = false }) {
  const [gridCellMm, setGridCellMm] = useState(5);
  const [gridHeightMm, setGridHeightMm] = useState(18);
  const [columns, setColumns] = useState(1);
  const [fontSize, setFontSize] = useState(10);
  const [showStudentInfo, setShowStudentInfo] = useState(true);
  const [showTeacherKey, setShowTeacherKey] = useState(true);
  const [title, setTitle] = useState(() => pages[0]?.title || '');

  // Синхронизируем заголовок при новой генерации (смене pages)
  useEffect(() => {
    setTitle(pages[0]?.title || '');
  }, [pages[0]?.title]); // eslint-disable-line react-hooks/exhaustive-deps

  const settings = { gridCellMm, gridHeightMm, columns, fontSize };

  const handlePrint = () => {
    const style = document.createElement('style');
    style.id = 'wgp-page-style';
    style.innerHTML = '@page { size: A4 portrait; margin: 10mm; }';
    document.head.appendChild(style);
    window.print();
    setTimeout(() => {
      const el = document.getElementById('wgp-page-style');
      if (el) el.remove();
    }, 1500);
  };

  if (!pages.length) return null;

  return (
    <>
      {/* ── Карточка настроек — видна на экране, скрыта при печати ── */}
      <Card
        className="wgp-settings-card"
        title="🔲 Рабочий лист с клеткой"
        style={{ marginTop: 8, marginBottom: 24 }}
      >
        <Space direction="vertical" size={8} style={{ marginBottom: 0 }}>
          <Space size={8} style={{ width: '100%' }}>
            <span className="wgp-setting-label" style={{ whiteSpace: 'nowrap' }}>Название:</span>
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Название листа"
              size="small"
              style={{ maxWidth: 320 }}
            />
          </Space>

          <Space wrap size={12}>
            <span className="wgp-setting-label">Клетка:</span>
            <Radio.Group
              value={gridCellMm}
              onChange={e => setGridCellMm(e.target.value)}
              buttonStyle="solid"
              size="small"
            >
              <Radio.Button value={4}>4 мм</Radio.Button>
              <Radio.Button value={5}>5 мм</Radio.Button>
              <Radio.Button value={8}>8 мм</Radio.Button>
            </Radio.Group>

            <span className="wgp-setting-label">Поле:</span>
            <Tooltip title="Высота клетчатого поля для решения">
              <Radio.Group
                value={gridHeightMm}
                onChange={e => setGridHeightMm(e.target.value)}
                buttonStyle="solid"
                size="small"
              >
                <Radio.Button value={14}>маленькое (~10–12/А4)</Radio.Button>
                <Radio.Button value={22}>среднее (~7–8/А4)</Radio.Button>
                <Radio.Button value={35}>большое (~5/А4)</Radio.Button>
              </Radio.Group>
            </Tooltip>

            <span className="wgp-setting-label">Колонки:</span>
            <Radio.Group
              value={columns}
              onChange={e => setColumns(e.target.value)}
              buttonStyle="solid"
              size="small"
            >
              <Radio.Button value={1}>1</Radio.Button>
              <Radio.Button value={2}>2</Radio.Button>
            </Radio.Group>

            <span className="wgp-setting-label">Шрифт:</span>
            <Radio.Group
              value={fontSize}
              onChange={e => setFontSize(e.target.value)}
              buttonStyle="solid"
              size="small"
            >
              <Radio.Button value={9}>9pt</Radio.Button>
              <Radio.Button value={10}>10pt</Radio.Button>
              <Radio.Button value={11}>11pt</Radio.Button>
              <Radio.Button value={12}>12pt</Radio.Button>
            </Radio.Group>

            <Space size={4}>
              <Switch
                size="small"
                checked={showStudentInfo}
                onChange={setShowStudentInfo}
              />
              <span style={{ fontSize: 13 }}>Шапка</span>
            </Space>

            <Space size={4}>
              <Switch
                size="small"
                checked={showTeacherKey}
                onChange={setShowTeacherKey}
              />
              <span style={{ fontSize: 13 }}>Ответы (учитель)</span>
            </Space>
          </Space>

          <Button
            type="primary"
            icon={<PrinterOutlined />}
            onClick={handlePrint}
          >
            Печать рабочего листа
          </Button>
        </Space>
      </Card>

      {/* ── Печатный блок — inline, скрыт на экране через CSS ── */}
      <div className="wgp-root">
        {pages.map((page, i) => (
          <WorksheetPage
            key={i}
            page={page}
            pageIdx={i}
            settings={settings}
            hideTaskPrefixes={hideTaskPrefixes}
            showStudentInfo={showStudentInfo}
            titleOverride={title}
          />
        ))}
        {showTeacherKey && (
          <TeacherKeyPage pages={pages} hideTaskPrefixes={hideTaskPrefixes} titleOverride={title} />
        )}
      </div>
    </>
  );
}

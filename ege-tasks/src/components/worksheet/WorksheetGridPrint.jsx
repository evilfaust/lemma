import { useState, useEffect } from 'react';
import { Button, Card, Col, Form, Input, Radio, Row, Select, Switch } from 'antd';
import { PrinterOutlined, TableOutlined } from '@ant-design/icons';
import MathRenderer from '../MathRenderer';
import { filterTaskText } from '../../utils/filterTaskText';
import { api } from '../../services/pocketbase';
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

function TaskBlock({ task, number, cellMm, heightMm, fontSize, hideTaskPrefixes, pageIdx, showGrid, overlayGrid }) {
  const raw = task.statement_md || '';
  const text = hideTaskPrefixes ? filterTaskText(raw) : raw;
  const uid = `${pageIdx}-${number}`;
  const imageUrl = task.has_image ? api.getTaskImageUrl(task) : null;

  const statement = (
    <div className="wgp-task-statement" style={{ fontSize: `${fontSize}pt` }}>
      {imageUrl && <img src={imageUrl} alt="" className="wgp-task-image" />}
      <span className="wgp-task-num">{number}.</span>
      <span className="wgp-task-text">
        <MathRenderer text={text || ' '} />
      </span>
    </div>
  );

  // Режим «задача поверх клетки»: сетка растянута на весь блок,
  // текст условия отображается поверх неё (z-index), ниже — чистое поле для решения
  if (showGrid && overlayGrid) {
    return (
      <div className="wgp-task wgp-task--overlay">
        {/* Сетка абсолютно позиционирована — заполняет весь контейнер */}
        <div className="wgp-overlay-grid">
          <GridArea cellMm={cellMm} heightMm={heightMm} uid={uid} />
        </div>
        {/* Текст условия поверх сетки */}
        <div className="wgp-overlay-content">
          {statement}
          {/* Распорка = высота поля для решения */}
          <div style={{ height: `${heightMm}mm` }} />
        </div>
      </div>
    );
  }

  return (
    <div className="wgp-task">
      {statement}
      {showGrid && <GridArea cellMm={cellMm} heightMm={heightMm} uid={uid} />}
    </div>
  );
}

// ── Одна страница ──────────────────────────────────────────────────────────

function WorksheetPage({ page, pageIdx, settings, hideTaskPrefixes, showStudentInfo, titleOverride, showGrid, overlayGrid }) {
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
        showGrid={showGrid}
        overlayGrid={overlayGrid}
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
  const [gridHeightMm, setGridHeightMm] = useState(22);
  const [columns, setColumns] = useState(1);
  const [fontSize, setFontSize] = useState(10);
  const [showStudentInfo, setShowStudentInfo] = useState(true);
  const [showTeacherKey, setShowTeacherKey] = useState(true);
  const [showGridPerTask, setShowGridPerTask] = useState(true);
  const [overlayGrid, setOverlayGrid] = useState(false);
  const [title, setTitle] = useState(() => pages[0]?.title || '');
  const [isPrinting, setIsPrinting] = useState(false);

  // Синхронизируем заголовок при новой генерации (смене pages)
  useEffect(() => {
    setTitle(pages[0]?.title || '');
  }, [pages[0]?.title]); // eslint-disable-line react-hooks/exhaustive-deps

  const settings = { gridCellMm, gridHeightMm, columns, fontSize };

  const handlePrint = () => {
    setIsPrinting(true);
    // Даём React время отрендерить .wgp-root перед вызовом print()
    setTimeout(() => {
      const style = document.createElement('style');
      style.id = 'wgp-page-style';
      style.innerHTML = '@page { size: A4 portrait; margin: 10mm; }';
      document.head.appendChild(style);
      window.print();
      const cleanup = () => {
        document.getElementById('wgp-page-style')?.remove();
        setIsPrinting(false);
        window.removeEventListener('afterprint', cleanup);
      };
      window.addEventListener('afterprint', cleanup);
      // Фолбэк если afterprint не сработает
      setTimeout(cleanup, 3000);
    }, 50);
  };

  if (!pages.length) return null;

  return (
    <>
      {/* ── Карточка настроек — видна на экране, скрыта при печати ── */}
      <Card
        className="wgp-settings-card"
        title={<span><TableOutlined style={{ marginRight: 8 }} />Рабочий лист с клеткой</span>}
        style={{ marginTop: 8, marginBottom: 24 }}
        extra={
          <Button type="primary" icon={<PrinterOutlined />} onClick={handlePrint}>
            Печать рабочего листа
          </Button>
        }
      >
        <Form layout="vertical" size="small">
          <Row gutter={16} align="bottom">
            <Col xs={24} sm={12} md={8} lg={6}>
              <Form.Item label="Название" style={{ marginBottom: 0 }}>
                <Input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Название листа"
                />
              </Form.Item>
            </Col>

            <Col xs={12} sm={6} md={4} lg={3}>
              <Form.Item label="Клетка" style={{ marginBottom: 0 }}>
                <Radio.Group
                  value={gridCellMm}
                  onChange={e => setGridCellMm(e.target.value)}
                  buttonStyle="solid"
                >
                  <Radio.Button value={4}>4</Radio.Button>
                  <Radio.Button value={5}>5</Radio.Button>
                  <Radio.Button value={8}>8</Radio.Button>
                </Radio.Group>
              </Form.Item>
            </Col>

            <Col xs={12} sm={8} md={5} lg={4}>
              <Form.Item label="Поле для решения" style={{ marginBottom: 0 }}>
                <Select
                  value={gridHeightMm}
                  onChange={setGridHeightMm}
                  style={{ width: '100%' }}
                  options={[
                    { value: 12, label: '12 мм  — ~13 задач/А4' },
                    { value: 16, label: '16 мм  — ~10 задач/А4' },
                    { value: 22, label: '22 мм  —  ~8 задач/А4' },
                    { value: 30, label: '30 мм  —  ~6 задач/А4' },
                    { value: 40, label: '40 мм  —  ~5 задач/А4' },
                    { value: 55, label: '55 мм  —  ~4 задачи/А4' },
                  ]}
                />
              </Form.Item>
            </Col>

            <Col xs={8} sm={4} md={3} lg={2}>
              <Form.Item label="Колонки" style={{ marginBottom: 0 }}>
                <Radio.Group
                  value={columns}
                  onChange={e => setColumns(e.target.value)}
                  buttonStyle="solid"
                >
                  <Radio.Button value={1}>1</Radio.Button>
                  <Radio.Button value={2}>2</Radio.Button>
                </Radio.Group>
              </Form.Item>
            </Col>

            <Col xs={16} sm={8} md={5} lg={4}>
              <Form.Item label="Шрифт" style={{ marginBottom: 0 }}>
                <Radio.Group
                  value={fontSize}
                  onChange={e => setFontSize(e.target.value)}
                  buttonStyle="solid"
                >
                  <Radio.Button value={9}>9</Radio.Button>
                  <Radio.Button value={10}>10</Radio.Button>
                  <Radio.Button value={11}>11</Radio.Button>
                  <Radio.Button value={12}>12</Radio.Button>
                </Radio.Group>
              </Form.Item>
            </Col>

            <Col xs={12} sm={6} md={4} lg={3}>
              <Form.Item label="Шапка" style={{ marginBottom: 0 }}>
                <Switch checked={showStudentInfo} onChange={setShowStudentInfo} />
              </Form.Item>
            </Col>

            <Col xs={12} sm={6} md={4} lg={3}>
              <Form.Item label="Клетка под задачей" style={{ marginBottom: 0 }}>
                <Switch checked={showGridPerTask} onChange={v => { setShowGridPerTask(v); if (!v) setOverlayGrid(false); }} />
              </Form.Item>
            </Col>

            <Col xs={12} sm={6} md={4} lg={3}>
              <Form.Item label="Задача поверх клетки" style={{ marginBottom: 0 }}>
                <Switch
                  checked={overlayGrid}
                  onChange={setOverlayGrid}
                  disabled={!showGridPerTask}
                />
              </Form.Item>
            </Col>

            <Col xs={12} sm={8} md={5} lg={4}>
              <Form.Item label="Ответы (учитель)" style={{ marginBottom: 0 }}>
                <Switch checked={showTeacherKey} onChange={setShowTeacherKey} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Card>

      {/* ── Печатный блок — рендерится только во время печати ── */}
      {isPrinting && (
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
              showGrid={showGridPerTask}
              overlayGrid={overlayGrid}
            />
          ))}
          {showTeacherKey && (
            <TeacherKeyPage pages={pages} hideTaskPrefixes={hideTaskPrefixes} titleOverride={title} />
          )}
        </div>
      )}
    </>
  );
}

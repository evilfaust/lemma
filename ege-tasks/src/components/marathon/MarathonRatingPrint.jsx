import { useCallback, useMemo, useState } from 'react';
import { Button, Card, Space, Typography } from 'antd';
import { ArrowLeftOutlined, PrinterOutlined } from '@ant-design/icons';
import MarathonRatingSettings from './MarathonRatingSettings';
import { printPaged } from '../../utils/printPage';
import {
  HEAD_ROW_MM, LEGEND_MM, RATING_PAD, RATING_PAGE, TITLE_MM,
  normalizeRatingSettings, planRating, ratingMaxScore, readRatingSettings,
  scoreForAttempt, writeRatingSettings,
} from '../../utils/marathonRating';
import './MarathonRatingPrint.css';

const { Text } = Typography;

const plural = (n, one, few, many) => {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
};

/* ── Клетка попыток ───────────────────────────────────────────────────────── */

function AttemptMarks({ attempts, markMm }) {
  const size = { width: `${markMm}mm`, height: `${markMm}mm` };
  return (
    <div className="mrp-marks">
      {Array.from({ length: attempts }, (_, i) => (
        <span key={i} className="mrp-mark" style={size} />
      ))}
    </div>
  );
}

/* ── Лист ─────────────────────────────────────────────────────────────────── */

function RatingSheet({ page, pageNo, pageCount, students, tasks, title, classNumber, settings }) {
  const { orientation, attempts, showScore, showIndex, showLegend, zebra } = settings;
  const size = RATING_PAGE[orientation];
  const taskNumbers = Array.from({ length: page.taskTo - page.taskFrom }, (_, i) => page.taskFrom + i + 1);
  const rows = Array.from({ length: page.rowTo - page.rowFrom }, (_, i) => page.rowFrom + i);

  const cell = (n) => (
    <div
      key={n}
      className={`mrp-cell mrp-cell--task${(n - 1) % 5 === 0 && n > 1 ? ' is-group' : ''}`}
      style={{ flex: `0 0 ${page.taskColMm}mm` }}
    >
      <AttemptMarks attempts={attempts} markMm={page.markMm} />
      {showScore && <div className="mrp-score" style={{ flex: `0 0 ${page.scoreMm}mm` }} />}
    </div>
  );

  const maxScore = ratingMaxScore(tasks.length, attempts);
  const meta = [
    classNumber ? `${classNumber} класс` : null,
    `${tasks.length} ${plural(tasks.length, 'задача', 'задачи', 'задач')}`,
    `максимум ${maxScore}`,
    pageCount > 1 ? `лист ${pageNo} из ${pageCount}` : null,
    page.taskFrom > 0 || page.taskTo < tasks.length
      ? `задачи ${page.taskFrom + 1}–${page.taskTo}`
      : null,
  ].filter(Boolean);

  return (
    <div
      className="mrp-sheet"
      style={{
        width: `${size.w}mm`,
        height: `${size.h}mm`,
        padding: `${RATING_PAD.top}mm ${RATING_PAD.x}mm ${RATING_PAD.bottom}mm`,
      }}
    >
      <div className="mrp-title" style={{ height: `${TITLE_MM}mm` }}>
        <div className="mrp-title-main">
          <span className="mrp-title-text">{title || 'Марафон'}</span>
          <span className="mrp-title-kind">рейтинговый лист</span>
        </div>
        <div className="mrp-title-meta">
          {meta.map((m, i) => <span key={i}>{m}</span>)}
          <span className="mrp-date">дата <i /></span>
        </div>
      </div>

      {showLegend && (
        <div className="mrp-legend" style={{ height: `${LEGEND_MM}mm` }}>
          <span className="mrp-legend-label">Закрасьте квадрат удачной попытки:</span>
          {Array.from({ length: attempts }, (_, i) => (
            <span key={i} className="mrp-legend-item">
              <span className={`mrp-mark${i === 0 ? ' is-filled' : ''}`} />
              <span className="mrp-legend-text">
                {i + 1}-я — {scoreForAttempt(i + 1, attempts)}&nbsp;б.
              </span>
            </span>
          ))}
          <span className="mrp-legend-item">
            <span className="mrp-mark is-crossed" />
            <span className="mrp-legend-text">не решил — 0&nbsp;б.</span>
          </span>
        </div>
      )}

      <div className="mrp-table">
        <div className="mrp-row mrp-row--head" style={{ height: `${HEAD_ROW_MM}mm` }}>
          {showIndex && (
            <div className="mrp-cell mrp-cell--index" style={{ flex: `0 0 ${page.indexMm}mm` }}>№</div>
          )}
          <div className="mrp-cell mrp-cell--name" style={{ flex: `0 0 ${page.nameMm}mm` }}>Ученик</div>
          {taskNumbers.map(n => (
            <div
              key={n}
              className={`mrp-cell mrp-cell--tasknum${(n - 1) % 5 === 0 && n > 1 ? ' is-group' : ''}`}
              style={{ flex: `0 0 ${page.taskColMm}mm` }}
            >
              {n}
            </div>
          ))}
          {page.withTotal && (
            <div className="mrp-cell mrp-cell--total" style={{ flex: `0 0 ${page.totalMm}mm` }}>Итого</div>
          )}
        </div>

        {rows.map((rowIdx, i) => (
          <div
            key={rowIdx}
            className={[
              'mrp-row',
              zebra && i % 2 === 1 ? 'is-alt' : '',
              // Линия потолще каждые пять учеников — то же, что каждые пять
              // задач по горизонтали: глаз держит строку на широком листе.
              i > 0 && rowIdx % 5 === 0 ? 'is-group' : '',
            ].filter(Boolean).join(' ')}
            style={{ height: `${page.rowMm}mm` }}
          >
            {showIndex && (
              <div className="mrp-cell mrp-cell--index" style={{ flex: `0 0 ${page.indexMm}mm` }}>
                {rowIdx + 1}
              </div>
            )}
            <div className="mrp-cell mrp-cell--name" style={{ flex: `0 0 ${page.nameMm}mm` }}>
              {students[rowIdx] || ''}
            </div>
            {taskNumbers.map(cell)}
            {page.withTotal && (
              <div className="mrp-cell mrp-cell--total" style={{ flex: `0 0 ${page.totalMm}mm` }} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Экран ────────────────────────────────────────────────────────────────── */

/**
 * Бумажный бланк рейтинга: строки — ученики, столбцы — задачи, в клетке —
 * квадратики попыток (те же, что в шапке блока отрезного листа). Учитель
 * закрашивает квадрат удачной попытки, по нему же читается балл.
 *
 * Оформление — язык движка `print-sheet`: монохром (чёрная заливка шапки съедала
 * тонер и давала серую кашу на ч/б принтере), миллиметры, волосяные линейки,
 * группирующая линия каждые пять задач.
 *
 * 🚨 Ширины колонок и высоты строк считает `utils/marathonRating.js` и отдаёт
 * inline: таблица «разберётся сама» на 17 задачах ужимала колонки до нечитаемых
 * 4 мм и вылезала за край листа. Что не влезло по ширине или высоте — уезжает на
 * следующую страницу с повторённой шапкой.
 */
export default function MarathonRatingPrint({
  students = [], tasks = [], title, classNumber, onBack,
}) {
  const [settings, setSettings] = useState(readRatingSettings);

  const save = useCallback((next) => {
    setSettings(next);
    writeRatingSettings(next);
  }, []);

  const patch = useCallback((delta) => {
    save(normalizeRatingSettings({ ...settings, ...delta }));
  }, [settings, save]);

  const plan = useMemo(
    () => planRating({ studentCount: students.length, taskCount: tasks.length, settings }),
    [students.length, tasks.length, settings],
  );

  const handlePrint = () => printPaged({
    size: settings.orientation === 'landscape' ? 'A4 landscape' : 'A4 portrait',
  });

  const pageCount = plan.pages.length;
  const rootClass = `mrp-root mrp-root--${settings.orientation}`;

  return (
    <div className={rootClass}>
      <div className="no-print">
        <div className="mrp-toolbar">
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={onBack}>Назад</Button>
            <Text type="secondary">
              Бланк рейтинга · {students.length} {plural(students.length, 'ученик', 'ученика', 'учеников')} ×{' '}
              {tasks.length} {plural(tasks.length, 'задача', 'задачи', 'задач')} ·{' '}
              {pageCount} {plural(pageCount, 'лист', 'листа', 'листов')}
            </Text>
          </Space>
          <Button
            type="primary"
            icon={<PrinterOutlined />}
            onClick={handlePrint}
            disabled={!pageCount}
          >
            Печать
          </Button>
        </div>

        <Card size="small" style={{ marginBottom: 12 }}>
          <MarathonRatingSettings
            settings={settings}
            patch={patch}
            plan={plan}
            taskCount={tasks.length}
            studentCount={students.length}
          />
        </Card>
      </div>

      <div className="mrp-pages">
        {plan.pages.map((page, i) => (
          <RatingSheet
            key={`${page.rowFrom}-${page.taskFrom}`}
            page={page}
            pageNo={i + 1}
            pageCount={pageCount}
            students={students}
            tasks={tasks}
            title={title}
            classNumber={classNumber}
            settings={settings}
          />
        ))}
      </div>
    </div>
  );
}

import MathRenderer from '../MathRenderer';

/**
 * Печатная разметка листа-раскраски (Pixel Art Worksheet).
 *
 * Режимы:
 *   twoSheets=false — один лист A4: задачи вверху, сетка внизу
 *   twoSheets=true  — два листа: Лист 1 (задачи), Лист 2 (сетка)
 *   showTeacherKey  — дополнительная страница-ключ с подсвеченными ответами
 *   twoColumns      — задачи в две колонки (как в QR-листах)
 *
 * Клетки всегда квадратные. Размер подбирается по наименее ограниченной оси.
 *
 * Props:
 *   title            — string
 *   tasks[]          — задачи { id, statement_md, answer, code, has_image }
 *   grid             — Cell[][] | null  ({ value: number, isAnswer: boolean })
 *   getAnswerForTask — (task) → string
 *   showTeacherKey   — boolean
 *   twoSheets        — boolean
 *   twoColumns       — boolean
 *   className        — string (используется для scoped @media print)
 */
export default function PixelArtPrintLayout({
  title,
  tasks,
  grid,
  getAnswerForTask,
  showTeacherKey = false,
  twoSheets = false,
  twoColumns = false,
  className = 'pixel-art-print-root',
}) {
  if (!grid) return null;

  const rows = grid.length;
  const cols = grid[0]?.length || 0;
  if (!rows || !cols) return null;

  // ── Размер клетки (квадратные, мм) ────────────────────────────────────────
  const availW = 190; // A4 210mm − 2×10mm поля
  // На отдельном листе для сетки высота ~240mm; на совместном листе ~120mm
  const availH = twoSheets ? 240 : 120;
  const cellMm = Math.max(3.5, Math.min(10, Math.min(availW / cols, availH / rows)));
  const fontPt = Math.max(5, Math.round(cellMm * 2.2 - 1));

  // ── Рендер сетки ──────────────────────────────────────────────────────────
  const renderGrid = (highlightAnswers) => (
    <table
      style={{
        borderCollapse: 'collapse',
        tableLayout: 'fixed',
        pageBreakInside: 'avoid',
        margin: '0 auto',
      }}
    >
      <tbody>
        {grid.map((row, ri) => (
          <tr key={ri}>
            {row.map((cell, ci) => {
              const filled = highlightAnswers && cell.isAnswer;
              return (
                <td
                  key={ci}
                  style={{
                    width: `${cellMm}mm`,
                    height: `${cellMm}mm`,
                    border: '0.4pt solid #666',
                    textAlign: 'center',
                    verticalAlign: 'middle',
                    fontSize: `${fontPt}pt`,
                    fontFamily: 'Arial, sans-serif',
                    fontWeight: 500,
                    background: filled ? '#1a1a1a' : '#fff',
                    color: filled ? '#ffffff' : '#222',
                    padding: 0,
                    lineHeight: 1,
                  }}
                >
                  {cell.value}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );

  // ── Шапка листа ───────────────────────────────────────────────────────────
  const renderHeader = (suffix = '') => (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      borderBottom: '1.5pt solid #000',
      paddingBottom: 6,
      marginBottom: 14,
    }}>
      <div style={{ fontWeight: 700, fontSize: 14, fontFamily: 'Times New Roman, serif' }}>
        {title}{suffix}
      </div>
      <div style={{ fontSize: 10, fontFamily: 'Arial, sans-serif', whiteSpace: 'nowrap' }}>
        Имя:_____________________ Класс:_______
      </div>
    </div>
  );

  // ── Задачи ────────────────────────────────────────────────────────────────
  const renderTasks = () => (
    <div style={{
      marginBottom: 14,
      ...(twoColumns ? {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '6mm 5mm',
      } : {}),
    }}>
      {tasks.map((task, idx) => (
        <div key={task.id} style={{ marginBottom: 8, overflow: 'hidden' }}>
          <span style={{
            fontWeight: 600,
            fontFamily: 'Arial, sans-serif',
            fontSize: 11,
          }}>
            Задача {idx + 1}.{' '}
          </span>
          <span style={{ fontSize: 11, fontFamily: 'Times New Roman, serif', lineHeight: 1.45 }}>
            <MathRenderer content={task.statement_md || ''} />
          </span>
          <div style={{
            marginTop: 3,
            fontSize: 10,
            fontFamily: 'Arial, sans-serif',
            color: '#555',
          }}>
            Ответ: _______________
          </div>
        </div>
      ))}
    </div>
  );

  const instruction = (
    <div style={{
      fontSize: 10,
      fontFamily: 'Arial, sans-serif',
      marginBottom: 12,
      padding: '5px 10px',
      background: '#f5f5f5',
      border: '0.5pt solid #ccc',
      borderRadius: 3,
    }}>
      <b>Задание:</b> Реши задачи ниже. Найди в таблице все клетки с числами-ответами
      и закрась их. Если всё сделано верно — из закрашенных клеток получится картинка!
    </div>
  );

  const footer = (
    <div style={{
      marginTop: 8,
      textAlign: 'center',
      fontSize: 8,
      color: '#bbb',
      fontFamily: 'Arial, sans-serif',
    }}>
      © Лемма
    </div>
  );

  const gridCaption = (
    <div style={{
      textAlign: 'center',
      fontWeight: 600,
      fontFamily: 'Arial, sans-serif',
      fontSize: 10,
      marginBottom: 8,
      textTransform: 'uppercase',
      letterSpacing: 1,
    }}>
      Закрась числа-ответы — получится картинка!
    </div>
  );

  return (
    <div className={className}>

      {/* ── ЛИСТ 1: задачи (+ сетка если один лист) ── */}
      <div className="pixel-art-tasks-page">
        {renderHeader()}
        {instruction}
        {renderTasks()}

        {!twoSheets && (
          <div style={{ pageBreakInside: 'avoid' }}>
            {gridCaption}
            {renderGrid(false)}
          </div>
        )}

        {footer}
      </div>

      {/* ── ЛИСТ 2: только сетка (режим двух листов) ── */}
      {twoSheets && (
        <div className="pixel-art-grid-page" style={{ pageBreakBefore: 'always' }}>
          <div style={{
            borderBottom: '1.5pt solid #000',
            paddingBottom: 6,
            marginBottom: 14,
            fontWeight: 700,
            fontSize: 14,
            fontFamily: 'Times New Roman, serif',
          }}>
            Раскраска
          </div>
          {gridCaption}
          {renderGrid(false)}
          {footer}
        </div>
      )}

      {/* ── СТРАНИЦА-КЛЮЧ для учителя ── */}
      {showTeacherKey && (
        <div className="pixel-art-teacher-page" style={{ pageBreakBefore: 'always' }}>
          <div style={{
            borderBottom: '1.5pt solid #000',
            paddingBottom: 6,
            marginBottom: 14,
            fontWeight: 700,
            fontSize: 14,
            fontFamily: 'Times New Roman, serif',
          }}>
            {title} — КЛЮЧ (для учителя)
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={{
              fontWeight: 600,
              fontFamily: 'Arial, sans-serif',
              fontSize: 11,
              marginBottom: 6,
            }}>
              Ответы:
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 24px' }}>
              {tasks.map((task, idx) => (
                <div key={task.id} style={{ fontSize: 11, fontFamily: 'Arial, sans-serif' }}>
                  Задача {idx + 1}: <b>{getAnswerForTask(task) || '—'}</b>
                </div>
              ))}
            </div>
          </div>

          <div style={{ pageBreakInside: 'avoid' }}>
            <div style={{
              textAlign: 'center',
              fontWeight: 600,
              fontFamily: 'Arial, sans-serif',
              fontSize: 10,
              marginBottom: 8,
              textTransform: 'uppercase',
              letterSpacing: 1,
            }}>
              Правильный паттерн (чёрные клетки = числа-ответы)
            </div>
            {renderGrid(true)}
          </div>
        </div>
      )}
    </div>
  );
}

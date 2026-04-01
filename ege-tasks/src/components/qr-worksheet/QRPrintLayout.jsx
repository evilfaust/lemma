import MathRenderer from '../MathRenderer';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '../../services/pocketbase';
import { buildZoneCache, getCellZone } from '../../utils/qrZones';

/**
 * Печатная разметка А4.
 *
 * Props:
 *   title           — string
 *   tasks[]         — задачи
 *   grid            — Cell[][] | null
 *   qrUrl           — string
 *   getAnswerForTask(task) → string
 *   showTeacherKey  — boolean
 *   twoColumns      — boolean  (трёхколоночный макет: задачи | сетка | задачи)
 *   matrix          — boolean[][] | null  (оригинальная QR-матрица)
 *   preFillFinder   — boolean
 *   preFillTiming   — boolean
 *   preFillFormat   — boolean
 *   className       — string
 */
export default function QRPrintLayout({
  title,
  tasks,
  grid,
  qrUrl,
  getAnswerForTask,
  showTeacherKey = false,
  twoColumns = false,
  matrix = null,
  preFillFinder = false,
  preFillTiming = false,
  preFillFormat = false,
  className = 'qr-print-root',
}) {
  if (!grid) return null;

  const size = grid.length;
  const anyPreFill = preFillFinder || preFillTiming || preFillFormat;

  // Кеш зон (строится синхронно, только если нужен)
  const zoneCache = anyPreFill ? buildZoneCache(size) : null;

  // Размер ячейки: полноширинный (одноколоночный) и компактный (центральный)
  const cellMm = Math.max(5, Math.min(8, Math.floor(170 / size)));
  const cellMmCenter = Math.max(3, Math.min(5, Math.floor(80 / size)));

  const renderGrid = (highlightAnswers, overrideCellMm = null) => {
    const cm = overrideCellMm ?? cellMm;
    const fs = `${Math.max(5, cm - 3)}pt`;

    return (
      <table
        style={{
          borderCollapse: 'collapse',
          tableLayout: 'fixed',
          margin: '0 auto',
          pageBreakInside: 'avoid',
        }}
      >
        <tbody>
          {grid.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => {
                const zone = zoneCache ? getCellZone(ri, ci, size, zoneCache) : null;
                const isPreFilled =
                  (zone === 'finder' && preFillFinder) ||
                  (zone === 'timing' && preFillTiming) ||
                  (zone === 'format' && preFillFormat);

                if (isPreFilled) {
                  const isBlack = matrix?.[ri]?.[ci] ?? false;
                  return (
                    <td
                      key={ci}
                      style={{
                        width: `${cm}mm`,
                        height: `${cm}mm`,
                        border: '0.4pt solid #999',
                        padding: 0,
                        background: isBlack ? '#1a1a1a' : '#e8e8e8',
                      }}
                    />
                  );
                }

                const filled = highlightAnswers && cell.isAnswer;
                return (
                  <td
                    key={ci}
                    style={{
                      width: `${cm}mm`,
                      height: `${cm}mm`,
                      border: '0.4pt solid #666',
                      textAlign: 'center',
                      verticalAlign: 'middle',
                      fontSize: fs,
                      fontFamily: 'Arial, sans-serif',
                      fontWeight: 500,
                      background: filled ? '#000' : '#fff',
                      color: filled ? '#000' : '#222',
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
  };

  // Инструкция с учётом предзакрашенных зон
  const instructionExtra = anyPreFill
    ? ' Затемнённые клетки уже заполнены — это стандартные метки QR-кода.'
    : '';

  // Рендер одной задачи (используется в обоих режимах)
  const renderTask = (task, idx, narrow = false) => {
    const imageUrl = task.has_image ? api.getTaskImageUrl(task) : '';
    const imgStyle = narrow
      ? { display: 'block', maxWidth: '100%', maxHeight: '25mm', objectFit: 'contain', marginBottom: 3 }
      : {
          float: 'right',
          maxWidth: twoColumns ? '42%' : '38%',
          maxHeight: twoColumns ? '40mm' : '55mm',
          objectFit: 'contain',
          marginLeft: 6,
          marginBottom: 2,
          display: 'block',
        };
    const titleSize = narrow ? 9 : 11;
    const bodySize = narrow ? 9 : 11;
    const answerSize = narrow ? 8 : 10;

    return (
      <div key={task.id} style={{ overflow: 'hidden', marginBottom: narrow ? '4mm' : 0 }}>
        {imageUrl && <img src={imageUrl} alt="" style={imgStyle} />}
        <div style={{
          fontWeight: 600,
          fontFamily: 'Arial, sans-serif',
          fontSize: titleSize,
          marginBottom: 3,
        }}>
          Задача {idx + 1}.
        </div>
        <div style={{ fontSize: bodySize, fontFamily: 'Times New Roman, serif', lineHeight: 1.4 }}>
          <MathRenderer content={task.statement_md || ''} />
        </div>
        <div style={{
          marginTop: 4,
          fontSize: answerSize,
          fontFamily: 'Arial, sans-serif',
          color: '#555',
          clear: 'right',
        }}>
          Ответ: _______________
        </div>
      </div>
    );
  };

  // Метка центральной сетки
  const gridLabel = (
    <div style={{
      textAlign: 'center',
      fontWeight: 600,
      fontFamily: 'Arial, sans-serif',
      fontSize: 10,
      marginBottom: 8,
      textTransform: 'uppercase',
      letterSpacing: 1,
    }}>
      Найди и закрась числа-ответы
    </div>
  );

  // ─── ТРЁХКОЛОНОЧНЫЙ МАКЕТ (twoColumns=true) ───────────────────────────────
  // Задачи первой половины | сетка по центру | задачи второй половины
  const renderThreeColumnBody = () => {
    const half = Math.ceil(tasks.length / 2);
    const leftTasks = tasks.slice(0, half);
    const rightTasks = tasks.slice(half);

    return (
      <div style={{ display: 'flex', gap: '5mm', alignItems: 'flex-start' }}>
        {/* Левая колонка задач */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {leftTasks.map((task, i) => renderTask(task, i, true))}
        </div>

        {/* Центральная колонка: сетка */}
        <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {gridLabel}
          {renderGrid(false, cellMmCenter)}
        </div>

        {/* Правая колонка задач */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {rightTasks.map((task, i) => renderTask(task, half + i, true))}
        </div>
      </div>
    );
  };

  // ─── ОДНОКОЛОНОЧНЫЙ МАКЕТ (twoColumns=false) ──────────────────────────────
  // Задачи сверху → сетка снизу
  const renderSingleColumnBody = () => (
    <>
      <div style={{ marginBottom: 16 }}>
        {tasks.map((task, idx) => (
          <div key={task.id} style={{ marginBottom: 12 }}>
            {renderTask(task, idx, false)}
          </div>
        ))}
      </div>
      <div style={{ pageBreakInside: 'avoid' }}>
        {gridLabel}
        {renderGrid(false)}
      </div>
    </>
  );

  return (
    <div className={className}>
      {/* ── СТРАНИЦА ДЛЯ УЧЕНИКА ── */}
      <div className="qr-student-page">
        {/* Шапка */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          borderBottom: '1.5pt solid #000',
          paddingBottom: 6,
          marginBottom: 16,
        }}>
          <div style={{ fontWeight: 700, fontSize: 14, fontFamily: 'Times New Roman, serif' }}>
            {title}
          </div>
          <div style={{ fontSize: 10, fontFamily: 'Arial, sans-serif' }}>
            Имя:___________________________ Класс:________
          </div>
        </div>

        {/* Инструкция */}
        <div style={{
          fontSize: 10,
          fontFamily: 'Arial, sans-serif',
          marginBottom: 12,
          padding: '6px 10px',
          background: '#f5f5f5',
          border: '0.5pt solid #ccc',
          borderRadius: 3,
        }}>
          <b>Задание:</b> Реши задачи ниже. Найди в таблице все клетки с числами-ответами и закрась их.
          Если всё сделано верно — из закрашенных клеток получится QR-код. Отсканируй его!
          {instructionExtra}
        </div>

        {/* Тело страницы */}
        {twoColumns ? renderThreeColumnBody() : renderSingleColumnBody()}

        <div style={{
          marginTop: 8,
          textAlign: 'center',
          fontSize: 8,
          color: '#aaa',
          fontFamily: 'Arial, sans-serif',
        }}>
          © Лемма
        </div>
      </div>

      {/* ── СТРАНИЦА-КЛЮЧ ДЛЯ УЧИТЕЛЯ ── */}
      {showTeacherKey && (
        <div className="qr-teacher-page" style={{ pageBreakBefore: 'always' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            borderBottom: '1.5pt solid #000',
            paddingBottom: 6,
            marginBottom: 16,
          }}>
            <div style={{ fontWeight: 700, fontSize: 14, fontFamily: 'Times New Roman, serif' }}>
              {title} — КЛЮЧ (для учителя)
            </div>
          </div>

          <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <div style={{ fontWeight: 600, fontFamily: 'Arial, sans-serif', fontSize: 11, marginBottom: 8 }}>
                Ответы:
              </div>
              {tasks.map((task, idx) => (
                <div key={task.id} style={{ fontSize: 11, fontFamily: 'Arial, sans-serif', marginBottom: 4 }}>
                  Задача {idx + 1}: <b>{getAnswerForTask(task) || '—'}</b>
                </div>
              ))}
            </div>

            {qrUrl && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 600, fontFamily: 'Arial, sans-serif', fontSize: 11, marginBottom: 6 }}>
                  QR-код:
                </div>
                <QRCodeSVG value={qrUrl} size={100} />
                <div style={{ fontSize: 9, color: '#888', marginTop: 4, maxWidth: 100, wordBreak: 'break-all' }}>
                  {qrUrl}
                </div>
              </div>
            )}
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
              Правильный паттерн (чёрные = ответы)
            </div>
            {renderGrid(true)}
          </div>
        </div>
      )}
    </div>
  );
}

import MathRenderer from '../MathRenderer';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '../../services/pocketbase';

/**
 * Печатная разметка А4.
 * Содержит: заголовок, условия задач, QR-сетку (для ученика).
 * В режиме teacher добавляется подложка-ответ рядом.
 *
 * Props:
 *   title         — string
 *   tasks[]       — задачи
 *   grid          — Cell[][] | null
 *   qrUrl         — string (для отображения QR рядом как подсказка учителю)
 *   getAnswerForTask(task) → string
 *   showTeacherKey — boolean (добавить страницу-ключ для учителя)
 *   className      — string (обязательно qr-print-root для print-скрытия остальных элементов)
 */
export default function QRPrintLayout({
  title,
  tasks,
  grid,
  qrUrl,
  getAnswerForTask,
  showTeacherKey = false,
  twoColumns = false,
  className = 'qr-print-root',
}) {
  if (!grid) return null;

  const size = grid.length;

  // Размер ячейки в мм: под А4 170мм ширина рабочей области
  // Для размеров 21-29 выбираем 6-8 мм
  const cellMm = Math.max(5, Math.min(8, Math.floor(170 / size)));

  const renderGrid = (highlightAnswers) => (
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
                    fontSize: `${Math.max(5, cellMm - 3)}pt`,
                    fontFamily: 'Arial, sans-serif',
                    fontWeight: 500,
                    background: filled ? '#000' : '#fff',
                    color: filled ? '#000' : '#222', // в чёрных клетках текст не виден
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
        </div>

        {/* Задачи */}
        <div style={{
          marginBottom: 16,
          ...(twoColumns ? {
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '6mm 5mm',
          } : {}),
        }}>
          {tasks.map((task, idx) => {
            const imageUrl = task.has_image ? api.getTaskImageUrl(task) : '';
            // В двух колонках картинка занимает меньше — колонка ~90мм
            const imgMaxWidth = twoColumns ? '42%' : '38%';
            const imgMaxHeight = twoColumns ? '40mm' : '55mm';
            return (
              <div key={task.id} style={{ overflow: 'hidden' }}>
                {imageUrl && (
                  <img
                    src={imageUrl}
                    alt=""
                    style={{
                      float: 'right',
                      maxWidth: imgMaxWidth,
                      maxHeight: imgMaxHeight,
                      objectFit: 'contain',
                      marginLeft: 6,
                      marginBottom: 2,
                      display: 'block',
                    }}
                  />
                )}
                <div style={{
                  fontWeight: 600,
                  fontFamily: 'Arial, sans-serif',
                  fontSize: 11,
                  marginBottom: 3,
                }}>
                  Задача {idx + 1}.
                </div>
                <div style={{ fontSize: 11, fontFamily: 'Times New Roman, serif', lineHeight: 1.4 }}>
                  <MathRenderer content={task.statement_md || ''} />
                </div>
                <div style={{
                  marginTop: 4,
                  fontSize: 10,
                  fontFamily: 'Arial, sans-serif',
                  color: '#555',
                  clear: 'right',
                }}>
                  Ответ: _______________
                </div>
              </div>
            );
          })}
        </div>

        {/* QR-сетка */}
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
            Найди и закрась числа-ответы
          </div>
          {renderGrid(false)}
        </div>

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

      {/* ── СТРАНИЦА-КЛЮЧ ДЛЯ УЧИТЕЛЯ (если нужна) ── */}
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
            {/* Ответы */}
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

            {/* QR-код */}
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

          {/* Сетка с подсветкой */}
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

import { useState, forwardRef } from 'react';
import { Card, Typography, Image, Tooltip, message, Button } from 'antd';
import { SwapOutlined, EditOutlined } from '@ant-design/icons';
import MathRenderer from './MathRenderer';
import TaskReplaceModal from './TaskReplaceModal';
import { api } from '../services/pocketbase';
import { filterTaskText as filterTaskTextUtil } from '../utils/filterTaskText';

const { Text, Title } = Typography;

const PrintableWorksheet = forwardRef(({
  cards: initialCards,
  title,
  showAnswers,
  showSolutions,
  format,
  cardsCount,
  tasksPerCard,
  topicName,
  topics = [],
  tags = [],
  subtopics = [],
  hideTaskPrefixes = false,
  fontSize = 13,
  showStudentInfo = true,
  variantLabel = 'Проверочная работа',
  // Callbacks для drag & drop и редактирования
  onTaskDrop,
  onEditTask,
  onCardsChange,
}, ref) => {
  const [cards, setCards] = useState(initialCards || []);

  const filterTaskText = (text) => {
    if (!hideTaskPrefixes) return text;
    return filterTaskTextUtil(text);
  };

  const [replaceModalVisible, setReplaceModalVisible] = useState(false);
  const [taskToReplace, setTaskToReplace] = useState(null);

  // Drag & drop state
  const [draggedTask, setDraggedTask] = useState(null);
  const [dragOverTask, setDragOverTask] = useState(null);

  const getCardStyle = () => {
    switch (format) {
      case 'А6':
        return {
          cardsPerPage: 4,
          gridColumns: '1fr 1fr',
          gridRows: '1fr 1fr',
          cardPadding: '5mm',
          pagePadding: '5mm',
        };
      case 'А5':
        return {
          cardsPerPage: 2,
          gridColumns: '1fr',
          gridRows: '1fr 1fr',
          cardPadding: '7mm',
          pagePadding: '5mm',
        };
      case 'А4':
        return {
          cardsPerPage: 1,
          gridColumns: '1fr',
          gridRows: '1fr',
          cardPadding: '10mm',
          pagePadding: '5mm',
        };
      default:
        return {
          cardsPerPage: 4,
          gridColumns: '1fr 1fr',
          gridRows: '1fr 1fr',
          cardPadding: '5mm',
          pagePadding: '5mm',
        };
    }
  };

  const cardStyle = getCardStyle();

  // Замена задач
  const handleReplaceTask = (cardIndex, taskIndex, task) => {
    setTaskToReplace({ cardIndex, taskIndex, task });
    setReplaceModalVisible(true);
  };

  const handleConfirmReplace = (newTask) => {
    const { cardIndex, taskIndex } = taskToReplace;
    const newCards = [...cards];
    newCards[cardIndex] = [...newCards[cardIndex]];
    newCards[cardIndex][taskIndex] = newTask;
    setCards(newCards);
    if (onCardsChange) onCardsChange(newCards);
    setReplaceModalVisible(false);
    message.success('Задача успешно заменена');
  };

  const handleCancelReplace = () => {
    setReplaceModalVisible(false);
    setTaskToReplace(null);
  };

  // Drag & drop handlers
  const handleDragStart = (e, cardIndex, taskIndex) => {
    setDraggedTask({ cardIndex, taskIndex });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, cardIndex, taskIndex) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverTask({ cardIndex, taskIndex });
  };

  const handleDragLeave = () => {
    setDragOverTask(null);
  };

  const handleDrop = (e, targetCardIndex, targetTaskIndex) => {
    e.preventDefault();
    if (!draggedTask) return;

    const { cardIndex: sourceCardIndex, taskIndex: sourceTaskIndex } = draggedTask;

    if (sourceCardIndex === targetCardIndex && sourceTaskIndex === targetTaskIndex) {
      setDraggedTask(null);
      setDragOverTask(null);
      return;
    }

    // Только перестановка внутри одной карточки
    if (sourceCardIndex === targetCardIndex) {
      const newCards = [...cards];
      const cardTasks = [...newCards[sourceCardIndex]];
      const [movedTask] = cardTasks.splice(sourceTaskIndex, 1);
      cardTasks.splice(targetTaskIndex, 0, movedTask);
      newCards[sourceCardIndex] = cardTasks;
      setCards(newCards);
      if (onCardsChange) onCardsChange(newCards);
    }

    setDraggedTask(null);
    setDragOverTask(null);
  };

  const handleDragEnd = () => {
    setDraggedTask(null);
    setDragOverTask(null);
  };

  return (
    <div ref={ref} className="printable-worksheet">
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .printable-worksheet,
          .printable-worksheet * {
            visibility: visible;
          }
          .printable-worksheet {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .card-print-page {
            page-break-after: always;
            margin: 0;
          }
          .card-print-page:last-child {
            page-break-after: auto;
          }
          .no-print {
            display: none !important;
          }
          @page {
            margin: 5mm 0 0 0;
            size: A4 portrait;
          }
        }

        .card-print-page {
          display: flex;
          justify-content: center;
          align-items: center;
          width: 210mm;
          height: 297mm;
          padding: 0;
          box-sizing: border-box;
          background: white;
          page-break-after: always;
          position: relative;
        }

        .card-print-page:last-child {
          page-break-after: auto;
        }

        .card-grid-container {
          display: grid;
          grid-template-columns: ${cardStyle.gridColumns};
          grid-template-rows: ${cardStyle.gridRows};
          gap: 2mm;
          width: 210mm;
          height: 297mm;
          padding: 5mm;
          box-sizing: border-box;
        }

        .worksheet-card {
          border: 1px solid #ccc;
          padding: ${cardStyle.cardPadding};
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          position: relative;
          background: white;
          overflow: hidden;
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-bottom: 8px;
          padding-bottom: 4px;
          border-bottom: 1.5px solid #333;
        }

        .card-code {
          font-size: 13px;
          font-weight: 700;
          color: #333;
          white-space: nowrap;
        }

        .student-info {
          flex: 1;
          margin-left: 10px;
          display: flex;
          align-items: flex-end;
          gap: 4px;
        }

        .student-info-label {
          font-size: 10px;
          color: #666;
          white-space: nowrap;
          padding-bottom: 1px;
        }

        .student-info-line {
          flex: 1;
          border-bottom: 1px solid #999;
          min-height: 16px;
        }

        .tasks-container {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .card-task-row {
          display: flex;
          align-items: baseline;
          gap: 4px;
          page-break-inside: avoid;
          position: relative;
          padding: 2px 0;
          cursor: grab;
          transition: background-color 0.15s;
        }

        .card-task-row:active {
          cursor: grabbing;
        }

        .card-task-row.dragging {
          opacity: 0.4;
        }

        .card-task-row.drag-over {
          border-top: 2px solid #1890ff;
        }

        .card-task-number {
          font-weight: 600;
          font-size: ${fontSize}px;
          color: #333;
          flex-shrink: 0;
          line-height: 1.45;
        }

        .card-task-text {
          flex: 1;
          font-size: ${fontSize}px;
          line-height: 1.45;
        }

        .card-task-text p {
          margin: 0;
          display: inline;
        }

        .card-task-text img {
          max-width: 100%;
          max-height: 70px;
          margin-top: 3px;
          display: block;
        }

        .card-answer-field {
          border-bottom: 1.5px solid #333;
          min-width: 60px;
          min-height: 20px;
          flex-shrink: 0;
          text-align: center;
          font-size: ${fontSize}px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 500;
        }

        /* Страница с ответами */
        .card-answers-page {
          width: 210mm;
          min-height: 297mm;
          background: white;
          padding: 15mm;
          margin: 7mm;
          page-break-after: always;
          box-sizing: border-box;
        }

        @media print {
          .card-answers-page {
            margin: 0;
            padding: calc(15mm + 7mm) 15mm 15mm 15mm;
          }
          .worksheet-card {
            border: 1px solid #bbb !important;
          }
        }

        .card-answers-page:last-child {
          page-break-after: auto;
        }

        .answers-header {
          text-align: center;
          margin-bottom: 25px;
          padding-bottom: 12px;
          border-bottom: 2px solid #000;
        }

        .answers-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 25px;
        }

        .answer-card {
          border: 1px solid #000;
          padding: 18px;
          background: white;
        }

        .answer-card-title {
          font-size: 15px;
          font-weight: 600;
          margin-bottom: 12px;
          padding-bottom: 10px;
          border-bottom: 1px solid #000;
        }

        .answer-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 6px 0;
        }

        .answer-item:not(:last-child) {
          border-bottom: 1px dashed #ddd;
        }

        .katex {
          font-size: 0.95em !important;
        }

        .katex-display {
          margin: 0 !important;
          display: inline !important;
        }

        @media screen {
          .card-print-page {
            margin-bottom: 30px;
            box-shadow: 0 2px 12px rgba(0,0,0,0.15);
            border-radius: 4px;
          }

          .card-answers-page {
            margin-bottom: 30px;
            box-shadow: 0 2px 12px rgba(0,0,0,0.15);
            border-radius: 4px;
          }

          .card-task-row:hover {
            background: #fafafa;
          }
        }
      `}</style>

      {/* Карточки с заданиями */}
      {Array.from({ length: Math.ceil(cards.length / cardStyle.cardsPerPage) }, (_, pageIndex) => {
        const pageCards = cards.slice(
          pageIndex * cardStyle.cardsPerPage,
          pageIndex * cardStyle.cardsPerPage + cardStyle.cardsPerPage
        );

        return (
          <div key={`tasks-${pageIndex}`} className="card-print-page">
            <div className="card-grid-container">
              {pageCards.map((cardTasks, cardIndex) => {
              const globalCardIndex = pageIndex * cardStyle.cardsPerPage + cardIndex;

              let cardCode;
              if (cards.length === 1 && title.match(/\d{3}$/)) {
                cardCode = title;
              } else {
                const cardNumber = String(globalCardIndex + 1).padStart(3, '0');
                const baseTitle = topicName || variantLabel || title;
                cardCode = `${baseTitle} ${cardNumber}`;
              }

              return (
                <div key={cardIndex} className="worksheet-card">
                  <div className="card-header">
                    <div className="card-code">{cardCode}</div>
                    {showStudentInfo && (
                      <div className="student-info">
                        <span className="student-info-label">ФИ:</span>
                        <span className="student-info-line"></span>
                      </div>
                    )}
                  </div>

                  <div className="tasks-container">
                    {cardTasks.map((task, taskIndex) => {
                      const isDragging = draggedTask?.cardIndex === globalCardIndex && draggedTask?.taskIndex === taskIndex;
                      const isDragOver = dragOverTask?.cardIndex === globalCardIndex && dragOverTask?.taskIndex === taskIndex;

                      return (
                        <div
                          key={task.id}
                          className={`card-task-row ${isDragging ? 'dragging' : ''} ${isDragOver ? 'drag-over' : ''}`}
                          draggable
                          onDragStart={(e) => handleDragStart(e, globalCardIndex, taskIndex)}
                          onDragOver={(e) => handleDragOver(e, globalCardIndex, taskIndex)}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, globalCardIndex, taskIndex)}
                          onDragEnd={handleDragEnd}
                        >
                          <div className="card-task-number">{taskIndex + 1}.</div>

                          <div className="card-task-text">
                            <MathRenderer text={filterTaskText(task.statement_md)} />
                            {task.has_image && task.image_url && (
                              <img
                                src={task.image_url}
                                alt="Изображение задачи"
                              />
                            )}
                          </div>

                          <div className="card-answer-field">
                            {showAnswers && task.answer && (
                              <MathRenderer text={task.answer} />
                            )}
                          </div>

                          {/* Кнопки управления (только на экране) */}
                          <div className="no-print" style={{
                            position: 'absolute',
                            right: '2px',
                            top: '0px',
                            display: 'flex',
                            gap: '0px',
                            opacity: 0.6,
                            zIndex: 10,
                          }}>
                            {onEditTask && (
                              <Tooltip title="Редактировать">
                                <Button
                                  type="text"
                                  size="small"
                                  icon={<EditOutlined style={{ fontSize: 12 }} />}
                                  onClick={() => onEditTask(task)}
                                  style={{ padding: '0 4px', height: 20 }}
                                />
                              </Tooltip>
                            )}
                            <Tooltip title="Заменить">
                              <Button
                                type="text"
                                size="small"
                                icon={<SwapOutlined style={{ fontSize: 12 }} />}
                                onClick={() => handleReplaceTask(globalCardIndex, taskIndex, task)}
                                style={{ padding: '0 4px', height: 20 }}
                              />
                            </Tooltip>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {showSolutions && cardTasks.some(t => t.solution_md) && (
                    <div style={{
                      marginTop: '6px',
                      paddingTop: '4px',
                      borderTop: '1px dashed #999',
                      fontSize: '10px'
                    }}>
                      <div style={{ fontWeight: 'bold', marginBottom: '3px' }}>Решения:</div>
                      {cardTasks.map((task, taskIndex) => (
                        task.solution_md && (
                          <div key={task.id} style={{ marginBottom: '2px' }}>
                            <span style={{ fontWeight: 'bold' }}>{taskIndex + 1})</span>{' '}
                            <MathRenderer text={task.solution_md} />
                          </div>
                        )
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            </div>
          </div>
        );
      })}

      {/* Отдельные страницы с ответами для каждой карточки */}
      {!showAnswers && cards.map((cardTasks, cardIndex) => {
        let cardFullName;
        if (cards.length === 1 && title.match(/\d{3}$/)) {
          cardFullName = title;
        } else {
          const cardNumber = String(cardIndex + 1).padStart(3, '0');
          const baseTitle = topicName || variantLabel || title;
          cardFullName = `${baseTitle} ${cardNumber}`;
        }

        return (
          <div key={`answers-${cardIndex}`} className="card-answers-page">
            <div className="answers-header">
              <Title level={3} style={{ margin: 0 }}>
                Ответы: {cardFullName}
              </Title>
            </div>

            <div className="answers-grid">
              <div className="answer-card">
                <div className="answer-card-title">
                  {cardFullName} (Задания 1-{Math.ceil(cardTasks.length / 2)})
                </div>
              {cardTasks.slice(0, Math.ceil(cardTasks.length / 2)).map((task, taskIndex) => (
                <div key={task.id} className="answer-item">
                  <span><strong>{taskIndex + 1}.</strong></span>
                  <span style={{
                    borderBottom: '1px solid #000',
                    minWidth: '80px',
                    textAlign: 'center',
                    display: 'inline-block',
                    paddingBottom: '3px',
                    fontWeight: 500,
                  }}>
                    {task.answer ? <MathRenderer text={task.answer} /> : '—'}
                  </span>
                </div>
              ))}
            </div>

            <div className="answer-card">
              <div className="answer-card-title">
                {cardFullName} (Задания {Math.ceil(cardTasks.length / 2) + 1}-{cardTasks.length})
              </div>
              {cardTasks.slice(Math.ceil(cardTasks.length / 2)).map((task, taskIndex) => (
                <div key={task.id} className="answer-item">
                  <span><strong>{Math.ceil(cardTasks.length / 2) + taskIndex + 1}.</strong></span>
                  <span style={{
                    borderBottom: '1px solid #000',
                    minWidth: '80px',
                    textAlign: 'center',
                    display: 'inline-block',
                    paddingBottom: '3px',
                    fontWeight: 500,
                  }}>
                    {task.answer ? <MathRenderer text={task.answer} /> : '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Решения если включены */}
          {showSolutions && cardTasks.some(t => t.solution_md) && (
            <div style={{ marginTop: 30 }}>
              <Title level={4}>Решения:</Title>
              {cardTasks.map((task, taskIndex) => (
                task.solution_md && (
                  <div key={task.id} style={{
                    marginBottom: 15,
                    padding: 10,
                    background: '#f5f5f5',
                    borderRadius: 4,
                    border: '1px solid #d9d9d9',
                  }}>
                    <div style={{ fontWeight: 'bold', marginBottom: 5 }}>
                      Задание {taskIndex + 1}:
                    </div>
                    <div style={{ fontSize: 13 }}>
                      <MathRenderer text={task.solution_md} />
                    </div>
                    {task.answer && (
                      <div style={{ marginTop: 5, fontWeight: 'bold', color: '#52c41a' }}>
                        Ответ: <MathRenderer text={task.answer} />
                      </div>
                    )}
                  </div>
                )
              ))}
            </div>
          )}
        </div>
      );})}

      {/* Модальное окно для замены задачи */}
      <TaskReplaceModal
        visible={replaceModalVisible}
        taskToReplace={taskToReplace}
        onConfirm={handleConfirmReplace}
        onCancel={handleCancelReplace}
        topics={topics}
        subtopics={subtopics}
        tags={tags}
        currentVariantTasks={taskToReplace ? cards[taskToReplace.cardIndex] || [] : []}
      />
    </div>
  );
});

PrintableWorksheet.displayName = 'PrintableWorksheet';

export default PrintableWorksheet;

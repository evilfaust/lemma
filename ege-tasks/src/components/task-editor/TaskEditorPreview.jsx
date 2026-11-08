import { useState } from 'react';
import { Switch } from 'antd';
import MathRenderer from '../MathRenderer';
import TaskStatementRenderer from '../TaskStatementRenderer';

export default function TaskEditorPreview({ code, statement, answer, solution, imageUrl, images }) {
  const [showDetails, setShowDetails] = useState(true);

  return (
    <aside className="task-editor-preview" aria-label="Предпросмотр задачи">
      <div className="task-editor-section-heading">
        <h3>Предпросмотр</h3>
        <label className="task-editor-preview-toggle">
          <span>Ответ и решение</span>
          <Switch size="small" checked={showDetails} onChange={setShowDetails}
            aria-label="Показывать ответ и решение" />
        </label>
      </div>
      <div className="task-editor-preview-sheet">
        {code && <div className="task-editor-preview-code">{code}</div>}
        <div className="task-statement task-editor-preview-statement">
          {statement ? (
            <TaskStatementRenderer text={statement} images={images.condition} answerBoxes />
          ) : (
            <p className="task-editor-muted">Введите условие — здесь появится задача.</p>
          )}
        </div>
        {imageUrl && <img className="task-editor-preview-image" src={imageUrl} alt="Рисунок к условию" />}
        {showDetails && (
          <>
            <section className="task-editor-preview-detail">
              <h4>Ответ</h4>
              {answer ? <MathRenderer text={answer} /> : <span className="task-editor-muted">Пока не указан</span>}
            </section>
            {solution && (
              <section className="task-editor-preview-detail">
                <h4>Решение</h4>
                <div className="task-statement">
                  <TaskStatementRenderer text={solution} images={images.solution} />
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </aside>
  );
}

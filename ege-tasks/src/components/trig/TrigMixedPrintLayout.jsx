import React from 'react';
import katex from 'katex';
import UnitCircleSVG from './UnitCircleSVG';
import './TrigMixedPrintLayout.css';

function MathLine({ latex }) {
  let html;
  try { html = katex.renderToString(latex, { throwOnError: false, displayMode: false }); }
  catch { html = latex; }
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

function WorkSpace({ size }) {
  return <div className="tmixed-workspace" style={{ height: `${size}mm` }} />;
}

// ─── Одно задание (обычный или двухстрочный режим) ────────────────────────────
function RegularTaskRow({ q, globalIndex, questionMode, showWorkSpace, workSpaceSize }) {
  const label = `${globalIndex})`;
  const ws = showWorkSpace ? <WorkSpace size={workSpaceSize} /> : null;

  if (questionMode === 'twoLine') {
    return (
      <div className="tmixed-question tmixed-question--twoLine">
        <div className="tmixed-question-top">
          <span className="tmixed-q-label">{label}</span>
          <span className="tmixed-q-expr"><MathLine latex={q.exprLatex} /></span>
        </div>
        {ws}
      </div>
    );
  }

  return (
    <div className="tmixed-question">
      <div className="tmixed-question-top">
        <span className="tmixed-q-label">{label}</span>
        <span className="tmixed-q-expr"><MathLine latex={q.exprLatex} /></span>
        <span className="tmixed-q-equals">=</span>
        <span className="tmixed-q-answer-space" />
      </div>
      {ws}
    </div>
  );
}

// ─── Инструкция для единичной окружности ─────────────────────────────────────
function ucInstruction(taskType) {
  if (taskType === 'direct')  return 'Запишите угол для каждой отмеченной точки:';
  if (taskType === 'inverse') return 'Отметьте на окружности точки, соответствующие углам:';
  return 'Выполните задания с единичной окружностью:';
}

// ─── Секция одного генератора ─────────────────────────────────────────────────
function SectionBlock({ section, startIndex, showSectionHeaders, showWorkSpace, workSpaceSize }) {
  const { label, instruction, questionMode, tasks, ucSettings, twoColumns } = section;

  const isUC = questionMode === 'unitcircle';
  const endIndex = startIndex + tasks.length - 1;

  // Инструкция с диапазоном номеров заданий
  const instructionText = instruction
    ? (tasks.length > 1
        ? `${startIndex}–${endIndex}. ${instruction}`
        : `${startIndex}. ${instruction}`)
    : null;

  return (
    <div className="tmixed-section">
      {showSectionHeaders && (
        <div className="tmixed-section-header">{label}</div>
      )}

      {isUC ? (
        <div className="tmixed-uc-tasks">
          {tasks.map((task, i) => {
            const isDirect  = task.type === 'direct';
            const isInverse = task.type === 'inverse';
            return (
              <div key={i} className="tmixed-uc-task">
                {/* Окружность */}
                <div className="tmixed-uc-circle-wrap">
                  <div className="tmixed-uc-task-num">{startIndex + i})</div>
                  <UnitCircleSVG
                    points={task.points}
                    taskType={task.type}
                    isAnswer={false}
                    showAxes={ucSettings?.showAxes ?? 'axes'}
                    showDegrees={ucSettings?.showDegrees ?? false}
                    showTicks={ucSettings?.showTicks ?? true}
                  />
                </div>

                {/* Область заданий/ответов справа */}
                <div className="tmixed-uc-points">
                  {isInverse && (
                    <>
                      <div className="tmixed-uc-points-label">Отметьте точки:</div>
                      <div className="tmixed-uc-angle-list">
                        {task.points.map(p => (
                          <span key={p.id} className="tmixed-uc-angle-item">
                            <span className="tmixed-uc-pt-num">{p.id}.</span>
                            <MathLine latex={p.display} />
                          </span>
                        ))}
                      </div>
                    </>
                  )}
                  {isDirect && (
                    <>
                      <div className="tmixed-uc-points-label">Подпишите точки:</div>
                      <div className="tmixed-uc-answer-list">
                        {task.points.map(p => (
                          <span key={p.id} className="tmixed-uc-answer-item">
                            <span className="tmixed-uc-pt-num">{p.id}.</span>
                            <span className="tmixed-uc-answer-blank" />
                          </span>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <>
          {instructionText && <div className="tmixed-instruction">{instructionText}</div>}
          <div className={`tmixed-questions${twoColumns ? ' tmixed-questions--compact' : ''}`}>
            {tasks.map((q, i) => (
              <RegularTaskRow
                key={i}
                q={q}
                globalIndex={startIndex + i}
                questionMode={questionMode}
                showWorkSpace={showWorkSpace}
                workSpaceSize={workSpaceSize}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Одна страница варианта (ученик) ──────────────────────────────────────────
function VariantPage({ variant, title, settings, mode }) {
  const { showSectionHeaders, showWorkSpace, workSpaceSize } = settings;
  const pageClass = mode === 'half'
    ? 'tmixed-page tmixed-page--half'
    : 'tmixed-page';

  // Вычисляем стартовые индексы для каждой секции (сквозная нумерация)
  let cursor = 1;
  const sectionsWithStart = variant.sections.map(sec => {
    const start = cursor;
    cursor += sec.tasks.length;
    return { ...sec, startIndex: start };
  });

  return (
    <div className={pageClass}>
      <div className="tmixed-header">
        <span className="tmixed-variant-badge">Вариант {variant.number}</span>
        <span className={`tmixed-field tmixed-field--name`}>
          ФИО: <span className="tmixed-line tmixed-line--name" />
        </span>
        <span className="tmixed-field">
          Класс: <span className="tmixed-line tmixed-line--short" />
        </span>
        <span className="tmixed-field">
          Дата: <span className="tmixed-line tmixed-line--short" />
        </span>
      </div>

      {title && <div className="tmixed-work-title">{title}</div>}

      {sectionsWithStart.map((sec, si) => (
        <SectionBlock
          key={si}
          section={sec}
          startIndex={sec.startIndex}
          showSectionHeaders={showSectionHeaders}
          showWorkSpace={showWorkSpace}
          workSpaceSize={workSpaceSize}
        />
      ))}
    </div>
  );
}

// ─── Страница ответов для учителя ─────────────────────────────────────────────
function TeacherKeyPage({ variants, title }) {
  if (!variants.length) return null;

  // Собираем секции (по id) из первого варианта — структура одинакова для всех
  const sectionIds = variants[0].sections.map(s => s.id);

  return (
    <div className="tmixed-key-page">
      <div className="tmixed-key-title">{title} — Ответы (для учителя)</div>

      {sectionIds.map(sectionId => {
        // Берём данные по секции из каждого варианта
        const sectionsByVariant = variants.map(v =>
          v.sections.find(s => s.id === sectionId)
        ).filter(Boolean);

        if (!sectionsByVariant.length) return null;
        const sec0 = sectionsByVariant[0];

        // Считаем стартовый индекс секции (сквозная нумерация)
        const sectionStarts = variants.map(v => {
          let cursor = 1;
          for (const s of v.sections) {
            if (s.id === sectionId) return cursor;
            cursor += s.tasks.length;
          }
          return cursor;
        });

        return (
          <div key={sectionId} className="tmixed-key-section">
            <div className="tmixed-key-section-name">{sec0.label}</div>

            {sec0.questionMode === 'unitcircle' ? (
              // Ключ для единичной окружности
              <div className="tmixed-key-variants-grid">
                {sectionsByVariant.map((sec, vi) => (
                  <div key={vi} className="tmixed-key-variant-block">
                    <div className="tmixed-key-variant-title">Вариант {vi + 1}</div>
                    <div className="tmixed-key-uc-grid">
                      {sec.tasks.map((task, ti) => (
                        <div key={ti} className="tmixed-key-uc-item">
                          <div className="tmixed-key-uc-label">{sectionStarts[vi] + ti})</div>
                          <div style={{ width: '52mm', height: '52mm' }}>
                            <UnitCircleSVG
                              points={task.points}
                              taskType={task.type}
                              isAnswer={true}
                              showAxes={sec.ucSettings?.showAxes ?? 'axes'}
                              showDegrees={sec.ucSettings?.showDegrees ?? false}
                              showTicks={sec.ucSettings?.showTicks ?? true}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              // Ключ для обычных заданий
              <div className="tmixed-key-variants-grid">
                {sectionsByVariant.map((sec, vi) => (
                  <div key={vi} className="tmixed-key-variant-block">
                    <div className="tmixed-key-variant-title">Вариант {vi + 1}</div>
                    {sec.tasks.map((q, qi) => {
                      const isEq = sec.questionMode === 'twoLine';
                      return (
                        <div
                          key={qi}
                          className={`tmixed-key-row${isEq ? ' tmixed-key-row--eq' : ''}`}
                        >
                          <span className="tmixed-key-label">{sectionStarts[vi] + qi})</span>
                          <span className="tmixed-key-expr">
                            <MathLine latex={q.exprLatex} />
                          </span>
                          <span className="tmixed-key-eq">{isEq ? 't =' : '='}</span>
                          <span className="tmixed-key-ans">
                            <MathLine latex={`\\color{#c0392b}{${q.resultLatex}}`} />
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Корневой компонент ────────────────────────────────────────────────────────
export default function TrigMixedPrintLayout({ variants, title, settings }) {
  if (!variants || !variants.length) return null;

  const { twoPerPage, showTeacherKey } = settings;

  let pages;
  if (twoPerPage) {
    pages = [];
    for (let i = 0; i < variants.length; i += 2) {
      const pair = variants.slice(i, i + 2);
      pages.push(
        <div key={i} style={{ pageBreakAfter: 'always', breakAfter: 'page' }}>
          {pair.map((variant, j) => (
            <VariantPage
              key={j}
              variant={variant}
              title={title}
              settings={settings}
              mode="half"
            />
          ))}
        </div>
      );
    }
  } else {
    pages = variants.map((variant, vi) => (
      <VariantPage
        key={vi}
        variant={variant}
        title={title}
        settings={settings}
        mode="full"
      />
    ));
  }

  return (
    <div className="tmixed-print-root">
      {pages}
      {showTeacherKey && (
        <TeacherKeyPage variants={variants} title={title} />
      )}
    </div>
  );
}

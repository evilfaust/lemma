import React from 'react';
import katex from 'katex';
import './FormulaSheetPrintLayout.css';

function Math({ latex }) {
  let html;
  try {
    html = katex.renderToString(latex, { throwOnError: false, displayMode: false, trust: true });
  } catch {
    html = latex;
  }
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

// ─── Строка формулы ────────────────────────────────────────────────────────────
function FormulaRow({ num, left, right, mode }) {
  const latex = mode === 'etalon'
    ? `${left} = \\boxed{${right}}`
    : `${left} =`;

  return (
    <div className="fsheet-row">
      <span className="fsheet-num">{num})</span>
      <span className="fsheet-expr"><Math latex={latex} /></span>
    </div>
  );
}

// ─── Секция ────────────────────────────────────────────────────────────────────
function Section({ section, startNum, mode }) {
  return (
    <div className="fsheet-section">
      {section.title ? <div className="fsheet-section-title">{section.title}</div> : null}
      {(section.formulas || []).map((f, fi) => (
        <FormulaRow
          key={fi}
          num={startNum + fi}
          left={f.left || ''}
          right={f.right || ''}
          mode={mode}
        />
      ))}
    </div>
  );
}

// ─── Один экземпляр ────────────────────────────────────────────────────────────
// compact=true → сокращённая шапка (4 копии на листе)
function Copy({ title, subtitle, sections, mode, twoColFormulas }) {
  const starts = [];
  let n = 1;
  for (const sec of sections) {
    starts.push(n);
    n += (sec.formulas || []).length;
  }

  return (
    <div className="fsheet-copy">
      {/* Шапка */}
      <div className="fsheet-copy-head">
        <div className="fsheet-copy-title">{title}</div>
        {subtitle && <div className="fsheet-copy-subtitle">{subtitle}</div>}
        {mode === 'blank' && (
          <div className="fsheet-copy-fields">
            <span className="fsheet-copy-field fsheet-copy-field--name">
              Имя:&nbsp;<span className="fsheet-copy-field-line fsheet-copy-field-line--name" />
            </span>
            <span className="fsheet-copy-field">
              Класс:&nbsp;<span className="fsheet-copy-field-line fsheet-copy-field-line--short" />
            </span>
            <span className="fsheet-copy-field">
              Дата:&nbsp;<span className="fsheet-copy-field-line fsheet-copy-field-line--short" />
            </span>
          </div>
        )}
      </div>

      {/* Формулы */}
      <div className={twoColFormulas ? 'fsheet-formulas fsheet-formulas--2col' : 'fsheet-formulas'}>
        {sections.map((sec, si) => (
          <Section key={si} section={sec} startNum={starts[si]} mode={mode} />
        ))}
      </div>
    </div>
  );
}

// ─── Страница ──────────────────────────────────────────────────────────────────
// copiesPerPage: 1 | 2 | 4
function SheetPage({ title, subtitle, sections, mode, copiesPerPage, pageBreak }) {
  // 1 копия → формулы в 2 колонки (чтобы уместить максимум на листе)
  // 2 или 4 → формулы в 1 колонку (каждому экземпляру не хватает ширины)
  const twoColFormulas = copiesPerPage === 1;

  const copies = Array.from({ length: copiesPerPage }, (_, i) => (
    <Copy
      key={i}
      title={title}
      subtitle={subtitle}
      sections={sections}
      mode={mode}
      twoColFormulas={twoColFormulas}
    />
  ));

  const pageClass = [
    'fsheet-page',
    `fsheet-page--${copiesPerPage}c`,
    pageBreak && 'fsheet-page--break',
  ].filter(Boolean).join(' ');

  return (
    <div className={pageClass}>
      <div className="fsheet-grid">{copies}</div>
    </div>
  );
}

// ─── Корневой компонент ────────────────────────────────────────────────────────
/**
 * FormulaSheetPrintLayout
 * title, subtitle, sections, printMode ('etalon'|'blank'|'both'), copiesPerPage (1|2|4)
 */
export default function FormulaSheetPrintLayout({
  title, subtitle, sections, printMode = 'both', copiesPerPage = 2,
}) {
  if (!sections || sections.length === 0) return null;

  const pages = [];

  if (printMode === 'etalon' || printMode === 'both') {
    pages.push(
      <SheetPage
        key="etalon"
        title={title}
        subtitle={subtitle}
        sections={sections}
        mode="etalon"
        copiesPerPage={copiesPerPage}
        pageBreak={printMode === 'both'}
      />
    );
  }

  if (printMode === 'blank' || printMode === 'both') {
    pages.push(
      <SheetPage
        key="blank"
        title={title}
        subtitle={subtitle}
        sections={sections}
        mode="blank"
        copiesPerPage={copiesPerPage}
        pageBreak={false}
      />
    );
  }

  return <div className="fsheet-print-root">{pages}</div>;
}

import WorksheetCards from '../cards/WorksheetCards';
import PrintSheet from '../../print-sheet/PrintSheet';
import SheetCryptogram from '../../print-sheet/SheetCryptogram';

export default function WorksheetPreview({
  printRef,
  variants,
  outputMode,
  // sheet
  columns,
  margins,
  pageFormat,
  figureSize,
  showFigures,
  figurePlacement,
  headerMode,
  sheetMeta,
  hideTaskPrefixes,
  variantLabel,
  showVariantLabel,
  fontScale,
  fontFamily,
  answerStyle,
  solutionSpace,
  solutionFill,
  tasksPerPage,
  showFooter,
  showTaskCode,
  showStudentInfo,
  showAnswersInline,
  showAnswersPage,
  cryptogramEnabled,
  cryptogramPhrase,
  dragDropHandlers,
  onSetFigureSize,
  onSetFigurePlacement,
  workTitle,
  // cards
  cardSettings,
  taskEditing,
}) {
  if (!variants || variants.length === 0) return null;

  if (outputMode === 'sheet') {
    return (
      <div ref={printRef}>
        <PrintSheet
          variants={variants}
          variantLabel={variantLabel || 'Вариант'}
          headerMode={headerMode}
          layout="workbook"
          columns={columns}
          margins={margins}
          pageFormat={pageFormat}
          showAnswersPage={showAnswersPage}
          meta={{
            ...sheetMeta,
            // Пустой заголовок = название работы: учителю не надо дублировать
            // его руками, но переопределить можно.
            title: sheetMeta.title || workTitle || 'Лист задач',
            showStudentFields: showStudentInfo,
            // null = авто (надпись появляется при нескольких вариантах)
            showVariant: showVariantLabel,
          }}
          options={{
            answerStyle,
            solutionSpace,
            solutionFill,
            tasksPerPage,
            hideTaskPrefixes,
            showTaskCode,
            showAnswersInline,
            fontScale,
            fontFamily,
            showFooter,
            figureSize,
            showFigures,
            figurePlacement,
          }}
          editing={{
            dragDropHandlers,
            onEditTask: taskEditing.handleEditTask,
            onReplaceTask: taskEditing.handleReplaceTask,
            onSetFigureSize,
            onSetFigurePlacement,
          }}
          renderTail={cryptogramEnabled
            ? (variant) => <SheetCryptogram variant={variant} phrase={cryptogramPhrase} />
            : null}
        />
      </div>
    );
  }

  // outputMode === 'cards' — несколько одинаковых работ на листе A4
  return (
    <div ref={printRef}>
      <WorksheetCards
        variants={variants}
        settings={cardSettings}
        title={cardSettings.title || workTitle || 'Самостоятельная работа'}
        variantLabel={variantLabel || 'Вариант'}
        editing={{
          dragDropHandlers,
          onEditTask: taskEditing.handleEditTask,
          onReplaceTask: taskEditing.handleReplaceTask,
        }}
      />
    </div>
  );
}

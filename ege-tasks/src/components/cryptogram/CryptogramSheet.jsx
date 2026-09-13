import { useMemo } from 'react';
import PrintSheet from '../print-sheet/PrintSheet';
import SheetCryptogram from '../print-sheet/SheetCryptogram';
import { buildCryptogramForVariant, normalizeCryptogramSettings } from '../../utils/cryptogram';

export const DEFAULT_INSTRUCTION = 'Решите задачи. Найдите свой ответ в таблице шифровки и '
  + 'впишите его букву в клетки с номерами, которые стоят у задачи. '
  + 'Лишние строки таблицы — обманки.';

/**
 * Печатный лист шифровки — тот же движок и то же оформление, что у входной
 * контрольной (`components/print-sheet`): монохром, шапка с полями ученика,
 * настоящая пагинация по измеренным высотам.
 *
 * Своего у шифровки два:
 *  1. номер задачи — не «1, 2, 3», а номера клеток ответа (`numberLabel`):
 *     ученик вписывает найденную букву именно туда;
 *  2. хвостовой блок с таблицей «ответ → буква» и строкой ответа.
 *
 * Компактный режим (`mode: 'duo'`) — две ОДИНАКОВЫЕ шифровки на листе A4:
 * страница движка становится половиной листа (`pageFormat='half'`), лист
 * режется поперёк по пунктиру, обе половинки раздаются разным ученикам.
 * 🚨 Шифровка для обеих копий строится ОДИН раз: порядок строк в таблице
 * перемешивается сидом от номера варианта, и пересчёт на месте сделал бы
 * половинки разными.
 */
export default function CryptogramSheet({
  tasks = [],
  phrase = '',
  title = '',
  description = '',
  settings,
  stripPrefixes = true,
  onPageCounts = null,
}) {
  const s = normalizeCryptogramSettings(settings);
  const duo = s.mode === 'duo';

  const crypt = useMemo(
    () => buildCryptogramForVariant({ variant: { tasks, number: 1 }, phrase }),
    [tasks, phrase]
  );

  // Номера клеток вместо номера задачи + буква в ключе учителя.
  const sheetTasks = useMemo(() => tasks.map((task, i) => {
    const key = crypt?.answerKey?.[i];
    const positions = key?.positions || [];
    return {
      ...task,
      numberLabel: positions.length ? positions.join(', ') : String(i + 1),
      keyBadge: key?.letter || '',
    };
  }), [tasks, crypt]);

  if (!tasks.length || !crypt?.valid) return null;

  const variants = duo
    ? [{ number: 1, tasks: sheetTasks }, { number: 2, tasks: sheetTasks }]
    : [{ number: 1, tasks: sheetTasks }];

  const instruction = s.instruction.trim() || DEFAULT_INSTRUCTION;
  const fullHeader = s.headerMode === 'full';

  const tail = () => (
    <SheetCryptogram
      crypt={crypt}
      layout="chips"
      numbered
      definition={s.showDefinition ? description : ''}
      // Подсказка в блоке нужна там, где на листе нет инструкции: при полной
      // шапке она стояла бы вторым пересказом одного и того же.
      note={fullHeader ? '' : undefined}
      title={s.cryptTitle || 'Шифровка по ответам'}
    />
  );

  return (
    <PrintSheet
      variants={variants}
      meta={{
        eyebrow: s.eyebrow,
        title: title.trim() || 'Математика',
        subtitle: s.subtitle,
        classLabel: s.classLabel,
        dateLabel: s.dateLabel,
        duration: s.duration,
        instruction: fullHeader ? instruction : '',
        notes: s.notes,
        notesTitle: s.notesTitle,
        footerNote: s.footerNote,
        showStudentFields: s.showStudentFields,
        showClassField: s.showClassField,
        showTasksCount: s.showTasksCount,
        // Копии одинаковые — «Вариант 1 / Вариант 2» на них только путал бы.
        showVariant: false,
      }}
      headerMode={s.headerMode}
      layout={s.solutionSpace === 'none' ? 'sheet' : 'workbook'}
      columns={s.columns}
      margins={s.margins}
      pageFormat={duo ? 'half' : 'a4'}
      showAnswersPage={s.showKey}
      keyExtra={(
        <div className="ps-key-extra">
          Зашифрованная фраза: <strong>{crypt.normalizedPhrase}</strong>
        </div>
      )}
      options={{
        answerStyle: s.answerStyle,
        solutionSpace: s.solutionSpace,
        solutionFill: s.solutionFill,
        hideTaskPrefixes: stripPrefixes,
        fontScale: s.fontScale,
        fontFamily: s.fontFamily,
        showFooter: s.showFooter,
        figureSize: s.figureSize,
        showFigures: s.showFigures,
      }}
      renderTail={tail}
      onPageCounts={onPageCounts}
    />
  );
}

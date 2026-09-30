import { forwardRef, lazy, Suspense } from 'react';
import { Input } from 'antd';
import { imageFilesFrom } from '../../utils/imageSnippet';

const { TextArea } = Input;

// CodeMirror и его расширения тянутся отдельным чанком только когда
// учитель реально включил «Расширенный редактор» (mode='code').
const LatexCodeMirror = lazy(() => import('./LatexCodeMirror'));

/**
 * Единое поле ввода LaTeX/markdown с двумя режимами:
 *  - mode='plain' (по умолчанию) — обычный Ant Input.TextArea (привычное поведение);
 *  - mode='code'  — CodeMirror 6 c подсветкой markdown, переносом строк,
 *                   авторазмером и встроенным поиском/заменой (Ctrl+F / Ctrl+H).
 *
 * Используется внутри Form.Item: Form инжектит `value` и `onChange`.
 * `onTextChange(value)` — отдельный колбэк для побочных эффектов (предпросмотр),
 * не конфликтует с Form (тот управляет своим onChange).
 *
 * ref форвардится на нативный <textarea> только в plain-режиме — это нужно
 * существующей логике конвертации в таблицу (чтение выделения). В code-режиме
 * ref недоступен → конвертация работает по всему полю (приемлемая деградация).
 *
 * `onCaret({start, end})` работает в ОБОИХ режимах: тулбару нужно знать, куда
 * вставлять сниппет и не стоит ли курсор внутри готового чертежа (тогда кнопка
 * открывает его правку). Значение сохраняется и после потери фокуса — клик по
 * кнопке тулбара уводит фокус из поля, живого выделения там уже нет.
 *
 * `onImageFiles(files)` — картинку вставили из буфера (скриншот, Ctrl+V) или
 * бросили на поле: браузер сам её не вставит, поэтому поле отдаёт файлы наружу
 * (useFieldInserts грузит их в Библиотеку и вставляет ссылку).
 */
const LatexField = forwardRef(function LatexField(
  { mode = 'plain', value, onChange, onTextChange, onCaret, onImageFiles, rows = 4, placeholder = '' },
  ref,
) {
  if (mode === 'code') {
    return (
      <Suspense
        fallback={(
          <TextArea rows={rows} value={value} placeholder="Загрузка редактора…" disabled />
        )}
      >
        <LatexCodeMirror
          value={value || ''}
          onChange={(val) => {
            onChange?.(val);
            onTextChange?.(val);
          }}
          onCaret={onCaret}
          onImageFiles={onImageFiles}
          placeholder={placeholder}
          minRows={rows}
        />
      </Suspense>
    );
  }

  const reportCaret = onCaret
    ? (e) => onCaret({ start: e.target.selectionStart, end: e.target.selectionEnd })
    : undefined;

  const takeImages = onImageFiles
    ? (dataTransfer, e) => {
      const files = imageFilesFrom(dataTransfer);
      if (!files.length) return;
      e.preventDefault();
      reportCaret?.(e);
      onImageFiles(files);
    }
    : null;

  return (
    <TextArea
      ref={ref}
      rows={rows}
      value={value}
      placeholder={placeholder}
      onChange={(e) => {
        onChange?.(e);
        onTextChange?.(e.target.value);
        reportCaret?.(e);
      }}
      onSelect={reportCaret}
      onClick={reportCaret}
      onKeyUp={reportCaret}
      onPaste={takeImages ? (e) => takeImages(e.clipboardData, e) : undefined}
      onDrop={takeImages ? (e) => takeImages(e.dataTransfer, e) : undefined}
    />
  );
});

export default LatexField;

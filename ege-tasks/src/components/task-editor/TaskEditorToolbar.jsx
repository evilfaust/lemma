import FieldInsertToolbar from '../shared/FieldInsertToolbar';
import FieldHelp from '../shared/FieldHelp';
import TableModifiersHelp from '../shared/TableModifiersHelp';

const INSERT_ITEMS = ['table', 'image', 'numline', 'plot', 'chart', 'vectors', 'grid', 'planim', 'stereo'];
const ROOT_ITEMS = ['roots'];

/** Открытая панель: вставка и обработка разделены, обработчики — общие. */
export default function TaskEditorToolbar({ tools, field, rootsLabel, conversions, extraProcessing, label }) {
  return (
    <span className="task-editor-toolbar" role="group" aria-label={label}>
      <span className="task-editor-toolbar-row">
        <span className="task-editor-toolbar-caption">Вставка</span>
        <span className="task-editor-toolbar-actions">
          <FieldInsertToolbar tools={tools} field={field} items={INSERT_ITEMS} compact />
        </span>
      </span>
      <span className="task-editor-toolbar-row">
        <span className="task-editor-toolbar-caption">Обработка</span>
        <span className="task-editor-toolbar-actions">
          {conversions}
          <FieldInsertToolbar tools={tools} field={field} items={ROOT_ITEMS} rootsLabel={rootsLabel} compact />
          {extraProcessing}
          <span className="task-editor-toolbar-help">
            <TableModifiersHelp label="Виды таблиц" onInsert={(md) => tools.insertSnippet(field, md)} />
            <FieldHelp label="Справка" onInsert={(md) => tools.insertSnippet(field, md)} />
          </span>
        </span>
      </span>
    </span>
  );
}

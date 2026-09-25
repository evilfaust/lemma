import { useState } from 'react';
import { Segmented } from 'antd';
import { SolutionOutlined } from '@ant-design/icons';
import ExternalJournal from './ExternalJournal';
import ClassJournal from './journal/ClassJournal';
import { WorkspacePageHeader } from './ui';

/**
 * Журнал (`/app/journal`): журнал класса (ручные отметки за бумажные работы +
 * онлайн-работы Lemma, v3.9.236) и внешние работы «Решу ЕГЭ».
 */
export default function GradeJournal() {
  const [view, setView] = useState('class'); // class | ext

  return (
    <div>
      <WorkspacePageHeader
        icon={<SolutionOutlined />}
        accent="teal"
        title="Журнал"
        subtitle={view === 'class'
          ? 'Бумажные проверки и онлайн-работы в одной таблице'
          : 'Внешние работы с решу.ЕГЭ (из приложения «Журнал ЕГЭ»)'}
        extra={(
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { value: 'class', label: 'Журнал класса' },
              { value: 'ext', label: 'Решу (внешние)' },
            ]}
          />
        )}
      />
      {view === 'ext' ? <ExternalJournal /> : <ClassJournal />}
    </div>
  );
}

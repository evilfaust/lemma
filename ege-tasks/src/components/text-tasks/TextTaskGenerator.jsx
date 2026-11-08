import { useState } from 'react';
import { App, Button, Checkbox, Form, InputNumber } from 'antd';
import { PrinterOutlined, ProfileOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { useSheetStorage } from '../../hooks/useSheetStorage';
import { getSheetGenerator } from '../../utils/sheetRegistry';
import { plannedTotal } from '../../utils/questionPlan';
import { printPaged } from '../../utils/printPage';
import PrintSheet from '../print-sheet/PrintSheet';
import { CategoryChecklist } from '../trig/CategoryChecklist';
import { SheetStorageActions } from '../trig/SheetStorageActions';
import {
  TrigActions, TrigGeneratorLayout, TrigPreviewPane, TrigSettingsSection, TrigStatBadge,
} from '../trig/TrigGeneratorLayout';

const DEFAULT_SETTINGS = {
  categoryCounts: {},
  questionsCount: 10,
  variantsCount: 1,
  showAnswers: false,
};

export default function TextTaskGenerator({ generator, examNumber }) {
  const { message } = App.useApp();
  const { label, categoryLabels, categoryGroups, generate: generateVariants } = getSheetGenerator(generator);
  const types = Object.keys(categoryLabels);
  const groups = categoryGroups || [{ label: `Типы задач · ЕГЭ база №${examNumber}`, keys: types }];
  const defaults = { ...DEFAULT_SETTINGS, categories: { [types[0]]: true } };
  const [title, setTitle] = useState(label);
  const [settings, setSettings] = useState(defaults);
  const [tasksData, setTasksData] = useState(null);
  const storage = useSheetStorage({
    generator, title, settings, tasksData,
    onLoad: sheet => {
      setTitle(sheet.title || label);
      setSettings({ ...defaults, ...sheet.settings });
      setTasksData(sheet.tasksData);
    },
  });
  const { categories, categoryCounts, questionsCount, variantsCount, showAnswers } = settings;
  const plannedCount = plannedTotal(categories, questionsCount, categoryCounts);
  const canGenerate = Number.isInteger(questionsCount) && questionsCount >= 1 && questionsCount <= 16
    && Number.isInteger(variantsCount) && variantsCount >= 1 && variantsCount <= 10
    && plannedCount > 0 && plannedCount <= 30;
  const variants = tasksData?.map((tasks, index) => ({ number: index + 1, tasks }));

  const update = (name, value) => setSettings(previous => ({ ...previous, [name]: value }));

  function generate() {
    try {
      setTasksData(generateVariants(settings));
      storage.detach();
    } catch (error) {
      message.error(error.message);
    }
  }

  return (
    <TrigGeneratorLayout
      icon={<ProfileOutlined />}
      title={title}
      onTitleChange={setTitle}
      left={
        <div className="no-print" style={{ display: 'grid', gap: 10 }}>
          {groups.map(group => (
            <TrigSettingsSection key={group.label} label={group.label}>
              <CategoryChecklist
                keys={group.keys} labels={categoryLabels} categories={categories} counts={categoryCounts}
                onToggle={(type, checked) => update('categories', { ...categories, [type]: checked })}
                onCount={(type, count) => update('categoryCounts', { ...categoryCounts, [type]: count })}
              />
            </TrigSettingsSection>
          ))}
          <TrigSettingsSection label="Параметры">
            <Form layout="vertical">
              <Form.Item label="Заданий в варианте" htmlFor="text-task-questions">
                <InputNumber id="text-task-questions" value={questionsCount} min={1} max={16}
                  precision={0} onChange={value => update('questionsCount', value)} />
              </Form.Item>
              <Form.Item label="Количество вариантов" htmlFor="text-task-variants" style={{ marginBottom: 8 }}>
                <InputNumber id="text-task-variants" value={variantsCount} min={1} max={10}
                  precision={0} onChange={value => update('variantsCount', value)} />
              </Form.Item>
            </Form>
            {plannedCount > 30 && <div role="alert">Уменьшите квоты до 30 заданий на вариант.</div>}
          </TrigSettingsSection>
          <TrigSettingsSection label="Печать и вид">
            <Checkbox checked={showAnswers} onChange={event => update('showAnswers', event.target.checked)}>
              Лист ответов
            </Checkbox>
          </TrigSettingsSection>
          <TrigActions>
            <Button type="primary" icon={<ThunderboltOutlined />} onClick={generate} disabled={!canGenerate}>
              Сформировать
            </Button>
            <Button icon={<PrinterOutlined />} onClick={() => printPaged()} disabled={!variants}>Печать</Button>
            <SheetStorageActions storage={storage} hasData={Boolean(variants)} generator={generator} exportMdFormat="work" />
          </TrigActions>
        </div>
      }
      right={
        <TrigPreviewPane
          hasData={Boolean(variants)}
          emptyIcon={<ProfileOutlined />}
          emptyTitle="Выберите типы задач и нажмите «Сформировать»"
          summary={[
            <TrigStatBadge key="tasks">{tasksData?.[0]?.length ?? plannedCount} зад.</TrigStatBadge>,
            <TrigStatBadge key="variants" tone="success">{tasksData?.length ?? variantsCount} вар.</TrigStatBadge>,
          ]}
        >
          {variants && <PrintSheet
            variants={variants} meta={{ title: title.trim() || label, showStudentFields: true }}
            showAnswersPage={showAnswers}
          />}
        </TrigPreviewPane>
      }
    />
  );
}

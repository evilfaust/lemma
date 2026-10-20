import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, Button, Spin } from 'antd';
import { DatabaseOutlined, ReloadOutlined, UnorderedListOutlined, ImportOutlined } from '@ant-design/icons';
import { api } from '../../services/pocketbase';
import { useReferenceData } from '../../contexts/ReferenceDataContext';
import { useAuth } from '../../contexts/AuthContext';
import { invalidateTaskStats } from '../../hooks/useTaskStats';
import { WorkspacePageHeader } from '../workspace/ui';
import { normalizeLabel, normalizeStatementStrict, normalizeStatementLoose } from '../../utils/normalize';
import {
  countSnapshot, topicRows as buildTopicRows, subtopicRows as buildSubtopicRows,
  tagRows as buildTagRows, sourceRows as buildSourceRows,
} from '../../utils/taskBank';
import BankOverview, { invalidateBankData } from './BankOverview';
import TopicTab from '../catalog/TopicTab';
import SubtopicTab from '../catalog/SubtopicTab';
import TagTab from '../catalog/TagTab';
import SourceTab from '../catalog/SourceTab';
import DuplicateTab from '../catalog/DuplicateTab';
import VectorDuplicatesTab from '../catalog/VectorDuplicatesTab';
import MergeModal from '../catalog/MergeModal';
import './bank.css';

const TABS = ['overview', 'topics', 'subtopics', 'tags', 'sources', 'duplicates', 'vec-duplicates'];

const fmt = (n) => Number(n || 0).toLocaleString('ru-RU');

// Группы записей с одинаковым (нормализованным) названием.
function sameNameGroups(items, getLabel) {
  const map = new Map();
  items.forEach((item) => {
    const key = normalizeLabel(getLabel(item));
    if (!key) return;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  });
  return [...map.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([key, list]) => ({ key, items: list }));
}

function statementGroups(tasks, normalize) {
  const map = new Map();
  tasks.forEach((task) => {
    const key = normalize(task.statement_md);
    if (!key) return;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(task);
  });
  return [...map.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([key, list]) => ({ key, items: list }));
}

/**
 * «Банк задач» (v3.9.387) — бывшие «Аналитика» и «Каталог» одним разделом.
 * Первая вкладка — «Обзор» (что с банком), остальные — как это исправить.
 * Вкладка живёт в адресе (`?tab=topics`), чтобы на неё можно было сослаться.
 */
export default function TaskBank({ onOpenTasks, onOpenWork, onOpenImport }) {
  const {
    topics, subtopics, tags, sources, tasksSnapshot,
    loading: refLoading, reloadData,
  } = useReferenceData();
  const { canEdit } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = TABS.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'overview';
  const [reloadKey, setReloadKey] = useState(0);

  const [merge, setMerge] = useState(null); // { type, from }

  // Условия задач для поиска дублей — только по заходу на вкладку «Дубли».
  const [dupTasks, setDupTasks] = useState(null);
  const [dupLoading, setDupLoading] = useState(false);
  const loadDupTasks = useCallback(async () => {
    if (dupTasks !== null || dupLoading) return;
    setDupLoading(true);
    try {
      setDupTasks(await api.getTasksForDuplicateCheck());
    } finally {
      setDupLoading(false);
    }
  }, [dupTasks, dupLoading]);

  const counts = useMemo(() => countSnapshot(tasksSnapshot), [tasksSnapshot]);
  const topicRows = useMemo(() => buildTopicRows(topics, counts), [topics, counts]);
  const subtopicRows = useMemo(() => buildSubtopicRows(subtopics, topics, counts), [subtopics, topics, counts]);
  const tagRows = useMemo(() => buildTagRows(tags, counts), [tags, counts]);
  const sourceRows = useMemo(() => buildSourceRows(sources, counts), [sources, counts]);

  const duplicateGroups = useMemo(() => ({
    topicsDup: sameNameGroups(topics, (t) => t.title),
    subtopicsDup: sameNameGroups(subtopics, (st) => st.name || st.title),
    tagsDup: sameNameGroups(tags, (t) => t.title),
    sourcesDup: sameNameGroups(sourceRows, (s) => s.source),
    strictTasks: dupTasks ? statementGroups(dupTasks, normalizeStatementStrict) : [],
    looseTasks: dupTasks ? statementGroups(dupTasks, normalizeStatementLoose) : [],
  }), [topics, subtopics, tags, sourceRows, dupTasks]);

  const nameDuplicates = duplicateGroups.topicsDup.length + duplicateGroups.subtopicsDup.length
    + duplicateGroups.tagsDup.length + duplicateGroups.sourcesDup.length;

  const setTab = useCallback((key) => {
    const next = new URLSearchParams(searchParams);
    if (key === 'overview') next.delete('tab'); else next.set('tab', key);
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  // Условия грузим, когда открыта вкладка «Дубли» (в том числе по ссылке).
  useEffect(() => {
    if (tab === 'duplicates') loadDupTasks();
  }, [tab, loadDupTasks]);

  const reloadAll = useCallback(() => {
    setDupTasks(null);
    invalidateBankData();
    invalidateTaskStats();
    setReloadKey((k) => k + 1);
    reloadData();
  }, [reloadData]);

  const openTasks = useCallback((filters) => onOpenTasks?.(filters), [onOpenTasks]);
  const openMerge = useCallback((type, from) => setMerge({ type, from }), []);

  const subtitle = refLoading && !tasksSnapshot.length
    ? 'Загружаю банк…'
    : `${fmt(counts.total)} задач · ${fmt(topics.length)} тем · ${fmt(subtopics.length)} подтем · ${fmt(tags.length)} тегов · ${fmt(sourceRows.length)} источников`;

  const label = (text, n) => (
    <span className="bank-tab">{text}{n != null && <span className="bank-tab__n">{fmt(n)}</span>}</span>
  );

  const items = [
    {
      key: 'overview',
      label: 'Обзор',
      children: (
        <BankOverview
          key={reloadKey}
          counts={counts}
          topicRows={topicRows}
          sourceRows={sourceRows}
          nameDuplicates={nameDuplicates}
          onOpenTasks={openTasks}
          onTab={setTab}
        />
      ),
    },
    { key: 'topics', label: label('Темы', topics.length), children: <TopicTab topicRows={topicRows} tasksSnapshot={tasksSnapshot} onOpenTasks={openTasks} onMerge={openMerge} onReload={reloadAll} /> },
    { key: 'subtopics', label: label('Подтемы', subtopics.length), children: <SubtopicTab subtopicRows={subtopicRows} tasksSnapshot={tasksSnapshot} onOpenTasks={openTasks} onMerge={openMerge} onReload={reloadAll} /> },
    { key: 'tags', label: label('Теги', tags.length), children: <TagTab tagRows={tagRows} tasksSnapshot={tasksSnapshot} onOpenTasks={openTasks} onMerge={openMerge} onReload={reloadAll} /> },
    { key: 'sources', label: label('Источники', sourceRows.length), children: <SourceTab sourceRows={sourceRows} tasksSnapshot={tasksSnapshot} onOpenTasks={openTasks} onMerge={openMerge} onReload={reloadAll} /> },
    {
      key: 'duplicates',
      label: label('Дубли', nameDuplicates || null),
      children: dupLoading
        ? <div className="bank-loading"><Spin /></div>
        : <DuplicateTab duplicateGroups={duplicateGroups} onOpenTasks={openTasks} onMerge={openMerge} />,
    },
    { key: 'vec-duplicates', label: 'Похожие (вектор)', children: <VectorDuplicatesTab onOpenTasks={openTasks} onOpenWork={onOpenWork} /> },
  ];

  return (
    <div className="bank-page">
      <WorkspacePageHeader
        icon={<DatabaseOutlined />}
        accent="blue"
        title="Банк задач"
        subtitle={subtitle}
        extra={(
          <>
            <Button icon={<UnorderedListOutlined />} onClick={() => openTasks(null)}>Все задачи</Button>
            {canEdit && onOpenImport && (
              <Button icon={<ImportOutlined />} onClick={onOpenImport}>Импорт</Button>
            )}
            <Button icon={<ReloadOutlined />} onClick={reloadAll} loading={refLoading}>Обновить</Button>
          </>
        )}
      />

      {refLoading && !tasksSnapshot.length ? (
        <div className="bank-loading"><Spin size="large" /></div>
      ) : (
        <Tabs className="bank-tabs" activeKey={tab} onChange={setTab} items={items} />
      )}

      <MergeModal
        open={!!merge}
        mergeType={merge?.type}
        mergeFrom={merge?.from}
        sourceRows={sourceRows}
        tasksSnapshot={tasksSnapshot}
        onClose={() => setMerge(null)}
        onReload={reloadAll}
      />
    </div>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { App, Button, Modal, Select, Space, Spin, Tag, Tooltip, Typography } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { api } from '../services/pocketbase';
import { useReferenceData } from '../contexts/ReferenceDataContext';
import MathRenderer from '../shared/components/MathRenderer';

const { Text, Title } = Typography;

// Цветовая шкала: 0% → красный, 50% → жёлтый, 100% → зелёный, null → серый
function percentToColor(pct) {
  if (pct === null || pct === undefined) return '#e8e8e8';
  const clamped = Math.max(0, Math.min(100, pct));
  if (clamped >= 70) {
    // жёлтый → зелёный
    const t = (clamped - 70) / 30;
    const r = Math.round(250 * (1 - t) + 82 * t);
    const g = Math.round(173 * (1 - t) + 196 * t);
    const b = Math.round(20 * (1 - t) + 26 * t);
    return `rgb(${r},${g},${b})`;
  } else {
    // красный → жёлтый
    const t = clamped / 70;
    const r = Math.round(255 * (1 - t) + 250 * t);
    const g = Math.round(77 * (1 - t) + 173 * t);
    const b = Math.round(79 * (1 - t) + 20 * t);
    return `rgb(${r},${g},${b})`;
  }
}

function textColor(pct) {
  if (pct === null || pct === undefined) return '#999';
  return pct >= 50 ? '#fff' : '#fff';
}

// SVG-матрица
function HeatmapSVG({ students, topics, matrix, onCellClick }) {
  const CELL_W = 48;
  const CELL_H = 36;
  const LABEL_W = 160;
  const HEADER_H = 100;
  const GAP = 1;

  const svgWidth = LABEL_W + topics.length * (CELL_W + GAP);
  const svgHeight = HEADER_H + students.length * (CELL_H + GAP);

  return (
    <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 600 }}>
      <svg
        width={svgWidth}
        height={svgHeight}
        style={{ display: 'block', fontFamily: 'inherit' }}
      >
        {/* Заголовки тем (диагональный текст) */}
        {topics.map((topic, tIdx) => {
          const x = LABEL_W + tIdx * (CELL_W + GAP) + CELL_W / 2;
          return (
            <g key={topic.id} transform={`translate(${x}, ${HEADER_H - 8})`}>
              <text
                transform="rotate(-45)"
                textAnchor="start"
                fontSize={11}
                fill="#444"
                style={{ userSelect: 'none' }}
              >
                {topic.title.length > 20 ? topic.title.slice(0, 18) + '…' : topic.title}
              </text>
            </g>
          );
        })}

        {/* Строки учеников */}
        {students.map((student, sIdx) => {
          const y = HEADER_H + sIdx * (CELL_H + GAP);
          return (
            <g key={student.name}>
              {/* Имя ученика */}
              <text
                x={LABEL_W - 8}
                y={y + CELL_H / 2 + 4}
                textAnchor="end"
                fontSize={12}
                fill="#333"
                style={{ userSelect: 'none' }}
              >
                {student.name.length > 20 ? student.name.slice(0, 18) + '…' : student.name}
              </text>

              {/* Ячейки */}
              {topics.map((topic, tIdx) => {
                const x = LABEL_W + tIdx * (CELL_W + GAP);
                const pct = matrix[student.name]?.[topic.id] ?? null;
                const bg = percentToColor(pct);
                const fg = textColor(pct);
                const hasData = pct !== null;

                return (
                  <g
                    key={topic.id}
                    style={{ cursor: hasData ? 'pointer' : 'default' }}
                    onClick={() => hasData && onCellClick(student, topic)}
                  >
                    <rect
                      x={x} y={y}
                      width={CELL_W} height={CELL_H}
                      fill={bg}
                      rx={3}
                    />
                    {hasData && (
                      <text
                        x={x + CELL_W / 2}
                        y={y + CELL_H / 2 + 4}
                        textAnchor="middle"
                        fontSize={11}
                        fontWeight="600"
                        fill={fg}
                        style={{ userSelect: 'none' }}
                      >
                        {pct}%
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// Легенда
function LegendBar() {
  const steps = [0, 25, 50, 75, 100];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#666' }}>
      <span>0%</span>
      {steps.map((pct, i) => (
        <div
          key={pct}
          style={{
            width: 28,
            height: 16,
            background: percentToColor(pct),
            borderRadius: 3,
          }}
        />
      ))}
      <span>100%</span>
      <div
        style={{
          width: 28, height: 16,
          background: '#e8e8e8',
          borderRadius: 3,
          marginLeft: 8,
        }}
      />
      <span>нет данных</span>
    </div>
  );
}

export default function ErrorHeatmap() {
  const { message } = App.useApp();
  const { topics } = useReferenceData();

  const [works, setWorks] = useState([]);
  const [selectedWorkIds, setSelectedWorkIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [worksLoading, setWorksLoading] = useState(true);

  // Результат агрегации
  const [students, setStudents] = useState([]); // [{name, id?}]
  const [activeTopics, setActiveTopics] = useState([]); // темы с данными
  const [matrix, setMatrix] = useState({}); // {studentName: {topicId: percent}}
  const [answersMap, setAnswersMap] = useState({}); // {studentName+topicId: [{task, is_correct}]}

  // Детальный модал
  const [cellModal, setCellModal] = useState(null); // {student, topic}
  const [cellAnswers, setCellAnswers] = useState([]);
  const [cellLoading, setCellLoading] = useState(false);

  // Загрузка списка работ
  useEffect(() => {
    (async () => {
      setWorksLoading(true);
      try {
        const data = await api.getWorks({ includeArchived: false });
        setWorks(data);
      } finally {
        setWorksLoading(false);
      }
    })();
  }, []);

  const loadHeatmap = useCallback(async () => {
    if (!selectedWorkIds.length) return;
    setLoading(true);
    try {
      // 1. Получаем сессии по работам
      const allSessions = [];
      for (const workId of selectedWorkIds) {
        const sessions = await api.getSessionsByWork(workId);
        allSessions.push(...sessions);
      }
      const sessionIds = allSessions.map(s => s.id);
      if (!sessionIds.length) {
        setStudents([]);
        setMatrix({});
        setActiveTopics([]);
        return;
      }

      // 2. Получаем попытки (только submitted/corrected)
      const attempts = await api.getAttemptsBySessionsWithStudent(sessionIds);
      const submitted = attempts.filter(a => a.status === 'submitted' || a.status === 'corrected');
      if (!submitted.length) {
        setStudents([]);
        setMatrix({});
        setActiveTopics([]);
        return;
      }

      // 3. Получаем ответы с expand task.topic
      const attemptIds = submitted.map(a => a.id);
      const answers = await api.getAttemptAnswersByAttempts(attemptIds);

      // 4. Строим индекс attemptId → studentName
      const attemptToStudent = {};
      for (const a of submitted) {
        attemptToStudent[a.id] = a.student_name || a.student || '(без имени)';
      }

      // 5. Агрегируем: studentName × topicId → {correct, total}
      const agg = {}; // {studentName: {topicId: {correct, total, wrongAnswers:[]}}}
      const topicIdsFound = new Set();

      for (const ans of answers) {
        const studentName = attemptToStudent[ans.attempt];
        if (!studentName) continue;
        const topicId = ans.expand?.task?.topic;
        if (!topicId) continue;

        topicIdsFound.add(topicId);
        if (!agg[studentName]) agg[studentName] = {};
        if (!agg[studentName][topicId]) agg[studentName][topicId] = { correct: 0, total: 0 };
        agg[studentName][topicId].total += 1;
        if (ans.is_correct) agg[studentName][topicId].correct += 1;
      }

      // 6. Строим матрицу процентов
      const pctMatrix = {};
      for (const [name, topicsData] of Object.entries(agg)) {
        pctMatrix[name] = {};
        for (const [tid, { correct, total }] of Object.entries(topicsData)) {
          pctMatrix[name][tid] = total > 0 ? Math.round((correct / total) * 100) : null;
        }
      }

      // 7. Активные темы (только те, по которым есть данные), в порядке как в topics
      const found = topics.filter(t => topicIdsFound.has(t.id));

      // 8. Сортируем учеников по имени
      const studentList = Object.keys(agg).sort().map(name => ({ name }));

      setStudents(studentList);
      setActiveTopics(found);
      setMatrix(pctMatrix);

      // Сохраняем raw ответы для детального модала
      const rawMap = {};
      for (const ans of answers) {
        const studentName = attemptToStudent[ans.attempt];
        const topicId = ans.expand?.task?.topic;
        if (!studentName || !topicId) continue;
        const key = `${studentName}__${topicId}`;
        if (!rawMap[key]) rawMap[key] = [];
        rawMap[key].push(ans);
      }
      setAnswersMap(rawMap);
    } catch (err) {
      console.error('Error loading heatmap:', err);
      message.error('Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  }, [selectedWorkIds, topics, message]);

  // Детальный модал при клике на ячейку
  const handleCellClick = useCallback((student, topic) => {
    const key = `${student.name}__${topic.id}`;
    const cellData = answersMap[key] || [];
    setCellModal({ student, topic });
    setCellAnswers(cellData);
  }, [answersMap]);

  const workOptions = useMemo(() =>
    works.map(w => ({ label: w.title || `Работа ${w.id}`, value: w.id })),
    [works]
  );

  // Средний % по теме (нижняя строка)
  const topicAvg = useMemo(() => {
    const result = {};
    for (const topic of activeTopics) {
      const vals = students
        .map(s => matrix[s.name]?.[topic.id])
        .filter(v => v !== null && v !== undefined);
      result[topic.id] = vals.length > 0
        ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
        : null;
    }
    return result;
  }, [activeTopics, students, matrix]);

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <Title level={4} style={{ margin: 0 }}>Тепловая карта ошибок</Title>
      </div>

      {/* Фильтры */}
      <Space style={{ marginBottom: 16 }} wrap>
        <Select
          mode="multiple"
          placeholder={worksLoading ? 'Загрузка работ…' : 'Выберите работу(ы)'}
          loading={worksLoading}
          options={workOptions}
          value={selectedWorkIds}
          onChange={setSelectedWorkIds}
          style={{ minWidth: 320 }}
          maxTagCount={3}
        />
        <Button
          type="primary"
          icon={<ReloadOutlined />}
          onClick={loadHeatmap}
          loading={loading}
          disabled={!selectedWorkIds.length}
        >
          Построить
        </Button>
      </Space>

      {/* Тепловая карта */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 64 }}><Spin size="large" /></div>
      ) : students.length > 0 ? (
        <>
          <LegendBar />
          <div style={{ marginTop: 12 }}>
            <HeatmapSVG
              students={students}
              topics={activeTopics}
              matrix={matrix}
              onCellClick={handleCellClick}
            />
          </div>

          {/* Средние по темам */}
          <div style={{ marginTop: 8, fontSize: 12, color: '#888' }}>
            <strong>Средний %:</strong>{' '}
            {activeTopics.map(t => (
              <Tag
                key={t.id}
                color={
                  topicAvg[t.id] === null ? 'default' :
                  topicAvg[t.id] >= 70 ? 'success' :
                  topicAvg[t.id] >= 40 ? 'warning' : 'error'
                }
                style={{ marginBottom: 4 }}
              >
                {t.title.slice(0, 15)}{t.title.length > 15 ? '…' : ''}: {topicAvg[t.id] ?? '—'}%
              </Tag>
            ))}
          </div>
        </>
      ) : selectedWorkIds.length > 0 && !loading ? (
        <div style={{ color: '#999', padding: 32, textAlign: 'center' }}>
          Нет данных по выбранным работам (нет завершённых попыток)
        </div>
      ) : (
        <div style={{ color: '#bbb', padding: 32, textAlign: 'center' }}>
          Выберите работу(ы) и нажмите «Построить»
        </div>
      )}

      {/* Детальный модал */}
      <Modal
        title={
          cellModal
            ? `${cellModal.student.name} — ${cellModal.topic.title}`
            : ''
        }
        open={!!cellModal}
        onCancel={() => setCellModal(null)}
        footer={<Button onClick={() => setCellModal(null)}>Закрыть</Button>}
        width={600}
      >
        {cellAnswers.length === 0 ? (
          <Text type="secondary">Нет ответов по этой теме</Text>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {cellAnswers.map((ans, i) => (
              <div
                key={ans.id}
                style={{
                  padding: '10px 14px',
                  borderRadius: 8,
                  background: ans.is_correct ? '#f6ffed' : '#fff2f0',
                  border: `1px solid ${ans.is_correct ? '#b7eb8f' : '#ffccc7'}`,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text strong style={{ fontSize: 13 }}>Задача {i + 1}</Text>
                  <Tag color={ans.is_correct ? 'success' : 'error'}>
                    {ans.is_correct ? '✓ Верно' : '✗ Неверно'}
                  </Tag>
                </div>
                {ans.expand?.task?.statement_md && (
                  <div style={{ fontSize: 13, marginBottom: 4 }}>
                    <MathRenderer content={ans.expand.task.statement_md.slice(0, 200)} />
                  </div>
                )}
                <div style={{ fontSize: 12, color: '#666' }}>
                  Ответ ученика: <code>{ans.answer_raw || '—'}</code>
                  {ans.expand?.task?.answer && (
                    <> · Правильный: <code>{ans.expand.task.answer}</code></>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}

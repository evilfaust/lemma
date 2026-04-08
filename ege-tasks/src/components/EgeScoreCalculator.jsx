import { useState } from 'react';
import { Card, Typography, Divider, Tooltip, InputNumber, Slider, Row, Col, Space } from 'antd';
import { CheckOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

// Структура заданий профильного ЕГЭ по математике
const TASKS = [
  { num: 1,  max: 1, part: 1 },
  { num: 2,  max: 1, part: 1 },
  { num: 3,  max: 1, part: 1 },
  { num: 4,  max: 1, part: 1 },
  { num: 5,  max: 1, part: 1 },
  { num: 6,  max: 1, part: 1 },
  { num: 7,  max: 1, part: 1 },
  { num: 8,  max: 1, part: 1 },
  { num: 9,  max: 1, part: 1 },
  { num: 10, max: 1, part: 1 },
  { num: 11, max: 1, part: 1 },
  { num: 12, max: 1, part: 1 },
  { num: 13, max: 2, part: 2 },
  { num: 14, max: 3, part: 2 },
  { num: 15, max: 2, part: 2 },
  { num: 16, max: 2, part: 2 },
  { num: 17, max: 3, part: 2 },
  { num: 18, max: 4, part: 2 },
  { num: 19, max: 4, part: 2 },
];

const MAX_PRIMARY = TASKS.reduce((s, t) => s + t.max, 0); // 31

// Шкала перевода первичных → тестовые баллы (профильная математика 2025)
const SCALE = [
  0,  // 0
  6,  // 1
  11, // 2
  17, // 3
  22, // 4
  27, // 5  ← минимум для аттестата
  34, // 6
  40, // 7
  46, // 8  ← тройка → четвёрка
  52, // 9
  58, // 10
  64, // 11 ← четвёрка → пятёрка
  70, // 12
  72, // 13
  74, // 14
  76, // 15
  78, // 16
  80, // 17
  82, // 18
  84, // 19
  86, // 20
  88, // 21
  90, // 22
  92, // 23
  94, // 24
  95, // 25
  96, // 26
  97, // 27
  98, // 28
  99, // 29
  100,// 30
  100,// 31
  100,// 32
];

function toTestScore(primary) {
  if (primary < 0) return 0;
  if (primary >= SCALE.length) return 100;
  return SCALE[primary];
}

function getGradeInfo(test) {
  if (test < 27)  return { color: '#ff4d4f', bg: '#fff1f0' };
  if (test <= 44) return { color: '#fa8c16', bg: '#fff7e6' };
  if (test <= 60) return { color: '#1677ff', bg: '#e6f4ff' };
  return           { color: '#52c41a', bg: '#f6ffed' };
}

// Цвет квадратика по заполненности
function getTileColor(score, max) {
  if (score === 0)   return { bg: '#f0f0f0', text: '#bbb', border: '#d9d9d9' };
  if (score === max) return { bg: '#f6ffed', text: '#52c41a', border: '#b7eb8f' };
  return               { bg: '#fff7e6', text: '#fa8c16', border: '#ffd591' };
}

// Точки-индикаторы для многобалльных заданий
function ScoreDots({ score, max }) {
  return (
    <div style={{ display: 'flex', gap: 3, justifyContent: 'center', flexWrap: 'wrap', maxWidth: 44 }}>
      {Array.from({ length: max }).map((_, i) => (
        <div
          key={i}
          style={{
            width: max <= 2 ? 8 : 7,
            height: max <= 2 ? 8 : 7,
            borderRadius: '50%',
            background: i < score ? (score === max ? '#52c41a' : '#fa8c16') : '#d9d9d9',
            transition: 'background 0.15s',
          }}
        />
      ))}
    </div>
  );
}

function TaskTile({ task, score, onClick }) {
  const { num, max, part } = task;
  const colors = getTileColor(score, max);
  const isSimple = max === 1;

  return (
    <Tooltip
      title={`Задание ${num} · максимум ${max} ${max === 1 ? 'балл' : max <= 4 ? 'балла' : 'баллов'} · нажмите для изменения`}
      mouseEnterDelay={0.6}
    >
      <div
        onClick={onClick}
        style={{
          width: 52,
          height: 68,
          borderRadius: 8,
          border: `2px solid ${colors.border}`,
          background: colors.bg,
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 4px 7px',
          userSelect: 'none',
          transition: 'all 0.15s',
          boxShadow: score > 0 ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
        }}
      >
        {/* Номер задания */}
        <div style={{ fontSize: 11, fontWeight: 600, color: '#888', lineHeight: 1 }}>
          {num}
        </div>

        {/* Основной индикатор */}
        {isSimple ? (
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: score === 1 ? '#52c41a' : '#e8e8e8',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.15s',
          }}>
            {score === 1 && <CheckOutlined style={{ color: '#fff', fontSize: 14, fontWeight: 700 }} />}
          </div>
        ) : (
          <div style={{ fontSize: 22, fontWeight: 700, color: colors.text, lineHeight: 1 }}>
            {score}
          </div>
        )}

        {/* Точки или «из N» */}
        {isSimple ? (
          <div style={{ fontSize: 10, color: '#bbb' }}>1 б</div>
        ) : (
          <ScoreDots score={score} max={max} />
        )}
      </div>
    </Tooltip>
  );
}

export default function EgeScoreCalculator() {
  const [scores, setScores] = useState(Array(19).fill(0));
  const [manualPrimary, setManualPrimary] = useState(16);

  const handleClick = (idx) => {
    setScores(prev => {
      const next = [...prev];
      const max = TASKS[idx].max;
      next[idx] = next[idx] >= max ? 0 : next[idx] + 1;
      return next;
    });
  };

  const handleReset = () => setScores(Array(19).fill(0));

  const primary = scores.reduce((s, v) => s + v, 0);
  const test = toTestScore(primary);
  const grade = getGradeInfo(test);

  const part1Tasks = TASKS.slice(0, 12);
  const part2Tasks = TASKS.slice(12);
  const part1Score = scores.slice(0, 12).reduce((s, v) => s + v, 0);
  const part2Score = scores.slice(12).reduce((s, v) => s + v, 0);

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px' }}>
      {/* Заголовок */}
      <div style={{ marginBottom: 20 }}>
        <Title level={3} style={{ marginBottom: 2 }}>
          Калькулятор баллов ЕГЭ
        </Title>
        <Text type="secondary">
          Профильная математика · 2025 · нажмите на задание чтобы выставить балл
        </Text>
      </div>

      {/* Результат */}
      <Card
        style={{
          marginBottom: 24,
          background: grade.bg,
          border: `2px solid ${grade.color}40`,
          borderRadius: 12,
        }}
        styles={{ body: { padding: '16px 24px' } }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 32, flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'center', minWidth: 80 }}>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>Первичный</div>
            <div style={{ fontSize: 44, fontWeight: 800, color: grade.color, lineHeight: 1 }}>
              {primary}
            </div>
            <div style={{ fontSize: 11, color: '#aaa' }}>из {MAX_PRIMARY}</div>
          </div>

          <div style={{ fontSize: 28, color: '#ccc', fontWeight: 300 }}>→</div>

          <div style={{ textAlign: 'center', minWidth: 80 }}>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>Тестовый балл</div>
            <div style={{ fontSize: 44, fontWeight: 800, color: grade.color, lineHeight: 1 }}>
              {test}
            </div>
            <div style={{ fontSize: 11, color: '#aaa' }}>из 100</div>
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: '#aaa' }}>Часть 1</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: '#555' }}>{part1Score} / 12</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: '#aaa' }}>Часть 2</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: '#555' }}>{part2Score} / 19</div>
            </div>
            <button
              onClick={handleReset}
              style={{
                border: '1px solid #d9d9d9', background: '#fff', borderRadius: 6,
                padding: '4px 12px', cursor: 'pointer', fontSize: 12, color: '#888',
                alignSelf: 'center',
              }}
            >
              Сбросить
            </button>
          </div>
        </div>
      </Card>

      {/* Часть 1 */}
      <div style={{ marginBottom: 20 }}>
        <Text strong style={{ display: 'block', marginBottom: 10, fontSize: 13, color: '#555' }}>
          Часть 1 — задания с кратким ответом · по 1 баллу
        </Text>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {part1Tasks.map((task, i) => (
            <TaskTile
              key={task.num}
              task={task}
              score={scores[i]}
              onClick={() => handleClick(i)}
            />
          ))}
        </div>
      </div>

      {/* Часть 2 */}
      <div style={{ marginBottom: 28 }}>
        <Text strong style={{ display: 'block', marginBottom: 10, fontSize: 13, color: '#555' }}>
          Часть 2 — задания с развёрнутым ответом · нажимайте для смены балла
        </Text>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {part2Tasks.map((task, i) => (
            <TaskTile
              key={task.num}
              task={task}
              score={scores[12 + i]}
              onClick={() => handleClick(12 + i)}
            />
          ))}
        </div>
      </div>

      {/* Ручной ввод первичного балла */}
      <Divider orientation="left" style={{ fontSize: 13 }}>Или введите первичный балл вручную</Divider>
      <Card
        style={{
          marginBottom: 24,
          background: getGradeInfo(toTestScore(manualPrimary)).bg,
          border: `1.5px solid ${getGradeInfo(toTestScore(manualPrimary)).color}40`,
          borderRadius: 10,
        }}
        styles={{ body: { padding: '16px 24px' } }}
      >
        <Row gutter={[32, 12]} align="middle">
          <Col xs={24} md={10}>
            <Text strong style={{ display: 'block', marginBottom: 8, fontSize: 13 }}>
              Первичный балл (0–{MAX_PRIMARY})
            </Text>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Slider
                min={0}
                max={MAX_PRIMARY}
                value={manualPrimary}
                onChange={setManualPrimary}
                marks={{ 0: '0', 8: '8', 16: '16', 24: '24', [MAX_PRIMARY]: String(MAX_PRIMARY) }}
                tooltip={{ formatter: (v) => `${v} первичных` }}
              />
              <InputNumber
                min={0}
                max={MAX_PRIMARY}
                value={manualPrimary}
                onChange={(v) => v != null && setManualPrimary(v)}
                style={{ width: 90 }}
                size="large"
              />
            </Space>
          </Col>
          <Col xs={24} md={14}>
            {(() => {
              const mt = toTestScore(manualPrimary);
              const mg = getGradeInfo(mt);
              return (
                <Row gutter={16}>
                  <Col xs={12} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>Первичный</div>
                    <div style={{ fontSize: 38, fontWeight: 800, color: mg.color, lineHeight: 1 }}>{manualPrimary}</div>
                  </Col>
                  <Col xs={12} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>Тестовый</div>
                    <div style={{ fontSize: 38, fontWeight: 800, color: mg.color, lineHeight: 1 }}>{mt}</div>
                  </Col>
                </Row>
              );
            })()}
          </Col>
        </Row>
      </Card>

      {/* Пороги */}
      <Divider orientation="left" style={{ fontSize: 13 }}>Пороговые значения</Divider>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
        {[
          { range: '0–26',   pRange: '0–4 перв.',  color: '#ff4d4f', bg: '#fff1f0' },
          { range: '27–44',  pRange: '5–7 перв.',  color: '#fa8c16', bg: '#fff7e6' },
          { range: '45–60',  pRange: '8–10 перв.', color: '#1677ff', bg: '#e6f4ff' },
          { range: '61–100', pRange: '11–32 перв.',color: '#52c41a', bg: '#f6ffed' },
        ].map(({ range, pRange, color, bg }) => (
          <div
            key={range}
            style={{
              background: bg, border: `1px solid ${color}40`,
              borderRadius: 8, padding: '8px 16px', textAlign: 'center', minWidth: 110,
            }}
          >
            <div style={{ fontSize: 20, fontWeight: 700, color }}>{range}</div>
            <div style={{ fontSize: 11, color: '#aaa' }}>{pRange}</div>
          </div>
        ))}
      </div>

      <div style={{ color: '#bbb', fontSize: 11 }}>
        Профильная математика ЕГЭ 2025 · ФИПИ / Рособрнадзор ·
        максимум 32 первичных балла · минимальный балл для аттестата: 27 тестовых (5 первичных)
      </div>
    </div>
  );
}

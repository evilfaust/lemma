import { Collapse, Space, Typography } from 'antd';
import MathRenderer from '../../MathRenderer';
import StereoStepsModal from '../../stereo/StereoStepsModal';

const { Text } = Typography;

/**
 * Решение сгенерированного задания по шагам: шаги идут после данных точек.
 * У метрических задач (углы, расстояния, объём) под чертежом — решение
 * текстом (координаты, векторы, вычисление).
 */
export default function SectionStepsModal({ task, open, onClose }) {
  if (!task) return null;
  return (
    <StereoStepsModal
      open={open}
      onClose={onClose}
      title="Решение по шагам"
      scene={task.solutionScene}
      firstStep={task.scene.ops.length}
      header={<div style={{ fontSize: 14, marginBottom: 8 }}><MathRenderer text={task.statement} /></div>}
      footer={(
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          <Space><Text type="secondary">Ответ:</Text><MathRenderer text={task.answer} /></Space>
          {task.solutionText && (
            <Collapse
              size="small"
              defaultActiveKey={['sol']}
              items={[{
                key: 'sol',
                label: 'Решение',
                children: <div style={{ fontSize: 13, maxHeight: 320, overflowY: 'auto' }}><MathRenderer text={task.solutionText} /></div>,
              }]}
            />
          )}
        </Space>
      )}
    />
  );
}

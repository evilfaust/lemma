import { Space, Typography } from 'antd';
import MathRenderer from '../../MathRenderer';
import StereoStepsModal from '../../stereo/StereoStepsModal';

const { Text } = Typography;

/** Решение сгенерированного задания по шагам: шаги идут после данных точек. */
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
      footer={<Space><Text type="secondary">Ответ:</Text><MathRenderer text={task.answer} /></Space>}
    />
  );
}

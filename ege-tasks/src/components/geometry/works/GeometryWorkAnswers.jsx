import { Button, Space, Typography } from 'antd';
import { ArrowLeftOutlined, PrinterOutlined } from '@ant-design/icons';
import MathRenderer from '../../MathRenderer';
import { rowCount, variantLabel } from '../../../utils/geometryWork';
import './geometryWorks.css';

const { Text } = Typography;

/**
 * Ключ ответов работы: строки — номера задач, столбцы — варианты (как сетка
 * редактора). Номер — по порядку непустых ячеек варианта, как на листе.
 */
export default function GeometryWorkAnswers({ structure, byId, title, onBack }) {
  const rows = rowCount(structure);
  // Номер задачи на листе: пустые ячейки варианта не нумеруются
  const numbers = structure.variants.map((v) => {
    let n = 0;
    return v.items.map((c) => (c ? (n += 1) : null));
  });

  return (
    <div className="gw-answers-root">
      <div className="gw-answers-toolbar">
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={onBack}>К работе</Button>
          <Button icon={<PrinterOutlined />} type="primary" onClick={() => window.print()}>Печать</Button>
        </Space>
        <Text type="secondary">Пустые ответы — задачи на построение/доказательство</Text>
      </div>
      <div className="gw-answers-sheet">
        <h2 className="gw-answers-title">{title || 'Работа'} — ответы</h2>
        <table className="gw-answers-table">
          <thead>
            <tr>
              {structure.variants.map((_, vi) => (
                <th key={vi} colSpan={2}>{variantLabel(vi)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }, (_, r) => (
              <tr key={r}>
                {structure.variants.map((v, vi) => {
                  const task = v.items[r] ? byId.get(v.items[r].task) : null;
                  return [
                    <td key={`n${vi}`} className="gw-answers-num">{numbers[vi][r] ?? ''}</td>,
                    <td key={`a${vi}`} className="gw-answers-cell">
                      {task ? (
                        <>
                          {task.answer ? <MathRenderer text={String(task.answer)} /> : <span className="gw-answers-none">—</span>}
                          <span className="gw-answers-code">{task.code}</span>
                        </>
                      ) : null}
                    </td>,
                  ];
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

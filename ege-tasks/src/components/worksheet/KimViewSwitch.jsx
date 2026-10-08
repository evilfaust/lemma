import { useState } from 'react';
import { Segmented, Tooltip } from 'antd';
import { EditOutlined, EyeOutlined } from '@ant-design/icons';

// Вид варианта в режиме КИМ: «Правка» — список задач с перетаскиванием,
// «Как в печати» — настоящие страницы буклета A5 (та же вёрстка и разбивка
// на страницы, что уйдут в печать) с правкой задачи по наведению.
// Выбор общий для базы, профиля и ОГЭ и помнится в браузере.
const STORAGE_KEY = 'kim.view';

const readView = () => {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'print' ? 'print' : 'edit';
  } catch {
    return 'edit';
  }
};

export function useKimView() {
  const [view, setViewState] = useState(readView);
  const setView = (next) => {
    setViewState(next);
    try { window.localStorage.setItem(STORAGE_KEY, next); } catch { /* приватный режим */ }
  };
  return [view, setView];
}

const OPTIONS = [
  { value: 'edit', label: 'Правка', icon: <EditOutlined /> },
  { value: 'print', label: 'Как в печати', icon: <EyeOutlined /> },
];

export default function KimViewSwitch({ value, onChange }) {
  return (
    <Tooltip title="«Как в печати» — страницы буклета A5 ровно такими, какими они напечатаются. Размер и место чертежа, правка и замена задачи — по наведению на задачу">
      <Segmented size="small" options={OPTIONS} value={value} onChange={onChange} />
    </Tooltip>
  );
}

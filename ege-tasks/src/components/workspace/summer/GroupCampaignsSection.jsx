import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { List, Space, Tag, Typography } from 'antd';
import { CalendarOutlined, RightOutlined } from '@ant-design/icons';
import { api } from '../../../shared/services/pocketbase';
import { SectionCard, Chip } from '../ui';
import { useAuth } from '../../../contexts/AuthContext';

const { Text } = Typography;

const STATUS_LABEL = { draft: 'Черновик', issued: 'Выдано', archived: 'Архив' };
const MAX_CHAIN = 6; // защита от битой цепочки prev_group

// Каникулярные задания класса прямо на его странице.
//
// 🚨 Зачем цепочка: перевод на новый учебный год не переносит группу, а создаёт
// новую запись с `prev_group` на прошлогоднюю. Летняя кампания остаётся на
// прошлогодней — и в новом классе выглядела пропавшей. Поднимаемся по цепочке
// вверх и показываем задания предшественников с пометкой, откуда они.
export default function GroupCampaignsSection({ group }) {
  const navigate = useNavigate();
  const { canEdit, hasSection } = useAuth();
  const [rows, setRows] = useState([]);
  const groupId = group?.id;

  useEffect(() => {
    if (!groupId) return undefined;
    let cancelled = false;
    (async () => {
      const chain = [group];
      let cur = group;
      while (cur?.prev_group && chain.length < MAX_CHAIN) {
        const prev = await api.getTeachingGroup(cur.prev_group).catch(() => null);
        if (!prev || chain.some((g) => g.id === prev.id)) break;
        chain.push(prev);
        cur = prev;
      }
      const lists = await Promise.all(chain.map((g) => api.getCampaigns({ group: g.id }).catch(() => [])));
      if (cancelled) return;
      const out = [];
      lists.forEach((list, i) => {
        for (const c of list) out.push({ ...c, inherited: i > 0 ? chain[i] : null });
      });
      out.sort((a, b) => (b.year || 0) - (a.year || 0) || String(b.created).localeCompare(String(a.created)));
      setRows(out);
    })();
    return () => { cancelled = true; };
  }, [groupId, group]);

  if (!rows.length || !canEdit || !hasSection('summer')) return null;

  return (
    <div style={{ marginBottom: 16 }}>
      <SectionCard
        icon={<CalendarOutlined />}
        iconColor="var(--violet-6, #7c4dff)"
        title={`Каникулярные задания (${rows.length})`}
      >
        <List
          size="small"
          dataSource={rows}
          renderItem={(c) => (
            <List.Item
              className="ws-clickable"
              style={{ cursor: 'pointer' }}
              onClick={() => navigate(`/app/summer/campaign/${c.id}`)}
              actions={[<RightOutlined key="go" style={{ color: '#bbb' }} />]}
            >
              <Space wrap size={6}>
                <Text strong>{c.title || '(без названия)'}</Text>
                {c.season && <Chip tone="violet">{c.season}</Chip>}
                {c.year && <Text type="secondary">{c.year}</Text>}
                <Tag>{STATUS_LABEL[c.status] || c.status}</Tag>
                {c.inherited && (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    из «{c.inherited.name}»{c.inherited.year ? ` · ${c.inherited.year}` : ''}
                  </Text>
                )}
              </Space>
            </List.Item>
          )}
        />
      </SectionCard>
    </div>
  );
}

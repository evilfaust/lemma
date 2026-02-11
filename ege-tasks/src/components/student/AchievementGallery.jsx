import { useState, useEffect, useMemo } from 'react';
import { Typography, Spin, Progress, Segmented, Empty } from 'antd';
import { TrophyOutlined } from '@ant-design/icons';
import { api } from '../../services/pocketbase';
import AchievementBadge from './AchievementBadge';

const { Title, Text } = Typography;

/**
 * Галерея всех достижений студента
 */
const AchievementGallery = ({ studentSession }) => {
  const { session } = studentSession;
  const [loading, setLoading] = useState(true);
  const [allAchievements, setAllAchievements] = useState([]);
  const [userAttempts, setUserAttempts] = useState([]);
  const [filterType, setFilterType] = useState('all'); // 'all', 'random', 'condition'
  const [filterRarity, setFilterRarity] = useState('all'); // 'all', 'common', 'rare', 'legendary'

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        // Загрузить все достижения из БД
        const achievements = await api.getAchievements();
        setAllAchievements(achievements);

        // Загрузить все попытки пользователя (device_id)
        const deviceId = localStorage.getItem('ege_device_id');
        if (session?.id && deviceId) {
          const attempts = await api.getAttemptsByDevice(session.id, deviceId);
          setUserAttempts(attempts);
        }
      } catch (err) {
        console.error('Error loading achievements gallery:', err);
      }
      setLoading(false);
    };

    load();
  }, [session?.id]);

  // Собрать ID полученных случайных значков
  const earnedBadgeIds = useMemo(() => {
    const ids = new Set();
    for (const attempt of userAttempts) {
      if (attempt.achievement) {
        ids.add(attempt.achievement);
      }
    }
    return ids;
  }, [userAttempts]);

  // Собрать ID разблокированных достижений за условия
  const unlockedAchievementIds = useMemo(() => {
    const ids = new Set();
    for (const attempt of userAttempts) {
      if (attempt.unlocked_achievements && Array.isArray(attempt.unlocked_achievements)) {
        for (const achId of attempt.unlocked_achievements) {
          ids.add(achId);
        }
      }
    }
    return ids;
  }, [userAttempts]);

  // Комбинированный Set всех полученных ID
  const allEarnedIds = useMemo(() => {
    return new Set([...earnedBadgeIds, ...unlockedAchievementIds]);
  }, [earnedBadgeIds, unlockedAchievementIds]);

  // Фильтрация достижений
  const filteredAchievements = useMemo(() => {
    let filtered = allAchievements;

    // Фильтр по типу
    if (filterType !== 'all') {
      filtered = filtered.filter(a => a.type === filterType);
    }

    // Фильтр по редкости (только для случайных)
    if (filterRarity !== 'all') {
      filtered = filtered.filter(a => a.type === 'random' && a.rarity === filterRarity);
    }

    return filtered;
  }, [allAchievements, filterType, filterRarity]);

  // Статистика
  const totalCount = allAchievements.length;
  const earnedCount = allEarnedIds.size;
  const percentage = totalCount > 0 ? (earnedCount / totalCount) * 100 : 0;

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="achievement-gallery">
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <Title level={4}>
          <TrophyOutlined /> Мои достижения
        </Title>
      </div>

      {/* Статистика */}
      <div className="achievement-stats">
        <Title level={5} style={{ marginBottom: 12 }}>
          Собрано {earnedCount} из {totalCount}
        </Title>
        <Progress percent={Math.round(percentage)} status="active" strokeColor="#1890ff" />
      </div>

      {/* Фильтры */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ marginBottom: 12 }}>
          <Text strong style={{ marginRight: 12 }}>
            Тип:
          </Text>
          <Segmented
            options={[
              { label: 'Все', value: 'all' },
              { label: 'Случайные', value: 'random' },
              { label: 'За условия', value: 'condition' },
            ]}
            value={filterType}
            onChange={setFilterType}
          />
        </div>

        {filterType === 'random' && (
          <div>
            <Text strong style={{ marginRight: 12 }}>
              Редкость:
            </Text>
            <Segmented
              options={[
                { label: 'Все', value: 'all' },
                { label: 'Обычные', value: 'common' },
                { label: 'Редкие', value: 'rare' },
                { label: 'Легендарные', value: 'legendary' },
              ]}
              value={filterRarity}
              onChange={setFilterRarity}
            />
          </div>
        )}
      </div>

      {/* Сетка достижений */}
      {filteredAchievements.length === 0 ? (
        <Empty description="Нет достижений" />
      ) : (
        <div className="achievement-grid">
          {filteredAchievements.map(achievement => {
            const isEarned = allEarnedIds.has(achievement.id);
            return (
              <AchievementBadge
                key={achievement.id}
                achievement={achievement}
                size="medium"
                showDetails={true}
                locked={!isEarned}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AchievementGallery;

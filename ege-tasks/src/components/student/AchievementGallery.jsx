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
  const [filterType, setFilterType] = useState('all');
  const [filterRarity, setFilterRarity] = useState('all');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const achievements = await api.getAchievements();
        setAllAchievements(achievements);

        const student = api.getAuthStudent();
        if (session?.id) {
          let attempts = [];
          if (student) {
            attempts = await api.getAttemptsByStudent(session.id, student.id);
          } else {
            const deviceId = localStorage.getItem('ege_device_id');
            if (deviceId) {
              attempts = await api.getAttemptsByDevice(session.id, deviceId);
            }
          }
          setUserAttempts(attempts);
        }
      } catch (err) {
        console.error('Error loading achievements gallery:', err);
      }
      setLoading(false);
    };

    load();
  }, [session?.id]);

  const earnedBadgeIds = useMemo(() => {
    const ids = new Set();
    for (const attempt of userAttempts) {
      if (attempt.achievement) ids.add(attempt.achievement);
    }
    return ids;
  }, [userAttempts]);

  const unlockedAchievementIds = useMemo(() => {
    const ids = new Set();
    for (const attempt of userAttempts) {
      if (attempt.unlocked_achievements && Array.isArray(attempt.unlocked_achievements)) {
        for (const achId of attempt.unlocked_achievements) ids.add(achId);
      }
    }
    return ids;
  }, [userAttempts]);

  const allEarnedIds = useMemo(() => {
    return new Set([...earnedBadgeIds, ...unlockedAchievementIds]);
  }, [earnedBadgeIds, unlockedAchievementIds]);

  const filteredAchievements = useMemo(() => {
    let filtered = allAchievements;
    if (filterType !== 'all') filtered = filtered.filter(a => a.type === filterType);
    if (filterRarity !== 'all') filtered = filtered.filter(a => a.type === 'random' && a.rarity === filterRarity);
    return filtered;
  }, [allAchievements, filterType, filterRarity]);

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
      <div className="achievement-gallery-header">
        <Title level={4} className="achievement-gallery-title">
          <TrophyOutlined /> Мои достижения
        </Title>
      </div>

      {/* Stats card */}
      <div className="achievement-stats">
        <div className="achievement-stats-content">
          <div className="achievement-stats-ring">
            <Progress
              type="circle"
              percent={Math.round(percentage)}
              size={90}
              strokeWidth={10}
              strokeColor={percentage === 100 ? '#52c41a' : '#4361ee'}
            />
          </div>
          <div className="achievement-stats-info">
            <Title level={5} className="achievement-stats-title">
              Собрано {earnedCount} из {totalCount}
            </Title>
            <Text className="achievement-stats-subtitle">
              {percentage === 100
                ? 'Поздравляем! Все достижения получены!'
                : `Осталось ${totalCount - earnedCount} достижений`
              }
            </Text>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="achievement-gallery-filters">
        <div className="achievement-gallery-filter-row">
          <span className="achievement-gallery-filter-label">Тип:</span>
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
          <div className="achievement-gallery-filter-row">
            <span className="achievement-gallery-filter-label">Редкость:</span>
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

      {/* Grid */}
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

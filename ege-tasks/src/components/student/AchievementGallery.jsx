import { useState, useEffect, useMemo } from 'react';
import { Typography, Spin, Progress, Segmented, Empty } from 'antd';
import { TrophyOutlined, LockOutlined } from '@ant-design/icons';
import { api } from '../../services/pocketbase';
import { getPreviouslyEarnedBadgeIds, getPreviouslyUnlockedIds } from '../../utils/achievementEngine';
import AchievementBadge from './AchievementBadge';

const { Title, Text } = Typography;

/**
 * Галерея всех достижений студента
 */
const AchievementGallery = ({ studentSession }) => {
  const { attempt } = studentSession;
  const [loading, setLoading] = useState(true);
  const [allAchievements, setAllAchievements] = useState([]);
  const [allUserAttempts, setAllUserAttempts] = useState([]);
  const [filterType, setFilterType] = useState('all');
  const [filterRarity, setFilterRarity] = useState('all');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const achievements = await api.getAchievements();
        setAllAchievements(achievements);

        const student = api.getAuthStudent();
        const deviceId = localStorage.getItem('ege_device_id');

        let allAttempts = [];
        if (student) {
          const [studentAttemptsAll, deviceAttemptsAll] = await Promise.all([
            api.getAttemptsByStudentAll(student.id),
            deviceId ? api.getAttemptsByDeviceAll(deviceId) : Promise.resolve([]),
          ]);
          const byId = new Map();
          [...studentAttemptsAll, ...deviceAttemptsAll].forEach((a) => byId.set(a.id, a));
          allAttempts = Array.from(byId.values());
        } else if (deviceId) {
          allAttempts = await api.getAttemptsByDeviceAll(deviceId);
        }
        setAllUserAttempts(allAttempts);
      } catch (err) {
        console.error('Error loading achievements gallery:', err);
      }
      setLoading(false);
    };

    load();
  }, []);

  // Ачивки из последней попытки (только что сданной)
  const lastAttemptEarnedIds = useMemo(() => {
    const ids = new Set();
    if (attempt?.achievement) ids.add(attempt.achievement);
    if (Array.isArray(attempt?.unlocked_achievements)) {
      attempt.unlocked_achievements.forEach(id => ids.add(id));
    }
    return ids;
  }, [attempt?.achievement, attempt?.unlocked_achievements]);

  const earnedBadgeIdsTotal = useMemo(() => {
    const ids = getPreviouslyEarnedBadgeIds(allUserAttempts);
    return new Set(ids);
  }, [allUserAttempts]);

  const unlockedAchievementIdsTotal = useMemo(() => {
    const ids = getPreviouslyUnlockedIds(allUserAttempts);
    return new Set(ids);
  }, [allUserAttempts]);

  const totalEarnedIds = useMemo(
    () => new Set([...earnedBadgeIdsTotal, ...unlockedAchievementIdsTotal]),
    [earnedBadgeIdsTotal, unlockedAchievementIdsTotal]
  );

  const filteredAchievements = useMemo(() => {
    let filtered = allAchievements;
    if (filterType !== 'all') filtered = filtered.filter(a => a.type === filterType);
    if (filterRarity !== 'all') filtered = filtered.filter(a => a.type === 'random' && a.rarity === filterRarity);
    return filtered;
  }, [allAchievements, filterType, filterRarity]);

  const totalCount = allAchievements.length;
  const earnedCountTotal = totalEarnedIds.size;
  const earnedCountLast = lastAttemptEarnedIds.size;
  const percentageTotal = totalCount > 0 ? (earnedCountTotal / totalCount) * 100 : 0;
  const percentageLast = totalCount > 0 ? (earnedCountLast / totalCount) * 100 : 0;

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

      <div className="achievement-stats-grid">
        <div className="achievement-stats">
          <div className="achievement-stats-content">
            <div className="achievement-stats-ring">
              <Progress
                type="circle"
                percent={Math.round(percentageLast)}
                size={90}
                strokeWidth={10}
                strokeColor="#22c55e"
              />
            </div>
            <div className="achievement-stats-info">
              <Title level={5} className="achievement-stats-title">
                Последняя попытка: {earnedCountLast} из {totalCount}
              </Title>
              <Text className="achievement-stats-subtitle">
                {earnedCountLast > 0 ? 'Получено за этот тест' : 'Нет новых достижений'}
              </Text>
            </div>
          </div>
        </div>

        <div className="achievement-stats">
          <div className="achievement-stats-content">
            <div className="achievement-stats-ring">
              <Progress
                type="circle"
                percent={Math.round(percentageTotal)}
                size={90}
                strokeWidth={10}
                strokeColor={percentageTotal === 100 ? '#52c41a' : '#4361ee'}
              />
            </div>
            <div className="achievement-stats-info">
              <Title level={5} className="achievement-stats-title">
                Всего: {earnedCountTotal} из {totalCount}
              </Title>
              <Text className="achievement-stats-subtitle">
                {percentageTotal === 100
                  ? 'Поздравляем! Все достижения получены!'
                  : `Осталось ${totalCount - earnedCountTotal} достижений`
                }
              </Text>
            </div>
          </div>
        </div>
      </div>

      <div className="achievement-gallery-legend">
        <span className="achievement-legend-item">
          <span className="achievement-legend-dot achievement-legend-dot--current" />
          За последний тест
        </span>
        <span className="achievement-legend-item">
          <span className="achievement-legend-dot achievement-legend-dot--total" />
          Получено ранее
        </span>
        <span className="achievement-legend-item">
          <span className="achievement-legend-lock"><LockOutlined /></span>
          Не получено
        </span>
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
            const isInLastAttempt = lastAttemptEarnedIds.has(achievement.id);
            const isEarnedTotal = totalEarnedIds.has(achievement.id);
            return (
              <div key={achievement.id} className="achievement-gallery-item">
                {!isEarnedTotal && (
                  <span className="achievement-earned-lock" title="Не получено">
                    <LockOutlined />
                  </span>
                )}
                {isEarnedTotal && isInLastAttempt && (
                  <span className="achievement-earned-dot achievement-earned-dot--current" title="За последний тест" />
                )}
                {isEarnedTotal && !isInLastAttempt && (
                  <span className="achievement-earned-dot achievement-earned-dot--total" title="Получено ранее" />
                )}
                <AchievementBadge
                  achievement={achievement}
                  size="medium"
                  showDetails={true}
                  locked={!isEarnedTotal}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AchievementGallery;

import { Typography } from 'antd';
import { LockOutlined, TrophyOutlined } from '@ant-design/icons';
import PropTypes from 'prop-types';

const { Text, Title } = Typography;

/**
 * Компонент отображения значка достижения
 */
const AchievementBadge = ({ achievement, size = 'medium', showDetails = true, locked = false }) => {
  if (!achievement) return null;

  const sizeClasses = {
    small: 'achievement-badge-small',
    medium: 'achievement-badge-medium',
    large: 'achievement-badge-large',
  };

  const rarityClass = achievement.rarity || 'common';
  const badgeClass = `achievement-badge ${sizeClasses[size]} ${rarityClass} ${locked ? 'locked' : ''}`;

  const iconSizes = {
    small: 32,
    medium: 64,
    large: 96,
  };

  const iconSize = iconSizes[size] || 64;

  // Маппинг редкости на русский
  const rarityLabels = {
    common: 'Обычный',
    rare: 'Редкий',
    legendary: 'Легендарный',
  };

  return (
    <div className={badgeClass}>
      {locked && (
        <div className="achievement-lock-overlay">
          <LockOutlined style={{ fontSize: iconSize / 2 }} />
        </div>
      )}

      <div className="achievement-icon-wrapper">
        {achievement.icon ? (
          <img
            src={`/achievements/${achievement.rarity}/${achievement.icon}`}
            alt={achievement.title}
            className="achievement-icon"
            style={{ width: iconSize, height: iconSize }}
            onError={(e) => {
              // Fallback на иконку трофея если картинка не загрузилась
              e.target.style.display = 'none';
              e.target.nextSibling.style.display = 'block';
            }}
          />
        ) : null}
        <TrophyOutlined
          style={{
            fontSize: iconSize,
            display: achievement.icon ? 'none' : 'block',
            opacity: locked ? 0.3 : 1,
          }}
        />
      </div>

      {showDetails && (
        <div className="achievement-details">
          <Title level={size === 'small' ? 5 : 4} style={{ margin: '8px 0 4px' }}>
            {achievement.title}
          </Title>

          {achievement.description && (
            <Text type="secondary" style={{ fontSize: size === 'small' ? 12 : 14 }}>
              {achievement.description}
            </Text>
          )}

          {achievement.rarity && achievement.type === 'random' && (
            <div className="achievement-rarity" style={{ marginTop: 8 }}>
              <Text strong style={{ fontSize: size === 'small' ? 11 : 13 }}>
                {rarityLabels[achievement.rarity]}
              </Text>
            </div>
          )}

          {locked && (
            <Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
              🔒 Заблокировано
            </Text>
          )}
        </div>
      )}
    </div>
  );
};

AchievementBadge.propTypes = {
  achievement: PropTypes.shape({
    title: PropTypes.string.isRequired,
    description: PropTypes.string,
    icon: PropTypes.string,
    rarity: PropTypes.oneOf(['common', 'rare', 'legendary']),
    type: PropTypes.oneOf(['random', 'condition']),
  }),
  size: PropTypes.oneOf(['small', 'medium', 'large']),
  showDetails: PropTypes.bool,
  locked: PropTypes.bool,
};

export default AchievementBadge;

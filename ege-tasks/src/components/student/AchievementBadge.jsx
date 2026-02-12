import { useState, useEffect } from 'react';
import { Typography } from 'antd';
import { LockOutlined, TrophyOutlined } from '@ant-design/icons';
import PropTypes from 'prop-types';

const { Text, Title } = Typography;

/**
 * Компонент отображения значка достижения с анимацией
 */
const AchievementBadge = ({
  achievement,
  size = 'medium',
  showDetails = true,
  locked = false,
  animated = false,
  animationDelay = 0
}) => {
  const [isVisible, setIsVisible] = useState(!animated);
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (animated) {
      const timer = setTimeout(() => {
        setIsVisible(true);
        // Показать конфетти для редких и легендарных
        if (achievement?.rarity !== 'common') {
          setShowConfetti(true);
          setTimeout(() => setShowConfetti(false), 2000);
        }
      }, animationDelay);
      return () => clearTimeout(timer);
    }
  }, [animated, animationDelay, achievement?.rarity]);

  if (!achievement) return null;

  const sizeClasses = {
    small: 'achievement-badge-small',
    medium: 'achievement-badge-medium',
    large: 'achievement-badge-large',
  };

  const rarityClass = achievement.rarity || 'common';
  const badgeClass = `achievement-badge ${sizeClasses[size]} ${rarityClass} ${locked ? 'locked' : ''} ${isVisible ? 'visible' : ''}`;

  const iconSizes = {
    small: 48,
    medium: 80,
    large: 120,
  };

  const iconSize = iconSizes[size] || 80;

  // Маппинг редкости на русский
  const rarityLabels = {
    common: 'Обычный',
    rare: 'Редкий',
    legendary: 'Легендарный',
  };

  // Генерация конфетти
  const renderConfetti = () => {
    if (!showConfetti) return null;
    const pieces = [];
    const count = achievement.rarity === 'legendary' ? 50 : 30;

    for (let i = 0; i < count; i++) {
      const left = Math.random() * 100;
      const delay = Math.random() * 0.3;
      const duration = 1 + Math.random() * 0.5;
      const rotation = Math.random() * 720 - 360;
      const color = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8'][Math.floor(Math.random() * 6)];

      pieces.push(
        <div
          key={i}
          className="confetti-piece"
          style={{
            left: `${left}%`,
            animationDelay: `${delay}s`,
            animationDuration: `${duration}s`,
            backgroundColor: color,
            transform: `rotate(${rotation}deg)`
          }}
        />
      );
    }
    return <div className="confetti-container">{pieces}</div>;
  };

  return (
    <div className={badgeClass} style={{ animationDelay: `${animationDelay}ms` }}>
      {renderConfetti()}

      {/* Эффект свечения для фона */}
      <div className="achievement-glow" />

      {locked && (
        <div className="achievement-lock-overlay">
          <LockOutlined style={{ fontSize: iconSize / 2 }} />
        </div>
      )}

      <div className="achievement-icon-wrapper">
        {achievement.icon ? (
          <img
            src={`/achievements/${achievement.icon}`}
            alt={achievement.title}
            className="achievement-icon"
            style={{ width: iconSize, height: iconSize }}
            onError={(e) => {
              // Fallback на иконку трофея если картинка не загрузилась
              e.target.style.display = 'none';
              const fallback = e.target.parentElement.querySelector('.trophy-fallback');
              if (fallback) fallback.style.display = 'block';
            }}
          />
        ) : null}
        <TrophyOutlined
          className="trophy-fallback"
          style={{
            fontSize: iconSize,
            display: achievement.icon ? 'none' : 'block',
            opacity: locked ? 0.3 : 1,
          }}
        />
      </div>

      {showDetails && (
        <div className="achievement-details">
          <Title level={size === 'small' ? 5 : 4} className="achievement-title">
            {achievement.title}
          </Title>

          {achievement.description && (
            <Text type="secondary" className="achievement-description">
              {achievement.description}
            </Text>
          )}

          {achievement.rarity && achievement.type === 'random' && (
            <div className={`achievement-rarity rarity-${achievement.rarity}`}>
              <Text strong>
                {rarityLabels[achievement.rarity]}
              </Text>
            </div>
          )}

          {locked && (
            <Text type="secondary" className="achievement-locked-text">
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
  animated: PropTypes.bool,
  animationDelay: PropTypes.number,
};

export default AchievementBadge;

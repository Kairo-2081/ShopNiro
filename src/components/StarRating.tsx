import React from 'react';
import { Star } from 'lucide-react';
import { useLocale } from '../lib/i18n';

interface StarRatingProps {
  rating: number; // 0 to 5
  maxRating?: number;
  size?: 'sm' | 'md' | 'lg';
  interactive?: boolean;
  onRatingChange?: (rating: number) => void;
  showText?: boolean;
  totalReviews?: number;
}

export const StarRating: React.FC<StarRatingProps> = ({
  rating,
  maxRating = 5,
  size = 'md',
  interactive = false,
  onRatingChange,
  showText = false,
  totalReviews,
}) => {
  const { t } = useLocale();
  const [hoverRating, setHoverRating] = React.useState<number | null>(null);

  const starSizeClasses = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  const current = hoverRating !== null ? hoverRating : rating;
  const ratingLabel = totalReviews === 0
    ? t('noRatings')
    : totalReviews === undefined
      ? t('ratingScore')
        .replace('{rating}', rating.toFixed(1))
        .replace('{total}', String(maxRating))
      : t('ratingSummary')
      .replace('{rating}', rating.toFixed(1))
      .replace('{total}', String(maxRating))
      .replace('{count}', String(totalReviews));

  return (
    <div
      role={interactive ? 'group' : 'img'}
      aria-label={interactive ? t('chooseRating') : ratingLabel}
      className="flex items-center gap-1.5"
    >
      <div className="flex items-center">
        {Array.from({ length: maxRating }).map((_, idx) => {
          const starVal = idx + 1;
          const isFilled = starVal <= Math.floor(current);
          const isHalf = !isFilled && starVal - 0.5 <= current;

          const star = (
            <Star
              aria-hidden="true"
              className={`${starSizeClasses[size]} ${
                isFilled
                  ? 'fill-warning-400 text-warning-400'
                  : isHalf
                  ? 'fill-warning-200 text-warning-400'
                  : 'text-surface-300 dark:text-surface-600'
              }`}
            />
          );

          return interactive ? (
            <button
              key={idx}
              type="button"
              aria-label={t('rateStarCount').replace('{count}', String(starVal))}
              aria-pressed={rating === starVal}
              onClick={() => onRatingChange?.(starVal)}
              onMouseEnter={() => setHoverRating(starVal)}
              onMouseLeave={() => setHoverRating(null)}
              className="cursor-pointer p-0.5 transition-transform hover:scale-110"
            >
              {star}
            </button>
          ) : (
            <span key={idx} aria-hidden="true" className="cursor-default p-0.5">
              {star}
            </span>
          );
        })}
      </div>

      {showText && (
        <span className="text-xs font-medium text-surface-600 dark:text-surface-400">
          {rating > 0 ? rating.toFixed(1) : t('noRatings')}
          {totalReviews !== undefined && totalReviews > 0 && ` (${totalReviews})`}
        </span>
      )}
    </div>
  );
};

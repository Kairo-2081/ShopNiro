import React from 'react';
import { areaPath, smoothPath, sparklinePoints } from './sparkline';

interface SparklineProps {
  values: readonly number[];
  /** Pixel box the line is drawn in. The SVG scales to its container, so this only sets the aspect ratio. */
  width?: number;
  height?: number;
  className?: string;
  /** Hidden from assistive tech by default: the number next to it already says everything the line shows. */
  label?: string;
}

/** A tiny trend line with a soft fill and a dot on the latest value. Decorative unless a label is given. */
export const Sparkline: React.FC<SparklineProps> = ({ values, width = 120, height = 36, className = '', label }) => {
  const gradientId = React.useId().replace(/:/g, '');
  const points = React.useMemo(() => sparklinePoints(values, width, height, 4), [values, width, height]);
  if (points.length < 2) return null;
  const last = points[points.length - 1];
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={`block h-9 w-full overflow-visible ${className}`}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--chart-primary)" stopOpacity={0.34} />
          <stop offset="100%" stopColor="var(--chart-primary)" stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={areaPath(points, height)} fill={`url(#${gradientId})`} />
      <path d={smoothPath(points, height)} fill="none" stroke="var(--chart-primary)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <circle cx={last.x} cy={last.y} r={3} fill="var(--chart-primary)" stroke="var(--chart-ring)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
    </svg>
  );
};

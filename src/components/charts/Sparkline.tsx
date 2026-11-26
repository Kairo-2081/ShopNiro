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
  /** CSS colour of the line, fill and dot. Defaults to the theme's gold. */
  color?: string;
}

/** A tiny trend line with a soft fill and a dot on the latest value. Decorative unless a label is given. */
export const Sparkline: React.FC<SparklineProps> = ({ values, width = 120, height = 36, className = '', label, color = 'var(--chart-primary)' }) => {
  const gradientId = React.useId().replace(/:/g, '');
  const points = React.useMemo(() => sparklinePoints(values, width, height, 4), [values, width, height]);
  if (points.length < 2) return null;
  const last = points[points.length - 1];
  return (
    <div className={`relative h-9 w-full ${className}`}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="block h-full w-full overflow-visible"
        role={label ? 'img' : undefined}
        aria-label={label}
        aria-hidden={label ? undefined : true}
        focusable="false"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.34} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={areaPath(points, height)} fill={`url(#${gradientId})`} />
        <path d={smoothPath(points, height)} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
      {/* The dot is an HTML element, not an SVG circle: the SVG is stretched to fit its tile and would squash a circle into an oval. */}
      <span
        aria-hidden="true"
        className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--chart-ring)]"
        style={{ background: color, left: `${(last.x / width) * 100}%`, top: `${(last.y / height) * 100}%` }}
      />
    </div>
  );
};

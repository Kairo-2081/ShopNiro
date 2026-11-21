import React from 'react';
import { shareRows } from './breakdown';
import { useReducedMotion } from './useReducedMotion';

export interface ShareSlice {
  key: string;
  name: string;
  value: number;
  /** A CSS colour, normally one of the --chart-cat-N tokens so the chart follows the theme. */
  color: string;
}

interface ShareBreakdownProps {
  slices: readonly ShareSlice[];
  /** The headline figure, usually the total. */
  centerValue: string;
  centerLabel: string;
  ariaLabel: string;
  /** What each count is called, shown quietly beside it, e.g. "orders". */
  unit: string;
  /** A full ring, or a half ring for a health reading. The ranked rows are the same either way. */
  variant?: 'ring' | 'gauge';
}

const lighter = (color: string) => `color-mix(in srgb, ${color} 62%, white)`;
const glow = (color: string) => `0 0 18px -6px color-mix(in srgb, ${color} 70%, transparent)`;

// Arc geometry. Both shapes are drawn with pathLength=1000, so a slice of 25% is simply 250 units of dash.
const TOTAL = 1000;
const RADIUS = 56;
const STROKE = 13;
const GAP_PX = 3.5;
const VIEW = 140;

/**
 * Parts of a whole, drawn as a ring (or half ring) with the total in the middle and one ranked row per part. The arc
 * gives the whole picture at a glance; each row names its part and gives its exact count and share, so nothing depends
 * on telling colours apart. Hovering or focusing a row lights up its segment and dims the rest. The arc draws in once
 * it scrolls into view, and is simply drawn under reduced motion.
 */
export const ShareBreakdown: React.FC<ShareBreakdownProps> = ({ slices, centerValue, centerLabel, ariaLabel, unit, variant = 'ring' }) => {
  const reducedMotion = useReducedMotion();
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const [filled, setFilled] = React.useState(false);
  const [active, setActive] = React.useState<string | null>(null);

  React.useEffect(() => {
    const element = rootRef.current;
    if (reducedMotion || !element || typeof IntersectionObserver === 'undefined') {
      setFilled(true);
      return undefined;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setFilled(true);
        observer.disconnect();
      }
    }, { threshold: 0.25 });
    observer.observe(element);
    return () => observer.disconnect();
  }, [reducedMotion]);

  const rows = React.useMemo(() => shareRows(slices.map((slice) => slice.value)), [slices]);
  const dimmed = (key: string) => active !== null && active !== key;
  const gauge = variant === 'gauge';
  const arcLength = gauge ? Math.PI * RADIUS : 2 * Math.PI * RADIUS;
  const unitsPerPx = TOTAL / arcLength;
  const single = slices.length === 1;
  const gapU = single ? 0 : GAP_PX * unitsPerPx;
  const capU = STROKE * unitsPerPx;

  // Round caps stick out by half the stroke at each end, so each dash is shortened by the cap and the gap and then
  // nudged half of that forward; that leaves an even visible gap between neighbours.
  // On the half ring the outer ends line up with the track's own rounded ends, so only the inner joins need a gap.
  let offset = 0;
  const arcs = slices.map((slice, index) => {
    const length = (rows[index].percent / 100) * TOTAL;
    const first = index === 0;
    const last = index === slices.length - 1;
    let visible: number;
    let start: number;
    if (gauge) {
      const lead = first ? 0 : gapU / 2 + capU / 2;
      const trail = last ? 0 : gapU / 2 + capU / 2;
      start = offset + lead;
      visible = Math.max(length - lead - trail, 0.01);
    } else {
      const pad = single ? 0 : gapU + capU;
      start = offset + pad / 2;
      visible = Math.max(length - pad, 0.01);
    }
    offset += length;
    return { slice, visible, start };
  });

  const center = VIEW / 2;
  const path = gauge
    ? `M ${center - RADIUS} ${center + 6} A ${RADIUS} ${RADIUS} 0 0 1 ${center + RADIUS} ${center + 6}`
    : undefined;
  const transition = reducedMotion ? 'none' : 'stroke-dasharray 900ms cubic-bezier(0.22, 1, 0.36, 1), opacity 200ms ease, stroke-width 160ms ease';

  const arcProps = { fill: 'none', pathLength: TOTAL, strokeLinecap: single && !gauge ? ('butt' as const) : ('round' as const) };

  return (
    <div ref={rootRef} className="@container">
      <div className={gauge ? 'space-y-4' : 'flex flex-col gap-5 @md:flex-row @md:items-center @md:gap-6'}>
      <div role="img" aria-label={ariaLabel} className={`relative mx-auto shrink-0 ${gauge ? 'w-full max-w-[15rem]' : 'w-40'}`} style={{ aspectRatio: gauge ? `${VIEW} / ${VIEW / 2 + 14}` : '1 / 1' }}>
        <svg viewBox={gauge ? `0 0 ${VIEW} ${VIEW / 2 + 14}` : `0 0 ${VIEW} ${VIEW}`} className="block h-full w-full overflow-visible" aria-hidden="true" focusable="false">
          {gauge ? (
            <path d={path} stroke="var(--chart-track)" strokeWidth={STROKE} strokeLinecap="round" fill="none" pathLength={TOTAL} />
          ) : (
            <circle cx={center} cy={center} r={RADIUS} stroke="var(--chart-track)" strokeWidth={STROKE} fill="none" />
          )}
          {arcs.map(({ slice, visible, start }) => {
            const shared = {
              ...arcProps,
              stroke: slice.color,
              strokeWidth: active === slice.key ? STROKE + 3 : STROKE,
              strokeDasharray: filled ? `${visible} ${TOTAL * 2}` : `0.01 ${TOTAL * 2}`,
              strokeDashoffset: -start,
              opacity: dimmed(slice.key) ? 0.28 : 1,
              style: { transition, filter: active === slice.key ? `drop-shadow(0 0 6px color-mix(in srgb, ${slice.color} 70%, transparent))` : undefined } as React.CSSProperties,
            };
            return gauge ? (
              <path key={slice.key} d={path} {...shared} />
            ) : (
              <circle key={slice.key} cx={center} cy={center} r={RADIUS} transform={`rotate(-90 ${center} ${center})`} {...shared} />
            );
          })}
        </svg>
        <div className={`pointer-events-none absolute inset-x-0 flex flex-col items-center text-center ${gauge ? 'bottom-0' : 'inset-y-0 justify-center'}`}>
          <p className="font-display text-3xl font-normal tabular-nums leading-none tracking-tight text-[var(--chart-ink)]">{centerValue}</p>
          <p className="mt-1 text-micro font-medium text-[var(--chart-axis)]">{centerLabel}</p>
        </div>
      </div>

      <ul className="min-w-0 flex-1 space-y-0.5">
        {slices.map((slice, index) => (
          <li
            key={slice.key}
            tabIndex={0}
            onMouseEnter={() => setActive(slice.key)}
            onMouseLeave={() => setActive(null)}
            onFocus={() => setActive(slice.key)}
            onBlur={() => setActive(null)}
            className="group rounded-xl px-3 py-2 outline-none transition-colors hover:bg-[var(--chart-track)] focus-visible:ring-2 focus-visible:ring-brand-500"
            style={{ opacity: dimmed(slice.key) ? 0.55 : 1, transition: reducedMotion ? 'none' : 'opacity 200ms ease, background-color 150ms ease' }}
          >
            <div className="flex items-baseline gap-3 text-xs">
              <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 self-center rounded-full" style={{ backgroundColor: slice.color, boxShadow: glow(slice.color) }} />
              <span className="min-w-0 flex-1 truncate font-medium text-[var(--chart-ink)]">{slice.name}</span>
              <span className="tabular-nums text-[var(--chart-axis)]">
                <span className="font-semibold text-[var(--chart-ink)]">{slice.value.toLocaleString()}</span>
                <span className="ml-1">{unit}</span>
              </span>
              <span className="w-11 text-right text-sm font-bold tabular-nums text-[var(--chart-ink)]">{rows[index].label}%</span>
            </div>
            <div aria-hidden="true" className="mt-2 h-1 w-full overflow-hidden rounded-full bg-[var(--chart-track)]">
              <div
                className="h-full rounded-full"
                style={{
                  width: filled ? `${rows[index].percent}%` : '0%',
                  backgroundImage: `linear-gradient(90deg, ${lighter(slice.color)}, ${slice.color})`,
                  transition: reducedMotion ? 'none' : 'width 900ms cubic-bezier(0.22, 1, 0.36, 1)',
                  transitionDelay: reducedMotion ? '0ms' : `${200 + index * 90}ms`,
                }}
              />
            </div>
          </li>
        ))}
      </ul>
      </div>
    </div>
  );
};

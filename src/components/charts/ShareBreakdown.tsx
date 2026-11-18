import React from 'react';
import { shareRows } from './breakdown';
import { useReducedMotion } from './useReducedMotion';

export interface ShareSlice {
  key: string;
  name: string;
  value: number;
  /** A CSS colour, normally one of the --chart-cat-N tokens so the bar follows the theme. */
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
}

const lighter = (color: string) => `color-mix(in srgb, ${color} 62%, white)`;
const glow = (color: string) => `0 0 18px -6px color-mix(in srgb, ${color} 70%, transparent)`;

/**
 * Parts of a whole, drawn as a single segmented ribbon over one ranked row per part. The ribbon gives the whole
 * picture at a glance; each row names its part and gives its exact share and count, so the chart never depends on
 * telling colours apart. Hovering or focusing a row lights up its segment and dims the rest. The bars fill in once the
 * chart scrolls into view, and are simply drawn under reduced motion.
 */
export const ShareBreakdown: React.FC<ShareBreakdownProps> = ({ slices, centerValue, centerLabel, ariaLabel, unit }) => {
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
  const transition = reducedMotion ? 'none' : 'width 900ms cubic-bezier(0.22, 1, 0.36, 1), opacity 200ms ease';
  const dimmed = (key: string) => active !== null && active !== key;

  return (
    <div ref={rootRef} className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-3xl font-extrabold tabular-nums leading-none tracking-tight text-surface-900 dark:text-white">{centerValue}</p>
          <p className="mt-1.5 text-micro font-semibold uppercase tracking-wider text-surface-500 dark:text-surface-400">{centerLabel}</p>
        </div>
      </div>

      <div role="img" aria-label={ariaLabel} className="flex h-3.5 w-full gap-1 overflow-hidden rounded-full bg-surface-100 p-0.5 dark:bg-surface-800/70">
        {slices.map((slice, index) => (
          <span
            key={slice.key}
            aria-hidden="true"
            className="h-full min-w-[6px] rounded-full"
            style={{
              width: filled ? `${rows[index].percent}%` : '0%',
              backgroundImage: `linear-gradient(90deg, ${lighter(slice.color)}, ${slice.color})`,
              boxShadow: active === slice.key ? glow(slice.color) : undefined,
              opacity: dimmed(slice.key) ? 0.3 : 1,
              transition,
              transitionDelay: reducedMotion ? '0ms' : `${index * 90}ms`,
            }}
          />
        ))}
      </div>

      <ul className="space-y-1">
        {slices.map((slice, index) => (
          <li
            key={slice.key}
            tabIndex={0}
            onMouseEnter={() => setActive(slice.key)}
            onMouseLeave={() => setActive(null)}
            onFocus={() => setActive(slice.key)}
            onBlur={() => setActive(null)}
            className="group rounded-xl px-3 py-2 outline-none transition-colors hover:bg-surface-100/80 focus-visible:ring-2 focus-visible:ring-brand-500 dark:hover:bg-surface-800/60"
            style={{ opacity: dimmed(slice.key) ? 0.55 : 1, transition: reducedMotion ? 'none' : 'opacity 200ms ease, background-color 150ms ease' }}
          >
            <div className="flex items-baseline gap-3 text-xs">
              <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 self-center rounded-full" style={{ backgroundColor: slice.color, boxShadow: glow(slice.color) }} />
              <span className="min-w-0 flex-1 truncate font-medium text-surface-800 dark:text-surface-100">{slice.name}</span>
              <span className="tabular-nums text-surface-500 dark:text-surface-400">
                <span className="font-semibold text-surface-900 dark:text-white">{slice.value.toLocaleString()}</span>
                <span className="ml-1">{unit}</span>
              </span>
              <span className="w-11 text-right text-sm font-extrabold tabular-nums text-surface-900 dark:text-white">{rows[index].label}%</span>
            </div>
            <div aria-hidden="true" className="mt-2 h-1 w-full overflow-hidden rounded-full bg-surface-100 dark:bg-surface-800/70">
              <div
                className="h-full rounded-full"
                style={{
                  width: filled ? `${rows[index].percent}%` : '0%',
                  backgroundImage: `linear-gradient(90deg, ${lighter(slice.color)}, ${slice.color})`,
                  transition,
                  transitionDelay: reducedMotion ? '0ms' : `${200 + index * 90}ms`,
                }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

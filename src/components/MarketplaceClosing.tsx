import React from 'react';
import { shopNiroAnimation } from '../lib/branding';

export interface MarketplaceStat {
  label: string;
  value: number;
}

const AnimatedStat: React.FC<{ stat: MarketplaceStat; index: number }> = ({ stat, index }) => {
  const [displayValue, setDisplayValue] = React.useState(0);

  React.useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion || stat.value <= 0) {
      setDisplayValue(stat.value);
      return;
    }

    let frameId = 0;
    let startTime = 0;
    const delay = index * 110;
    const duration = 750;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min(Math.max((timestamp - startTime - delay) / duration, 0), 1);
      const easedProgress = 1 - (1 - progress) ** 3;
      setDisplayValue(Math.floor(stat.value * easedProgress));

      if (progress < 1) frameId = window.requestAnimationFrame(animate);
    };

    frameId = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frameId);
  }, [index, stat.value]);

  return (
    <dd
      aria-label={stat.value.toLocaleString()}
      className="font-display text-2xl sm:text-3xl leading-none text-slate-900 dark:text-white tabular-nums"
    >
      {displayValue.toLocaleString()}
    </dd>
  );
};

interface MarketplaceClosingProps {
  stats: MarketplaceStat[];
}

export const MarketplaceClosing: React.FC<MarketplaceClosingProps> = ({ stats }) => (
  <section
    aria-label="ShopNiro marketplace overview"
    className="marketplace-closing flex flex-col sm:flex-row sm:items-center gap-5 sm:gap-7 rounded-2xl border border-[#d0c8a5]/25 bg-white/65 dark:bg-[#11110f]/75 px-5 py-5 sm:px-7 sm:py-6 backdrop-blur-xl"
  >
    <div className="relative mx-auto sm:mx-0 h-32 w-32 sm:h-36 sm:w-36 shrink-0">
      <img
        src={shopNiroAnimation}
        alt="Animated ShopNiro logo"
        className="closing-orb h-full w-full object-contain"
      />
    </div>

    <div className="min-w-0 flex-1 space-y-4">
      <div>
        <p className="text-[10px] font-bold tracking-[0.16em] uppercase text-[#77775a] dark:text-[#d0c8a5]">
          ShopNiro marketplace
        </p>
        <h2 className="mt-1 text-2xl sm:text-3xl text-slate-900 dark:text-white">
          A marketplace in motion.
        </h2>
      </div>

      <dl className="grid grid-cols-3 border-t border-[#d0c8a5]/25 pt-3">
        {stats.map((stat, index) => (
          <div
            key={stat.label}
            className={`min-w-0 px-2 first:pl-0 ${index > 0 ? 'border-l border-[#d0c8a5]/25' : ''}`}
          >
            <AnimatedStat stat={stat} index={index} />
            <dt className="mt-1.5 text-[10px] sm:text-xs leading-snug text-slate-600 dark:text-zinc-400">
              {stat.label}
            </dt>
          </div>
        ))}
      </dl>
    </div>
  </section>
);
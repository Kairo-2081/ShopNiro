import React from 'react';
import { countUpValue } from './countUp';
import { useReducedMotion } from '../charts/useReducedMotion';

interface CountUpProps {
  value: number;
  /** Turns the running number into the text shown, for example a currency or a percentage. */
  format: (value: number) => string;
  durationMs?: number;
  className?: string;
}

/**
 * A figure that counts up to its value the first time it scrolls into view, and glides to a new value if the data
 * changes. Screen readers get the final figure at once (the running digits are hidden from them), and under reduced
 * motion the figure is simply shown.
 */
export const CountUp: React.FC<CountUpProps> = ({ value, format, durationMs = 900, className }) => {
  const reducedMotion = useReducedMotion();
  const ref = React.useRef<HTMLSpanElement | null>(null);
  const shownRef = React.useRef(0);
  const [shown, setShown] = React.useState(reducedMotion ? value : 0);
  const [isVisible, setIsVisible] = React.useState(false);

  React.useEffect(() => {
    if (reducedMotion || typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return undefined;
    }
    const element = ref.current;
    if (!element) return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setIsVisible(true);
        observer.disconnect();
      }
    }, { threshold: 0.3 });
    observer.observe(element);
    return () => observer.disconnect();
  }, [reducedMotion]);

  React.useEffect(() => {
    if (!isVisible) return undefined;
    if (reducedMotion) {
      shownRef.current = value;
      setShown(value);
      return undefined;
    }
    const from = shownRef.current;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const next = countUpValue(from, value, now - start, durationMs);
      shownRef.current = next;
      setShown(next);
      if (next !== value) frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [isVisible, value, durationMs, reducedMotion]);

  return (
    <span ref={ref} className={className}>
      <span aria-hidden="true">{format(isVisible ? shown : reducedMotion ? value : 0)}</span>
      <span className="sr-only">{format(value)}</span>
    </span>
  );
};

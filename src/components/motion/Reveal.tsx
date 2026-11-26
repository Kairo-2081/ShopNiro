import React from 'react';
import { useReducedMotion } from '../charts/useReducedMotion';

interface RevealProps {
  children: React.ReactNode;
  /** Wait this long after scrolling into view; use it to stagger siblings. */
  delayMs?: number;
  className?: string;
  as?: 'div' | 'section' | 'li' | 'article';
}

/**
 * Fades and lifts its content in once, as it scrolls into view. Content already on screen when the page loads is left
 * alone, so nothing above the fold flashes; with reduced motion, or no IntersectionObserver, nothing is hidden at all.
 */
export const Reveal: React.FC<RevealProps> = ({ children, delayMs = 0, className = '', as = 'div' }) => {
  const reducedMotion = useReducedMotion();
  const ref = React.useRef<HTMLElement | null>(null);
  const [state, setState] = React.useState<'shown' | 'hidden' | 'revealing'>('shown');

  React.useLayoutEffect(() => {
    const element = ref.current;
    if (reducedMotion || !element || typeof IntersectionObserver === 'undefined') return undefined;
    const rect = element.getBoundingClientRect();
    if (rect.top < window.innerHeight) return undefined;
    setState('hidden');
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setState('revealing');
        observer.disconnect();
      }
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    observer.observe(element);
    return () => observer.disconnect();
  }, [reducedMotion]);

  const Tag = as as React.ElementType;
  return (
    <Tag
      ref={ref}
      className={`${className} ${state === 'hidden' ? 'translate-y-4 opacity-0' : 'translate-y-0 opacity-100'} ${state === 'revealing' ? 'transition-[opacity,transform] duration-700 ease-out' : ''}`}
      style={state === 'revealing' && delayMs ? { transitionDelay: `${delayMs}ms` } : undefined}
    >
      {children}
    </Tag>
  );
};

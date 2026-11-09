import React, { useRef, useEffect, useState } from 'react';
import { drawGlobe } from './globe/drawGlobe';

interface OrbitGlobeProps {
  onGreet?: () => void;
}

export const OrbitGlobe: React.FC<OrbitGlobeProps> = ({ onGreet }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isWaving, setIsWaving] = useState<boolean>(false);
  const [greetingText, setGreetingText] = useState<string | null>(null);

  // Render planet on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2 + 10;
    const radius = 86;

    drawGlobe(ctx, { width, height, cx: centerX, cy: centerY, radius });

    // 6. Cute Courier Character Standing on Top of the Planet!
    const charBaseX = centerX;
    const charBaseY = centerY - radius + 3;

    ctx.save();
    // Body & Legs
    ctx.fillStyle = '#1E3A8A'; // Dark navy pants
    ctx.fillRect(charBaseX - 3.5, charBaseY - 14, 7, 14);

    // Orange/Coral Delivery Jacket
    ctx.fillStyle = '#FB923C'; // bright courier jacket
    ctx.beginPath();
    ctx.roundRect(charBaseX - 6, charBaseY - 26, 12, 13, 3);
    ctx.fill();

    // Delivery Backpack
    ctx.fillStyle = '#0284C7';
    ctx.beginPath();
    ctx.roundRect(charBaseX + 4, charBaseY - 25, 5, 10, 2);
    ctx.fill();

    // Courier Cap / Head
    ctx.fillStyle = '#FBBF24'; // skin tone
    ctx.beginPath();
    ctx.arc(charBaseX, charBaseY - 29, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // Blue Cap
    ctx.fillStyle = '#0284C7';
    ctx.beginPath();
    ctx.arc(charBaseX, charBaseY - 31, 4.5, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(charBaseX - 6, charBaseY - 31.5, 9, 2); // Cap visor

    // Waving Hand
    if (isWaving) {
      ctx.strokeStyle = '#FBBF24';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(charBaseX - 5, charBaseY - 22);
      ctx.lineTo(charBaseX - 11, charBaseY - 32);
      ctx.stroke();

      // Parcel in other hand
      ctx.fillStyle = '#F59E0B';
      ctx.fillRect(charBaseX + 2, charBaseY - 18, 6, 6);
    } else {
      ctx.strokeStyle = '#FBBF24';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(charBaseX - 5, charBaseY - 22);
      ctx.lineTo(charBaseX - 8, charBaseY - 17);
      ctx.stroke();
    }

    ctx.restore();
  }, [isWaving]);

  const handleGlobeClick = () => {
    setIsWaving(true);
    setGreetingText('Hello there! 👋 Parcel en route!');
    if (onGreet) onGreet();
    setTimeout(() => {
      setIsWaving(false);
      setGreetingText(null);
    }, 2800);
  };

  return (
    <div className="relative flex h-[284px] flex-col items-center justify-center select-none py-2">
      {/* Speech Bubble when greeted */}
      {greetingText && (
        <div role="status" className="absolute top-2 z-20 px-3.5 py-1.5 rounded-full bg-white dark:bg-surface-900 border border-brand-200 dark:border-brand-800 text-brand-600 dark:text-brand-300 font-semibold text-xs shadow-lg animate-bounce">
          {greetingText}
        </div>
      )}

      {/* Interactive 3D Canvas */}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        width={300}
        height={240}
        onClick={handleGlobeClick}
        className="cursor-pointer transition-transform hover:scale-102"
        title="Greet the courier"
      />

      {/* Pill Badge Instruction */}
      <button
        type="button"
        onClick={handleGlobeClick}
        className="mt-1 inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-brand-50 dark:bg-brand-950/40 border border-brand-200/80 dark:border-brand-800/80 text-brand-700 dark:text-brand-300 text-micro font-medium tracking-wide shadow-2xs hover:bg-brand-100 dark:hover:bg-brand-900/50 transition-colors cursor-pointer"
      >
        <span>Activate to greet the courier.</span>
      </button>
    </div>
  );
};

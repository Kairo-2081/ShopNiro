import React, { useRef, useEffect, useState } from 'react';

interface OrbitGlobeProps {
  onGreet?: () => void;
}

export const OrbitGlobe: React.FC<OrbitGlobeProps> = ({ onGreet }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [rotation, setRotation] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStartX, setDragStartX] = useState<number>(0);
  const [isWaving, setIsWaving] = useState<boolean>(false);
  const [greetingText, setGreetingText] = useState<string | null>(null);

  // Rotation animation loop
  useEffect(() => {
    let animationFrameId: number;
    const animate = () => {
      if (!isDragging) {
        setRotation((prev) => (prev + 0.35) % 360);
      }
      animationFrameId = requestAnimationFrame(animate);
    };
    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isDragging]);

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

    ctx.clearRect(0, 0, width, height);

    // 1. Outer Atmospheric Glow
    const glowGradient = ctx.createRadialGradient(
      centerX,
      centerY,
      radius * 0.8,
      centerX,
      centerY,
      radius * 1.55
    );
    glowGradient.addColorStop(0, 'rgba(56, 189, 248, 0.45)');
    glowGradient.addColorStop(0.5, 'rgba(37, 99, 235, 0.18)');
    glowGradient.addColorStop(1, 'rgba(37, 99, 235, 0)');
    ctx.fillStyle = glowGradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 1.55, 0, Math.PI * 2);
    ctx.fill();

    // 2. Orbital Ring with Nodes
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate((-22 * Math.PI) / 180);
    ctx.beginPath();
    ctx.ellipse(0, 0, radius * 1.45, radius * 0.48, 0, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(147, 197, 253, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 6]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Orbiting Satellite / Package Pod
    const orbitAngle = (rotation * Math.PI) / 90;
    const satX = Math.cos(orbitAngle) * radius * 1.45;
    const satY = Math.sin(orbitAngle) * radius * 0.48;
    ctx.fillStyle = '#38BDF8';
    ctx.beginPath();
    ctx.arc(satX, satY, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(satX, satY, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 3. Globe Base Circle with Radial Sphere Shading
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.clip();

    // Sphere Gradient: deep navy blue to brilliant cyan/azure
    const sphereGrad = ctx.createRadialGradient(
      centerX - radius * 0.35,
      centerY - radius * 0.35,
      radius * 0.1,
      centerX,
      centerY,
      radius
    );
    sphereGrad.addColorStop(0, '#60A5FA');
    sphereGrad.addColorStop(0.35, '#2563EB');
    sphereGrad.addColorStop(0.8, '#1D4ED8');
    sphereGrad.addColorStop(1, '#0F172A');
    ctx.fillStyle = sphereGrad;
    ctx.fillRect(centerX - radius, centerY - radius, radius * 2, radius * 2);

    // 4. Continents / Landmasses with rotation offset
    ctx.fillStyle = 'rgba(14, 165, 233, 0.85)';
    const radRot = (rotation * Math.PI) / 180;

    // Stylized procedural islands / continents that scroll with rotation
    const continents = [
      { baseAngle: 0, lat: -15, r: 24 },
      { baseAngle: 50, lat: 25, r: 20 },
      { baseAngle: 110, lat: -10, r: 28 },
      { baseAngle: 170, lat: 30, r: 18 },
      { baseAngle: 230, lat: -25, r: 22 },
      { baseAngle: 290, lat: 15, r: 26 },
      { baseAngle: 340, lat: -5, r: 16 },
    ];

    continents.forEach((cont) => {
      const angle = (cont.baseAngle * Math.PI) / 180 + radRot;
      const xOffset = Math.sin(angle) * (radius * 0.85);
      const isVisible = Math.cos(angle) > -0.2; // hemisphere check

      if (isVisible) {
        const landX = centerX + xOffset;
        const landY = centerY + cont.lat;
        const landR = cont.r * (Math.cos(angle) * 0.5 + 0.5);

        ctx.beginPath();
        ctx.ellipse(landX, landY, Math.max(3, landR), Math.max(2, landR * 0.65), 0.2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(125, 211, 252, 0.4)';
        ctx.fill();

        // Inner land highlight
        ctx.beginPath();
        ctx.arc(landX, landY, Math.max(2, landR * 0.45), 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(224, 242, 254, 0.6)';
        ctx.fill();
      }
    });

    // 5. Atmosphere Crescent / Rim Lighting
    const rimGrad = ctx.createLinearGradient(centerX - radius, centerY, centerX + radius, centerY);
    rimGrad.addColorStop(0, 'rgba(255, 255, 255, 0.45)');
    rimGrad.addColorStop(0.2, 'rgba(56, 189, 248, 0.2)');
    rimGrad.addColorStop(0.85, 'transparent');
    ctx.fillStyle = rimGrad;
    ctx.fillRect(centerX - radius, centerY - radius, radius * 2, radius * 2);

    ctx.restore();

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
  }, [rotation, isWaving]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    setDragStartX(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    const deltaX = e.clientX - dragStartX;
    setRotation((prev) => (prev + deltaX * 0.8 + 360) % 360);
    setDragStartX(e.clientX);
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };

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
    <div className="relative flex flex-col items-center justify-center select-none py-2">
      {/* Speech Bubble when greeted */}
      {greetingText && (
        <div className="absolute top-2 z-20 px-3.5 py-1.5 rounded-full bg-white dark:bg-zinc-900 border border-sky-200 dark:border-sky-800 text-blue-600 dark:text-sky-300 font-semibold text-xs shadow-lg animate-bounce">
          {greetingText}
        </div>
      )}

      {/* Interactive 3D Canvas */}
      <canvas
        ref={canvasRef}
        width={300}
        height={240}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onClick={handleGlobeClick}
        className="cursor-grab active:cursor-grabbing touch-none transition-transform hover:scale-102"
        title="Drag to rotate, click to greet courier"
      />

      {/* Pill Badge Instruction */}
      <button
        type="button"
        onClick={handleGlobeClick}
        className="mt-1 inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-sky-50 dark:bg-sky-950/40 border border-sky-200/80 dark:border-sky-800/80 text-sky-700 dark:text-sky-300 text-[11px] font-medium tracking-wide shadow-2xs hover:bg-sky-100 dark:hover:bg-sky-900/50 transition-colors cursor-pointer"
      >
        <span>🤏 Drag to rotate • Tap to greet</span>
      </button>
    </div>
  );
};

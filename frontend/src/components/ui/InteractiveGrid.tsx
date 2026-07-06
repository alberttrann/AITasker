import React, { useRef, useEffect } from 'react';

interface InteractiveGridProps {
  disabled?: boolean;
}

export function InteractiveGrid({ disabled = false }: InteractiveGridProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    // Configuration
    const CELL_SIZE = 10;
    const RADIUS = 100/; // Hover blast radius in pixels
    const TRAIL_DECAY = 0.008; // Lower means a longer trail (approx 3 seconds at 60fps)
    
    // Wave Configuration
    const WAVE_SPEED = 2; // How fast the color wave expands
    
    // Animation Configuration
    const PULSE_SPEED = 0.003; // Speed of the rhythmic shimmer (higher = faster)

    let animationFrameId: number;
    let width = 0;
    let height = 0;
    let cols = 0;
    let rows = 0;
    let mouseX = -1000;
    let mouseY = -1000;
    let isMouseDown = false;

    interface Ripple {
      x: number;
      y: number;
      radius: number;
      maxRadius: number;
      speed: number;
    }
    const ripples: Ripple[] = [];

    // grid stores the "excitation" value (0 to 1) for each cell
    let grid: Float32Array;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      width = window.innerWidth;
      height = window.innerHeight;
      
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      cols = Math.ceil(width / CELL_SIZE) + 1;
      rows = Math.ceil(height / CELL_SIZE) + 1;
      grid = new Float32Array(cols * rows);
    };

    window.addEventListener('resize', resize);
    resize();

    const handleMouseMove = (e: MouseEvent) => {
      if (disabled) return;
      mouseX = e.clientX;
      mouseY = e.clientY;
    };

    const handleMouseLeave = () => {
      mouseX = -1000;
      mouseY = -1000;
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (disabled) return;
      isMouseDown = true;
      ripples.push({
        x: e.clientX,
        y: e.clientY,
        radius: 0,
        maxRadius: RADIUS, // Wave only travels as far as the hover radius
        speed: WAVE_SPEED
      });
    };

    const handleMouseUp = () => {
      isMouseDown = false;
    };

    window.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);

    const render = () => {
      // Clear canvas
      ctx.clearRect(0, 0, width, height);

      // Update ripples
      for (let i = ripples.length - 1; i >= 0; i--) {
        ripples[i].radius += ripples[i].speed;
        if (ripples[i].radius > ripples[i].maxRadius) {
          ripples.splice(i, 1);
        }
      }

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const index = y * cols + x;
          
          const cx = x * CELL_SIZE + CELL_SIZE / 2;
          const cy = y * CELL_SIZE + CELL_SIZE / 2;

          const dx = mouseX - cx;
          const dy = mouseY - cy;
          const dist = Math.sqrt(dx * dx + dy * dy);

          let excitation = grid[index];
          
          // If within blast radius, excite the cell
          if (dist < RADIUS) {
            // Inverse distance calculation: closer to center = closer to 1
            const target = 1 - Math.pow(dist / RADIUS, 2); 
            if (target > excitation) {
              excitation += (target - excitation) * 0.3; // ease towards target
            }
          }


          

          
          // Decay over time to leave a trail
          excitation -= TRAIL_DECAY;
          if (excitation < 0) excitation = 0;
          
          grid[index] = excitation;

          // Render
          if (excitation > 0.02) {
            // Add a rhythmic pulse based on time and position for a shimmering effect
            const time = Date.now() * PULSE_SPEED;
            const pulse = Math.sin(time + x * 0.2 + y * 0.2) * 0.25 + 0.75; // oscillates between 0.5 and 1.0
            
            // Draw Cross
            const size = (2 + (10 * excitation)) * pulse; // Cross pulses in size
            const alpha = (0.2 + (excitation * 0.8)) * pulse; // Cross pulses in brightness
            
            // Calculate if a white wave is passing over
            let whiteMix = 0;
            if (isMouseDown) whiteMix = 0.3; // Slight global white tint while holding
            
            for (let i = 0; i < ripples.length; i++) {
              const rRipple = ripples[i];
              const dxRipple = rRipple.x - cx;
              const dyRipple = rRipple.y - cy;
              const distRipple = Math.sqrt(dxRipple * dxRipple + dyRipple * dyRipple);
              
              const distanceToRippleEdge = Math.abs(distRipple - rRipple.radius);
              if (distanceToRippleEdge < 40) { // Wave thickness
                whiteMix = Math.max(whiteMix, 1 - (distanceToRippleEdge / 40));
              }
            }
            
            // Mix Lime and White
            const rColor = Math.round(163 + (255 - 163) * whiteMix);
            const gColor = Math.round(230 + (255 - 230) * whiteMix);
            const bColor = Math.round(53 + (255 - 53) * whiteMix);
            
            const color = `rgba(${rColor}, ${gColor}, ${bColor}, ${alpha})`;
            ctx.fillStyle = color;
            
            // Draw Cross
            ctx.fillRect(cx - size / 2, cy - 1, size, 2);
            ctx.fillRect(cx - 1, cy - size / 2, 2, size);
          }
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      cancelAnimationFrame(animationFrameId);
    };
  }, [disabled]); // re-bind events when disabled state changes

  // Force mouse out when disabled
  useEffect(() => {
    if (disabled) {
      // Simulate mouse leaving so trails fade naturally
      document.dispatchEvent(new Event('mouseleave'));
    }
  }, [disabled]);

  return (
    <canvas 
      ref={canvasRef} 
      className="absolute inset-0 pointer-events-none z-0"
    />
  );
}

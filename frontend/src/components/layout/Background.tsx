export function AuthBackground() {
  return (
    <div 
      className="absolute inset-0 z-0 overflow-hidden" 
      style={{ backgroundColor: 'var(--color-primary, #0D4A33)' }}
    >
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          {/* 1. DEFINE THE ICONS ONCE */}
          {/* Laptop */}
          <g id="icon-laptop">
            <rect x="3" y="4" width="18" height="12" rx="2" />
            <path d="M2 16h20l-1.5 3.5a1 1 0 0 1-1 .5h-15a1 1 0 0 1-1-.5L2 16z" />
          </g>
          
          {/* Briefcase */}
          <g id="icon-briefcase">
            <rect x="4" y="7" width="16" height="14" rx="2" />
            <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            <path d="M4 12h16" />
          </g>

          {/* Robot Head */}
          <g id="icon-robot">
            <rect x="5" y="8" width="14" height="13" rx="3" />
            <path d="M12 8V4" />
            <circle cx="12" cy="3" r="1" />
            <path d="M3 13h2M19 13h2" />
            <path d="M9 13v.01M15 13v.01M9 17h6" />
          </g>

          {/* AI Node / Microchip (Paths updated to overlap the box and prevent gaps) */}
          <g id="icon-node">
            <rect x="6" y="6" width="12" height="12" rx="2" />
            <path d="M7 9H3M7 15H3M21 9H17M21 15H17M9 7V3M15 7V3M9 21V17M15 21V17" />
          </g>

          {/* 2. CREATE THE SCATTERED PATTERN */}
          <pattern 
            id="ai-tasker-pattern" 
            x="0" 
            y="0" 
            width="180" 
            height="180" 
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            {/* INFINITE SCROLL
              Because the canvas is rotated 45deg, moving exactly -180 on the Y axis 
              sends the pattern floating perfectly toward the top-right corner. 
              additive="sum" ensures this translation is added to the rotation above.
            */}
            <animateTransform 
              attributeName="patternTransform" 
              type="translate" 
              from="0 0" 
              to="0 -180" 
              dur="50s" 
              repeatCount="indefinite" 
              additive="sum" 
            />
            
            {/* Global style for the doodles (Rotation removed from here) */}
            <g 
              fill="none" 
              stroke="var(--color-secondary, #5C5F61)" 
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.35"
            >
              {/* Row 1 */}
              <use href="#icon-robot" transform="translate(10, 10) scale(1.1) rotate(-10 12 12)" />
              <use href="#icon-node" transform="translate(70, 5) scale(0.9) rotate(15 12 12)" />
              <use href="#icon-laptop" transform="translate(130, 20) scale(1.2) rotate(-5 12 12)" />

              {/* Row 2 */}
              <use href="#icon-briefcase" transform="translate(40, 55) scale(1) rotate(20 12 12)" />
              <use href="#icon-laptop" transform="translate(100, 50) scale(1.1) rotate(-15 12 12)" />
              <use href="#icon-robot" transform="translate(150, 70) scale(0.9) rotate(5 12 12)" />

              {/* Row 3 */}
              <use href="#icon-node" transform="translate(15, 105) scale(1.2) rotate(10 12 12)" />
              <use href="#icon-robot" transform="translate(65, 115) scale(1) rotate(-20 12 12)" />
              <use href="#icon-briefcase" transform="translate(125, 95) scale(1.15) rotate(12 12 12)" />

              {/* Row 4 */}
              <use href="#icon-laptop" transform="translate(45, 150) scale(0.95) rotate(-12 12 12)" />
              <use href="#icon-briefcase" transform="translate(95, 155) scale(1.05) rotate(8 12 12)" />
              <use href="#icon-node" transform="translate(145, 145) scale(1) rotate(-5 12 12)" />
            </g>
          </pattern>
        </defs>
        
        {/* Draw the background */}
        <rect width="100%" height="100%" fill="url(#ai-tasker-pattern)" />
      </svg>
    </div>
  );
}
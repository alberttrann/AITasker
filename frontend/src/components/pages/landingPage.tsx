import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import AuthModal from "@/components/auth/AuthModal";
import { ArrowRight } from "lucide-react";
import { LiveClock } from '@/components/ui/LiveClock';

export default function LandingPage() {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signup');
  const [activeMode, setActiveMode] = useState<'business' | 'expert'>('business');
  const [isHoveringHeading, setIsHoveringHeading] = useState(false);
  
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  
  const maskRef = useRef<HTMLDivElement>(null);
  const disabledRef = useRef(false);
  const isTransitioningRef = useRef(false);
  const isHoveringButtonRef = useRef(false);
  const triggerToggleRef = useRef(() => {});
  const lastActiveModeRef = useRef(activeMode);

  useEffect(() => {
    disabledRef.current = isAuthModalOpen;
  }, [isAuthModalOpen]);

  triggerToggleRef.current = () => {
    setActiveMode(prev => prev === 'business' ? 'expert' : 'business');
  };

  useEffect(() => {
    if (lastActiveModeRef.current !== activeMode) {
      lastActiveModeRef.current = activeMode;
      // DOM swap just happened, safe to clear the mask
      window.dispatchEvent(new Event('clearMask'));
    }
  }, [activeMode]);

  useEffect(() => {
    let animationFrameId: number;
    let mouseX = -1000;
    let mouseY = -1000;
    let recoverProgress = 1;
    let hoverScale = 1;
    
    // Config for blobling sharp mask
    const RADIUS = 150; 
    const TRAIL_LIFE_DECAY = 0.2;
    
    interface Point {
      x: number;
      y: number;
      life: number;
    }
    let points: Point[] = [];
    
    interface Ripple {
      x: number;
      y: number;
      radius: number;
      maxRadius: number;
      speed: number;
      isTransitionWave?: boolean;
      _hasTriggeredToggle?: boolean;
    }
    const ripples: Ripple[] = [];

    const handleMouseMove = (e: MouseEvent) => {
      if (disabledRef.current || isTransitioningRef.current) return;
      mouseX = e.clientX;
      mouseY = e.clientY;
    };

    const handleMouseLeave = () => {
      mouseX = -1000;
      mouseY = -1000;
    };

    const handleSpawnWave = (e: Event) => {
      const customE = e as CustomEvent;
      ripples.push({
        x: customE.detail.x,
        y: customE.detail.y,
        radius: 0,
        maxRadius: Math.max(window.innerWidth, window.innerHeight) * 1.5,
        speed: 50,
        isTransitionWave: true
      });
    };

    const handleClearMask = () => {
      points = [];
      ripples.length = 0;
      recoverProgress = 0;
      isTransitioningRef.current = false;
    };

    window.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);
    window.addEventListener('spawnWave', handleSpawnWave);
    window.addEventListener('clearMask', handleClearMask);

    const render = () => {
      // Decay trail points
      points.forEach(p => p.life -= TRAIL_LIFE_DECAY);
      points = points.filter(p => p.life > 0);

      // Add new point for trail if not transitioning
      if (!isTransitioningRef.current && mouseX !== -1000 && mouseY !== -1000) {
        points.push({ x: mouseX, y: mouseY, life: 1 });
      }

      // Update ripples
      let waveFinished = false;
      for (let i = ripples.length - 1; i >= 0; i--) {
        ripples[i].radius += ripples[i].speed;
        
        // We only want to trigger the toggle ONCE when the wave crosses the threshold
        if (ripples[i].isTransitionWave && ripples[i].radius > ripples[i].maxRadius * 0.9 && !ripples[i]._hasTriggeredToggle) {
          ripples[i]._hasTriggeredToggle = true;
          waveFinished = true;
        }
        
        if (ripples[i].radius > ripples[i].maxRadius) {
          ripples.splice(i, 1);
        }
      }

      if (waveFinished) {
        triggerToggleRef.current();
      }

      if (recoverProgress < 1) {
        recoverProgress = Math.min(1, recoverProgress + 0.03);
      }
      
      if (isHoveringButtonRef.current) {
        hoverScale = Math.max(0, hoverScale - 0.08); // shrink fast
      } else {
        hoverScale = Math.min(1, hoverScale + 0.08); // grow fast
      }
      
      const cursorScale = 1 - Math.pow(1 - recoverProgress, 3); // Ease out cubic

      if (maskRef.current) {
        if (points.length === 0 && ripples.length === 0) {
           maskRef.current.style.maskImage = 'linear-gradient(to bottom, transparent, transparent)';
           maskRef.current.style.webkitMaskImage = 'linear-gradient(to bottom, transparent, transparent)';
        } else {
           // Sharp blobs logic
           const pointGradients = points.map(p => {
             const r = RADIUS * Math.pow(p.life, 0.5) * cursorScale * hoverScale;
             return `radial-gradient(circle at ${p.x}px ${p.y}px, black ${Math.max(0, r - 1)}px, transparent ${r}px)`;
           });
           
           const rippleGradients = ripples.map(r => 
             `radial-gradient(circle at ${r.x}px ${r.y}px, black ${Math.max(0, r.radius - 1)}px, transparent ${r.radius}px)`
           );
           
           const allGradients = [...pointGradients, ...rippleGradients].join(', ');
           
           maskRef.current.style.maskImage = allGradients;
           maskRef.current.style.webkitMaskImage = allGradients;
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('spawnWave', handleSpawnWave);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  const handleToggleClick = useCallback((e: React.MouseEvent) => {
    if (isTransitioningRef.current) return;
    isTransitioningRef.current = true;
    
    window.dispatchEvent(new CustomEvent('spawnWave', { 
      detail: { x: e.clientX, y: e.clientY } 
    }));
  }, []);

  const handleCtaClick = () => {
    if (isAuthenticated) {
      if (!user) return navigate('/');
      
      const role = user.activeRole;
      const subtype = user.clientSubtype;

      if (role === 'CLIENT' && subtype === 'CEO') return navigate('/ceo');
      if (role === 'CLIENT' && subtype === 'TECH_TEAM') return navigate('/tech-team');
      if (role === 'ADMIN') return navigate('/admin');
      if (role === 'EXPERT') return navigate('/expert');
      navigate('/');
    } else {
      setAuthMode('signup');
      setIsAuthModalOpen(true);
    }
  };

  interface ContentProps {
    mode: 'business' | 'expert';
    isMasked?: boolean;
    renderMode: 'backgroundAndText' | 'buttonsOnly';
  }

  const Content = ({ mode, isMasked, renderMode }: ContentProps) => {
    const isBusiness = mode === 'business';
    const isButtonsOnly = renderMode === 'buttonsOnly';
    
    return (
      <section className={`absolute inset-0 flex flex-col items-center justify-center overflow-hidden px-6 lg:px-12 py-24 text-center ${isButtonsOnly ? 'bg-transparent pointer-events-none' : (isBusiness ? 'bg-primary' : 'bg-[#EFEBE3]')}`}>
        
        {/* Background Elements */}
        {!isButtonsOnly && (
          <>
            <div 
              className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none" 
              style={{ 
                backgroundImage: `linear-gradient(to right, ${isBusiness ? '#ffffff' : '#000000'} 1px, transparent 1px), linear-gradient(to bottom, ${isBusiness ? '#ffffff' : '#000000'} 1px, transparent 1px)`, 
                backgroundSize: '32px 32px' 
              }}
            ></div>

            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-150 h-150 rounded-full blur-[120px] opacity-60 ${isBusiness ? 'bg-tertiary/20' : 'bg-blue-500/10'}`}></div>
              <div className={`absolute top-[10%] left-[20%] w-96 h-96 rounded-full blur-[120px] opacity-60 ${isBusiness ? 'bg-emerald-500/10' : 'bg-purple-500/10'}`}></div>
              <div className={`absolute bottom-[10%] right-[20%] w-96 h-96 rounded-full blur-[120px] opacity-60 ${isBusiness ? 'bg-blue-500/10' : 'bg-amber-500/10'}`}></div>
            </div>
            
            <div 
              className={`absolute -inset-25 -z-10 pointer-events-none backdrop-blur-md rounded-full ${isBusiness ? 'bg-primary/10' : 'bg-white/20'}`} 
              style={{ 
                maskImage: 'radial-gradient(circle at center, black 40%, transparent 70%)', 
                WebkitMaskImage: 'radial-gradient(circle at center, black 40%, transparent 70%)' 
              }}
            ></div>
          </>
        )}

        <div className="max-w-4xl mx-auto relative z-10 flex flex-col items-center w-full">
          
          <LiveClock className={`mb-8 justify-center transition-colors ${isButtonsOnly ? 'opacity-0 pointer-events-none' : (isBusiness ? 'text-slate-400' : 'text-stone-500')}`} />
          
          <h1 className={`text-display text-[56px] md:text-[72px] leading-[1.1] mb-8 ${isButtonsOnly ? 'opacity-0 pointer-events-none' : (isBusiness ? 'text-white' : 'text-stone-900')}`}>
            {isBusiness ? (
              <>Find the right freelance <br />
                <span 
                  className={`inline-block cursor-pointer transition-all duration-200 relative z-20 ${isHoveringHeading ? 'scale-[1.03] -translate-y-1 text-emerald-400 drop-shadow-[0_0_10px_rgba(16,185,129,0.4)]' : 'text-tertiary'}`}
                  onClick={isMasked || isButtonsOnly ? undefined : handleToggleClick}
                  onMouseEnter={isMasked || isButtonsOnly ? undefined : () => setIsHoveringHeading(true)}
                  onMouseLeave={isMasked || isButtonsOnly ? undefined : () => setIsHoveringHeading(false)}
                  style={{ pointerEvents: isMasked || isButtonsOnly ? 'none' : 'auto' }}
                >
                  AI expert
                </span>, right away.
              </>
            ) : (
              <>Find the right innovative <br />
                <span 
                  className={`inline-block cursor-pointer transition-all duration-200 relative z-20 ${isHoveringHeading ? 'scale-[1.03] -translate-y-1 text-blue-600 drop-shadow-[0_0_10px_rgba(37,99,235,0.3)]' : 'text-blue-700'}`}
                  onClick={isMasked || isButtonsOnly ? undefined : handleToggleClick}
                  onMouseEnter={isMasked || isButtonsOnly ? undefined : () => setIsHoveringHeading(true)}
                  onMouseLeave={isMasked || isButtonsOnly ? undefined : () => setIsHoveringHeading(false)}
                  style={{ pointerEvents: isMasked || isButtonsOnly ? 'none' : 'auto' }}
                >
                  Business
                </span>, right away.
              </>
            )}
          </h1>
          
          <p className={`text-body-lg mt-2 max-w-2xl text-[18px] md:text-[22px] leading-relaxed ${isButtonsOnly ? 'opacity-0 pointer-events-none' : (isBusiness ? 'text-slate-300' : 'text-stone-600')}`}>
            {isBusiness 
              ? 'Skip the keyword search. We intelligently match you with verified AI professionals who have the precise skills needed to build and scale your AI systems.'
              : 'Skip the resume filters. We connect your proven expertise with top-tier companies looking to build serious, production-ready AI applications.'}
          </p>
          
          <div 
            className={`flex flex-col sm:flex-row items-center justify-center gap-6 pt-12 relative z-20 ${!isButtonsOnly ? 'opacity-0 pointer-events-none' : 'pointer-events-auto'}`}
            onMouseEnter={isButtonsOnly ? () => { isHoveringButtonRef.current = true; } : undefined}
            onMouseLeave={isButtonsOnly ? () => { isHoveringButtonRef.current = false; } : undefined}
          >
            <button
              onClick={handleCtaClick}
              className={`${isBusiness ? 'bg-tertiary hover:bg-emerald-400 text-slate-950 shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)]' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)]'} font-headline font-bold text-[18px] px-10 h-15 rounded-[10px] transition-all duration-150 flex items-center gap-3 active:scale-95`}
            >
              {isAuthenticated ? 'Back to Dashboard' : "Let's start"} <ArrowRight className="w-6 h-6" />
            </button>
            {!isAuthenticated && (
              <button 
                onClick={() => { setAuthMode('signin'); setIsAuthModalOpen(true); }}
                className={`${isBusiness ? 'text-slate-300 hover:text-white' : 'text-stone-500 hover:text-stone-900'} font-headline font-semibold px-8 py-4 text-[18px] transition-colors`}
              >
                Already have an account?
              </button>
            )}
          </div>
        </div>
        
        {!isButtonsOnly && (
          <div className={`hidden sm:block absolute bottom-8 left-6 lg:left-12 text-sm font-medium z-10 whitespace-nowrap ${isBusiness ? 'text-slate-500' : 'text-stone-400'}`}>
            &copy; 2026 AITasker. All rights reserved.
          </div>
        )}
      </section>
    );
  };

  const inactiveMode = activeMode === 'business' ? 'expert' : 'business';

  return (
    <div className="min-h-screen bg-background flex flex-col font-body relative">
      <main className="grow flex flex-col relative min-h-screen overflow-hidden">
        {/* Active Layer (Base) */}
        <div className="absolute inset-0 z-0">
          <Content mode={activeMode} renderMode="backgroundAndText" />
        </div>

        {/* Masked Layer (Reveal on hover) */}
        <div 
          ref={maskRef}
          className="absolute inset-0 z-10 pointer-events-none"
          style={{
            maskComposite: 'add',
            WebkitMaskComposite: 'source-over',
            maskRepeat: 'no-repeat',
            WebkitMaskRepeat: 'no-repeat'
          }}
        >
          <Content mode={inactiveMode} isMasked={true} renderMode="backgroundAndText" />
        </div>

        {/* Global Buttons Overlay */}
        <div className="absolute inset-0 z-20 pointer-events-none">
          <Content mode={activeMode} renderMode="buttonsOnly" />
        </div>
      </main>

      {/* Auth Modal overlay */}
      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
        initialMode={authMode} 
      />
    </div>
  );
}
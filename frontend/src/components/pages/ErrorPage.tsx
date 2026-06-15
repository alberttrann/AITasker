import { useState } from 'react';
import { Link } from 'react-router-dom';

export default function ErrorPage() {
  // React state to handle the micro-interaction for the rocket icon
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div className="bg-background text-on-surface flex flex-col min-h-screen relative overflow-x-hidden">
      
      {/* Main Content Canvas */}
      <main className="flex-grow flex flex-col items-center justify-center relative px-sm text-center w-full">
        
        {/* Subtle AI Background Patterns (Mapped to your CSS variables) */}
        <div
          className="absolute inset-0 pointer-events-none opacity-20"
          style={{
            backgroundImage: 'radial-gradient(circle at 2px 2px, var(--color-outline-variant) 1px, transparent 0)',
            backgroundSize: '40px 40px',
          }}
        />
        <div className="absolute w-[400px] h-[400px] -top-20 -left-20 animate-pulse rounded-full bg-primary-container opacity-10 blur-[40px] -z-10" />
        <div
          className="absolute w-[300px] h-[300px] bottom-40 -right-10 animate-pulse rounded-full bg-primary-container opacity-10 blur-[40px] -z-10"
          style={{ animationDelay: '1s' }}
        />

        <div className="max-w-2xl w-full z-10 space-y-md">
          {/* 404 Heading */}
          <div className="relative inline-block mb-lg">
            <h1 className="text-[120px] md:text-[180px] leading-none text-primary font-extrabold tracking-tighter select-none opacity-10">
              404
            </h1>
            <div className="absolute inset-0 flex items-center justify-center">
              <span
                className="material-symbols-outlined text-primary text-[80px] md:text-[120px] transition-transform duration-500 ease-[cubic-bezier(0.175,0.885,0.32,1.275)] cursor-default"
                style={{
                  fontVariationSettings: "'wght' 200",
                  transform: isHovered ? 'translateY(-10px) rotate(5deg)' : 'translateY(0) rotate(0deg)',
                }}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
              >
                rocket_launch
              </span>
            </div>
          </div>

          {/* Message Area */}
          <div className="space-y-md">
            <h2 className="font-headline-md text-headline-md text-primary">
              Oops! This task seems to be out of scope.
            </h2>
            <p className="font-body-md text-body-md text-secondary max-w-lg mx-auto">
              The page you are looking for might have been moved, deleted, or never existed. Let's get you back to work.
            </p>
          </div>

          {/* Call to Action Cluster */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-md pt-xl">
            <Link
              to="/"
              className="bg-primary-container text-on-primary px-lg py-sm rounded-xl font-label-md text-label-md flex items-center gap-xs shadow-sm hover:shadow-md transition-all active:opacity-80"
            >
              <span className="material-symbols-outlined">dashboard</span>
              Back to Dashboard
            </Link>
            <a
              href="#"
              className="text-primary font-label-md text-label-md flex items-center gap-xs hover:underline"
            >
              <span className="material-symbols-outlined">support_agent</span>
              Contact Support
            </a>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-xl bg-surface border-t border-outline-variant">
        <div className="max-w-[1280px] mx-auto px-md pt-xl border-t border-outline-variant/30 flex justify-between items-center">
          <span className="font-label-md text-label-md text-secondary opacity-70">
            © 2026 AITasker Inc. All rights reserved.
          </span>
          <div className="flex gap-md">
            <span className="material-symbols-outlined text-secondary hover:text-primary cursor-pointer transition-colors" style={{ fontSize: '20px' }}>
              language
            </span>
            <span className="material-symbols-outlined text-secondary hover:text-primary cursor-pointer transition-colors" style={{ fontSize: '20px' }}>
              info
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
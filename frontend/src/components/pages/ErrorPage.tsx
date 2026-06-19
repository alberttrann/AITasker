import { useNavigate } from 'react-router-dom';

export default function ErrorPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-6 bg-background overflow-hidden relative select-none">
      
      {/* Subtle floating background elements to break up the empty space */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-primary/5 rounded-full mix-blend-multiply filter blur-3xl opacity-70"></div>
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-error/5 rounded-full mix-blend-multiply filter blur-3xl opacity-70"></div>

      <div className="relative z-10 text-center max-w-2xl w-full">
        
        {/* Massive 404 Typography */}
        <h1 className="text-[10rem] md:text-[14rem] font-black tracking-tighter text-primary leading-none drop-shadow-sm">
          404
        </h1>
        
        {/* Animated Status Badge floating over the text */}
        <div className="inline-flex items-center justify-center px-4 py-1.5 mb-8 rounded-full bg-surface/80 border border-outline-variant shadow-sm backdrop-blur-md -mt-6 md:-mt-10 relative z-20">
          <span className="flex w-2 h-2 rounded-full bg-error mr-2 animate-pulse"></span>
          <span className="font-label-md text-xs md:text-sm text-on-surface uppercase tracking-widest font-semibold">
            System Route Missing
          </span>
        </div>
        
        <h2 className="text-3xl md:text-4xl font-bold text-on-surface mb-4 tracking-tight">
          We lost this page in the void.
        </h2>
        
        <p className="w-full max-w-[448px] mx-auto text-base md:text-lg text-on-surface-variant mb-10 leading-relaxed whitespace-normal">
          The link you followed might be broken, or the page has been moved. Let's get you back to familiar territory.
        </p>

        {/* Action Buttons with icons and scale animations */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <button
            onClick={() => navigate(-1)}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-surface border border-outline-variant hover:bg-surface-container-low text-on-surface font-medium py-3 px-8 rounded-lg transition-all duration-200 shadow-sm hover:shadow active:scale-[0.98]"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Go Back
          </button>
          
          <button
            onClick={() => navigate('/')}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-primary text-on-primary font-medium py-3 px-8 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg hover:opacity-90 active:scale-[0.98]"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Return Home
          </button>
        </div>

      </div>
    </div>
  );
}
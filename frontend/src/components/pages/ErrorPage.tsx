import { useNavigate } from 'react-router-dom';

export default function ErrorPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-6 bg-surface-base overflow-hidden relative select-none">
      
      {/* Subtle floating background elements to break up the empty space */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-accent-light/30 rounded-full blur-3xl opacity-70"></div>
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-coral-light/20 rounded-full blur-3xl opacity-70"></div>

      <div className="relative z-10 text-center max-w-2xl w-full flex flex-col items-center">
        
        {/* Massive 404 Typography */}
        <div className="relative inline-block mb-4">
          <h1 className="text-[10rem] md:text-[14rem] font-headline font-extrabold tracking-widest text-primary-dark leading-none drop-shadow-sm -rotate-3 z-10 relative">
            404
          </h1>
          {/* Decorative background for 404 */}
          <div className="absolute inset-0 bg-accent rounded-[32px] -rotate-6 z-0 shadow-accent-glow translate-y-8 scale-90"></div>
        </div>
        
        {/* Animated Status Badge floating over the text */}
        <div className="inline-flex items-center justify-center px-4 py-2 mb-8 rounded-full bg-cream border-2 border-coral shadow-sm backdrop-blur-md relative z-20">
          <span className="flex w-3 h-3 rounded-full bg-coral mr-2 animate-pulse shadow-coral-glow"></span>
          <span className="font-headline text-xs md:text-sm text-primary-dark uppercase tracking-widest font-extrabold">
            System Route Missing
          </span>
        </div>
        
        <h2 className="text-3xl md:text-4xl font-headline font-extrabold text-primary-dark mb-4 tracking-wide">
          We lost this page in the void.
        </h2>
        
        <p className="w-[90%] sm:w-[448px] max-w-full mx-auto text-base md:text-lg text-primary-dark/80 font-body mb-10 leading-relaxed bg-primary-bg p-4 rounded-[16px] border border-primary-light/30">
          The link you followed might be broken, or the page has been moved. Let's get you back to familiar territory.
        </p>

        {/* Action Buttons with icons and scale animations */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center w-full">
          <button
            onClick={() => navigate(-1)}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-cream border-2 border-primary-light hover:bg-primary-bg text-primary-dark font-headline font-bold py-4 px-8 rounded-full transition-all duration-300 shadow-sm hover:shadow-teal-glow active:scale-95 min-h-[72px]"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Go Back
          </button>
          
          <button
            onClick={() => navigate('/')}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-accent to-accent-light text-primary-dark font-headline font-extrabold py-4 px-8 rounded-full transition-all duration-300 shadow-accent-glow hover:brightness-110 active:scale-95 min-h-[72px]"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Return Home
          </button>
        </div>

      </div>
    </div>
  );
}
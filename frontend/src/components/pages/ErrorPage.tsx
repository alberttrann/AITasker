import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function ErrorPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-6 bg-surface-base overflow-hidden relative select-none shrink-0 min-w-0">

      {/* Subtle floating background elements to break up the empty space */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-accent-light/30 rounded-full blur-3xl opacity-70"></div>
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-coral-light/20 rounded-full blur-3xl opacity-70"></div>

      <div className="w-full max-w-5xl mx-auto flex flex-col items-center justify-center relative z-10 min-w-0">
        <div className="relative z-10 text-center max-w-5xl w-full flex flex-col items-center shrink-0 min-w-0">

          {/* Massive 404 Typography */}
          <div className="relative inline-block mb-4">
            <h1 className="text-[10rem] md:text-[14rem] font-headline font-extrabold tracking-widest text-primary-dark leading-none drop-shadow-sm -rotate-3 z-10 relative">
              404
            </h1>
            {/* Decorative background for 404 */};
            <div className="absolute inset-0 bg-accent rounded-[32px] -rotate-6 z-0 shadow-accent-glow scale-90"></div>
          </div>

          {/* Animated Status Badge floating over the text */}
          <div className="inline-flex items-center justify-center px-4 py-2 mb-8 rounded-full bg-cream border-2 border-coral shadow-sm backdrop-blur-md relative z-20">
            <span className="flex w-3 h-3 rounded-full bg-coral mr-2 animate-pulse shadow-coral-glow"></span>
            <span className="font-headline text-xs md:text-sm text-primary-dark uppercase tracking-widest font-extrabold">
              System Route Missing
            </span>
          </div>

          <h2 className="text-xl md:text-4xl font-headline font-extrabold text-primary-dark mb-4 tracking-wide shrink-0 min-w-0">
            We lost this page in the void.
          </h2>

          <p className="w-[90%] sm:max-w-4xl max-w-full mx-auto text-base md:text-lg text-primary-dark/80 font-body mb-10 leading-relaxed bg-primary-bg p-4 rounded-[16px] border border-primary-light/30 shrink-0 min-w-0">
            The link you followed might be broken, or the page has been moved. Let's get you back to familiar territory.
          </p>

          {/* Action Button */}
          <div className="flex justify-center items-center w-full shrink-0 mt-4">
            <button
              onClick={() => navigate(-1)}
              className="w-full sm:w-auto flex items-center justify-center gap-3 bg-accent hover:bg-accent-light text-primary-dark font-headline font-extrabold text-lg py-4 px-10 rounded-full transition-all duration-300 shadow-accent-glow hover:-translate-y-1 active:scale-95 min-h-[72px] shrink-0"
            >
              <ArrowLeft className="w-6 h-6" />
              Go Back
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
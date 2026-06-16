import { useNavigate } from 'react-router-dom';

export default function ErrorPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="text-center max-w-[448px] bg-surface p-xl rounded-xl border border-outline-variant shadow-sm">
        
        {/* Simple 404 Icon */}
        <div className="mb-lg flex justify-center">
          <div className="rounded-full bg-surface-container-low border border-outline-variant p-md shadow-sm">
            <svg 
              className="h-12 w-12 text-primary" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={1.5} 
                d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
              />
            </svg>
          </div>
        </div>

        <h1 className="font-headline-lg text-headline-lg text-primary mb-xs">
          404
        </h1>
        <h2 className="font-headline-sm text-headline-sm text-on-surface mb-sm">
          Page Not Found
        </h2>
        
        <p className="font-body-md text-body-md text-on-surface-variant mb-lg">
          Oops! We couldn't find the page you're looking for. It might have been moved, deleted, or perhaps the URL is incorrect.
        </p>

        <div className="flex flex-col sm:flex-row gap-sm justify-center">
          <button
            onClick={() => navigate(-1)}
            className="w-full sm:w-auto bg-surface border border-outline-variant hover:bg-surface-container-low text-on-surface font-label-md text-label-md py-sm px-lg rounded transition-colors shadow-sm"
          >
            Go Back
          </button>
          <button
            onClick={() => navigate('/')}
            className="w-full sm:w-auto bg-primary-container hover:bg-primary text-on-primary font-label-md text-label-md py-sm px-lg rounded transition-colors shadow-sm hover:shadow"
          >
            Return Home
          </button>
        </div>

      </div>
    </div>
  );
}
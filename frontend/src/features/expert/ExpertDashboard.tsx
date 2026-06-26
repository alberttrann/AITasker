import { Outlet, useNavigate } from 'react-router-dom';
import TopNav from "@/components/layout/TopNav"
import { ArrowLeft } from 'lucide-react';

export function ExpertOverview() {
  const navigate = useNavigate();

  return (
    <div className="w-full">
      <div className="bg-surface rounded-xl border border-outline-variant p-md shadow-sm">
        <div className="flex items-center gap-3 mb-xs">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg hover:bg-slate-200 transition-colors text-slate-600 hover:text-slate-900"
            aria-label="Go back"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="font-headline-md text-headline-md text-primary m-0">
            Expert Dashboard
          </h1>
        </div>
        <p className="font-body-md text-body-md text-on-surface-variant">
          You are currently viewing the Expert overview page.
        </p>
      </div>
    </div>
  );
}

export default function ExpertDashboard() {
  return (
    <>
      <TopNav />
      <div className="bg-background min-h-screen">
        <div className="w-full max-w-[1440px] mx-auto px-6 py-6 sm:py-8">
          <Outlet />
        </div>
      </div>
    </>
  );
}
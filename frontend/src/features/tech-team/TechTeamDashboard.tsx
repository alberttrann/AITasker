import { Outlet, useLocation } from 'react-router-dom';
import TopNav from '../../components/layout/TopNav'; 

export default function TechTeamDashboard() {
  const location = useLocation();
  // Evaluated on every render (including route changes)
  const isFillingForm = !!sessionStorage.getItem('handoff_sessionId');

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {!isFillingForm && <TopNav />}
      <main className="flex-grow w-full max-w-6xl mx-auto px-6 py-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}

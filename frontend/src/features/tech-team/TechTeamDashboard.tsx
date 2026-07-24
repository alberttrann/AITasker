import { Outlet, useLocation } from 'react-router-dom';
import TopNav from '../../components/layout/TopNav'; 
import Stage4Form from './stage4/Stage4Form';

export default function TechTeamDashboard() {
  const location = useLocation();
  // Evaluated on every render (including route changes)
  const isFillingForm = !!sessionStorage.getItem('handoff_sessionId');

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {!isFillingForm && <TopNav />}
      <main className="flex-grow w-full max-w-[1440px] mx-auto px-6 py-6 sm:py-8">
        {isFillingForm ? <Stage4Form /> : <Outlet />}
      </main>
    </div>
  );
}

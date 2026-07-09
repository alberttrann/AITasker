import { Outlet } from "react-router-dom";
import TopNav from "@/components/layout/TopNav";

export default function AdminDashboard() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <TopNav />
      <main className="flex-grow w-full max-w-6xl mx-auto px-6 py-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}

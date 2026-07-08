import { Outlet } from "react-router-dom";
import TopNav from "@/components/layout/TopNav";

export default function AdminDashboard() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-['DM_Sans']">
      <TopNav />
      <main className="flex-grow w-full max-w-[1440px] mx-auto px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
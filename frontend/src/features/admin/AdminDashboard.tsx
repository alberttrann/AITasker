import { Outlet } from "react-router-dom";
import TopNav from "@/components/layout/TopNav";
import AdminSidebar from "@/features/admin/layout/AdminLayout";

export default function AdminDashboard() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <TopNav />
      <div className="flex flex-1">
        <AdminSidebar />
        <main className="flex-grow w-full max-w-[1440px] mx-auto px-4 sm:px-6 py-6 sm:py-8 lg:pl-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

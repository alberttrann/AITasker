import DashboardGreeting from "@/components/layout/DashboardGreeting";

export default function AdminDashboard() {
  return (
    <div className="p-md sm:p-lg bg-background min-h-screen">
      <DashboardGreeting />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 lg:auto-rows-[180px]">
        <div className="lg:col-span-3 lg:row-span-1 h-full">
          <div className="bg-surface h-full rounded-xl border border-outline-variant p-md shadow-sm flex flex-col justify-center">
            <h1 className="font-headline-md text-headline-md text-primary mb-xs">
              Admin Dashboard
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant">
              You are currently viewing the Admin overview page.
            </p>
          </div>
        </div>

        <div className="lg:col-span-3 lg:row-span-1 h-full">
          <div className="relative h-full overflow-hidden rounded-2xl border-2 border-dashed border-slate-300 p-8 flex flex-col items-center justify-center text-center bg-transparent">
            <h2 className="text-2xl font-bold text-slate-700">Admin Dashboard</h2>
            <p className="text-slate-500 mt-2">This section is currently in development.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
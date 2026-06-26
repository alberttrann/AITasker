export default function AdminDashboard() {
  return (
    <div className="p-md sm:p-lg bg-background min-h-screen">
      <div className="bg-surface rounded-xl border border-outline-variant p-md shadow-sm mb-6">
        <h1 className="font-headline-md text-headline-md text-primary mb-xs">
          Admin Dashboard
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          You are currently viewing the Admin overview page.
        </p>
      </div>

      <div className="relative overflow-hidden rounded-2xl border-2 border-dashed border-slate-300 p-8 text-center bg-transparent">
        <h2 className="text-2xl font-bold text-slate-700">Admin Dashboard</h2>
        <p className="text-slate-500 mt-2">This section is currently in development.</p>
      </div>
    </div>
  );
}
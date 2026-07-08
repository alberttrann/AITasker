import DashboardGreeting from "@/components/layout/DashboardGreeting";

export default function AdminOverview() {
  return (
    <div className="p-md sm:p-lg">
      <DashboardGreeting />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 lg:auto-rows-[180px]">
        <div className="lg:col-span-3 lg:row-span-1 h-full">
          <div className="bg-surface h-full rounded-xl border border-outline-variant p-md shadow-sm flex flex-col justify-center">
            <h1 className="font-headline-md text-headline-md text-primary mb-xs">
              Admin Overview
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Welcome to the AITasker administrative control panel. Use the top navigation to view Analytics, resolve Disputes, or process Withdrawals.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

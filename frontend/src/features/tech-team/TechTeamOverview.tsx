import DashboardGreeting from "@/components/layout/DashboardGreeting";
import Stage4Form from "./stage4/Stage4Form";

export default function TechTeamOverview() {
  const handoffSessionId = sessionStorage.getItem('handoff_sessionId');

  if (handoffSessionId) {
    return <Stage4Form />;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <DashboardGreeting />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 lg:auto-rows-[180px]">
        <div className="lg:col-span-3 lg:row-span-1 h-full">
          <div className="bg-white h-full rounded-xl border border-slate-200/80 p-6 flex flex-col justify-center shadow-[0px_2px_6px_rgba(15,23,42,0.03)]">
            <h1 className="text-2xl font-bold text-slate-900 font-['Plus_Jakarta_Sans']">
              Tech Team Dashboard
            </h1>
            <p className="text-slate-600 mt-1 text-sm">
              You are currently viewing the Tech Team overview page.
            </p>
          </div>
        </div>

        <div className="lg:col-span-3 lg:row-span-1 h-full">
          <div className="border-2 h-full border-dashed border-slate-200 rounded-xl p-8 flex flex-col items-center justify-center text-center bg-white shadow-[0px_1px_3px_rgba(15,23,42,0.02)]">
            <h3 className="text-lg font-bold text-slate-900 mb-1 font-['Plus_Jakarta_Sans']">
              Tech Team Dashboard
            </h3>
            <p className="text-slate-500 text-sm">
              This section is currently in development.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

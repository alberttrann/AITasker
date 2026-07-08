import { useState } from "react";
import DashboardGreeting from "@/components/layout/DashboardGreeting";
import Stage4Form from "./stage4/Stage4Form";
import Widget, { WidgetMetric } from "@/components/dashboard/Widget";
import { Code } from "lucide-react";

export default function TechTeamOverview() {
  const handoffSessionId = sessionStorage.getItem('handoff_sessionId');

  if (handoffSessionId) {
    return <Stage4Form />;
  }

  const linkedProjectMetrics: WidgetMetric[] = [
    {
      id: 'linked-project',
      label: 'Linked Project',
      value: 'Active',
      subValue: 'View and manage integrations',
      icon: <Code size={20} />,
      href: '/tech-team/projects'
    }
  ];

  return (
    <div className="w-full">
      <DashboardGreeting />

      {/* Workspace Section */}
      <div className="mb-8">
        <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 px-1">Workspace</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
          <Widget metrics={linkedProjectMetrics} variant="blue" />
        </div>
      </div>
    </div>
  );
}

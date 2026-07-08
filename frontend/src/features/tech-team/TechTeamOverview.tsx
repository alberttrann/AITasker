import { useState } from "react";
import DashboardGreeting from "@/components/layout/DashboardGreeting";
import Stage4Form from "./stage4/Stage4Form";
import { SuggestBox } from "@/components/ui/SuggestBox";
import { Code } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function TechTeamOverview() {
  const handoffSessionId = sessionStorage.getItem('handoff_sessionId');
  const navigate = useNavigate();
  const [showLinkedProject, setShowLinkedProject] = useState(true);

  if (handoffSessionId) {
    return <Stage4Form />;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300 w-full">
      <DashboardGreeting />
      
      {/* FOR YOU Section */}
      {showLinkedProject && (
        <div className="mb-8">
          <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 px-1">For You</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6">
            <SuggestBox
              topLabel="Tech Team Overview"
              title="Linked Project"
              description="View your project specifications, manage integrations, and review technical bids from experts."
              icon={<Code className="h-6 w-6" />}
              buttonText="Go to projects"
              theme="outline"
              className="lg:col-span-3"
              onButtonClick={() => navigate("/tech-team/projects")}
              onDismiss={() => setShowLinkedProject(false)}
            />
          </div>
        </div>
      )}

      {/* Workspace Section */}
      <div className="mb-8">
        <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 px-1">Workspace</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Widgets go here */}
        </div>
      </div>
    </div>
  );
}

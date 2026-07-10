import { FolderKanban, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";

export default function ExpertServicesPage() {
  const navigate = useNavigate();

  return (
    <div className="w-full max-w-[1440px] px-6 mx-auto mb-12">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">My Services</h1>
        <p className="text-slate-500">Manage your profile, projects, and active engagements.</p>
      </div>

      <div className="flex flex-wrap gap-6">
        {/* Projects Card */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col items-center text-center p-8 transition-all hover:border-slate-300 hover:shadow-md w-full max-w-[260px]">
          <div className="w-16 h-16 flex items-center justify-center mb-4 text-blue-600">
            <FolderKanban className="w-8 h-8" strokeWidth={2} />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Projects</h2>
          <p className="text-slate-500 text-sm leading-relaxed mb-6">
            View your project invitations, submit bids, and manage your active workspaces.
          </p>
          <div className="w-full mt-auto">
            <Button 
              className="w-full"
              onClick={() => navigate('/expert/service/projects')}
            >
              Open Projects
            </Button>
          </div>
        </div>

        {/* Expert Profile Card */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col items-center text-center p-8 transition-all hover:border-slate-300 hover:shadow-md w-full max-w-[260px]">
          <div className="w-16 h-16 flex items-center justify-center mb-4 text-emerald-600">
            <User className="w-8 h-8" strokeWidth={2} />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Expert Profile</h2>
          <p className="text-slate-500 text-sm leading-relaxed mb-6">
            Manage your public profile, verification status, and professional details.
          </p>
          <div className="w-full mt-auto">
            <Button 
              className="w-full"
              onClick={() => navigate('/expert/service/expert-profile')}
            >
              Open Profile
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

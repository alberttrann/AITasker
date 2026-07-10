import { FolderKanban, User, Briefcase, PlusCircle } from "lucide-react";
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

      <div className="mt-12 mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900">Service Listings</h2>
        <Button onClick={() => navigate('/expert/service/create-listing')} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
          <PlusCircle className="w-4 h-4" /> Create Listing
        </Button>
      </div>
      
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 text-center text-slate-500">
        <Briefcase className="w-12 h-12 mx-auto text-slate-300 mb-4" />
        <p className="text-lg font-semibold text-slate-700 mb-2">No active service listings</p>
        <p className="max-w-md mx-auto mb-6">Create standardized service packages (e.g., "RAG Architecture Setup") that CEOs can purchase directly from the marketplace.</p>
        <Button onClick={() => navigate('/expert/service/create-listing')} variant="outline" className="gap-2">
          Create Your First Listing
        </Button>
      </div>
    </div>
  );
}

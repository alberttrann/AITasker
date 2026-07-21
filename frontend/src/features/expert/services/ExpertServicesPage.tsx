import { FolderKanban, User, Briefcase, PlusCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ServiceCreateModal } from "./ServiceCreateModal";
import { ServiceListingsGrid } from "./ServiceListingsGrid";
import { useMyServices } from "@/hooks/use-services";

export default function ExpertServicesPage() {
  const navigate = useNavigate();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const { data: services, isLoading: isLoadingServices } = useMyServices();

  return (
    <div className="w-full space-y-8 mb-12">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">My Services</h1>
        <p className="text-slate-500">Manage your profile, projects, and active engagements.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Projects Card */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col items-center text-center p-8 transition-all hover:border-slate-300 hover:shadow-md w-full">
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

        {/* Service Orders Card */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col items-center text-center p-8 transition-all hover:border-slate-300 hover:shadow-md w-full">
          <div className="w-16 h-16 flex items-center justify-center mb-4 text-emerald-600">
            <Briefcase className="w-8 h-8" strokeWidth={2} />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Service Orders</h2>
          <p className="text-slate-500 text-sm leading-relaxed mb-6">
            Manage your service sales, track client payments, and open active service workspaces.
          </p>
          <div className="w-full mt-auto">
            <Button 
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => navigate('/expert/service/orders')}
            >
              Open Orders
            </Button>
          </div>
        </div>

        {/* Expert Profile Card */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col items-center text-center p-8 transition-all hover:border-slate-300 hover:shadow-md w-full">
          <div className="w-16 h-16 flex items-center justify-center mb-4 text-slate-600">
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
        <Button onClick={() => setIsCreateModalOpen(true)} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
          <PlusCircle className="w-4 h-4" /> Create Listing
        </Button>
      </div>
      
      <ServiceListingsGrid 
        services={services} 
        isLoading={isLoadingServices} 
        onEmptyClick={() => setIsCreateModalOpen(true)} 
      />

      <ServiceCreateModal 
        isOpen={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)} 
      />
    </div>
  );
}

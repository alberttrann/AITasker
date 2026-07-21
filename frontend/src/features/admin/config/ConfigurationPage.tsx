import { Link } from "react-router-dom";
import { Package, Globe, ChevronRight, Settings, Layers } from "lucide-react";

export default function ConfigurationPage() {
  return (
    <div className="space-y-8 w-full animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
          <Settings className="h-8 w-8 text-primary" />
          Configuration
        </h1>
        <p className="text-slate-500 mt-2">
          Manage global platform configurations, subscription packages, and technical settings.
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Link to="/admin/config/packages" className="block p-6 bg-white rounded-2xl border border-slate-200 shadow-sm hover:border-primary/30 hover:shadow-md transition-all group">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center group-hover:bg-blue-100 transition-colors">
              <Package size={24} />
            </div>
            <ChevronRight className="text-slate-400 group-hover:text-primary transition-colors" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-2">Subscription Packages</h2>
          <p className="text-sm text-slate-500">Configure client and expert subscription packages, pricing, and features.</p>
        </Link>
        
        <Link to="/admin/config/domain-seam" className="block p-6 bg-white rounded-2xl border border-slate-200 shadow-sm hover:border-primary/30 hover:shadow-md transition-all group">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-sky-50 text-sky-600 rounded-xl flex items-center justify-center group-hover:bg-sky-100 transition-colors">
              <Globe size={24} />
            </div>
            <ChevronRight className="text-slate-400 group-hover:text-primary transition-colors" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-2">Domain & Seam Config</h2>
          <p className="text-sm text-slate-500">Update workspace domains and seam configuration settings.</p>
        </Link>

        <Link to="/admin/config/archetypes" className="block p-6 bg-white rounded-2xl border border-slate-200 shadow-sm hover:border-primary/30 hover:shadow-md transition-all group">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
              <Layers size={24} />
            </div>
            <ChevronRight className="text-slate-400 group-hover:text-primary transition-colors" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-2">Archetypes & Probes</h2>
          <p className="text-sm text-slate-500">Manage project archetypes and their dynamic elicitation questions.</p>
        </Link>
      </div>
    </div>
  );
}

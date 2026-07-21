import { Card, CardContent } from '@/components/ui/Card';
import { ArrowRight, Briefcase } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

interface ServiceListingsGridProps {
  services: any[];
  isLoading: boolean;
  onEmptyClick?: () => void;
}

export function ServiceListingsGrid({ services, isLoading, onEmptyClick }: ServiceListingsGridProps) {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-40 bg-white border border-slate-200 rounded-2xl animate-pulse"></div>
        ))}
      </div>
    );
  }

  if (!services || services.length === 0) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 flex flex-col items-center justify-center text-center text-slate-500">
        <Briefcase className="w-12 h-12 mx-auto text-slate-300 mb-4" />
        <p className="text-lg font-semibold text-slate-700 mb-2">No active service listings</p>
        <p className="text-sm max-w-md mx-auto mb-6">Create standardized service packages (e.g., "RAG Architecture Setup") that CEOs can purchase directly from the marketplace.</p>
        {onEmptyClick && (
          <Button onClick={onEmptyClick} variant="outline" className="gap-2">
            Create Your First Listing
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {services.map((svc: any) => (
        <Card key={svc.id} className="group hover:border-emerald-200 hover:shadow-md transition-all cursor-pointer" onClick={() => navigate(`/expert/service/${svc.id}`)}>
          <CardContent className="p-6 flex flex-col h-full">
            <div className="flex justify-between items-start mb-3">
              <h3 className="font-bold text-slate-900 text-lg line-clamp-1 group-hover:text-emerald-700 transition-colors">{svc.title}</h3>
              <span className={`px-2.5 py-1 text-xs font-bold uppercase rounded-md ${svc.state === 'PUBLISHED' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                {svc.state}
              </span>
            </div>
            <p className="text-sm text-slate-500 line-clamp-2 mb-4 flex-grow">{svc.description || "No description provided."}</p>
            <div className="flex justify-between items-end mt-auto pt-4 border-t border-slate-100">
              <div className="font-bold text-slate-900">
                {(svc.priceVnd || 0).toLocaleString('vi-VN')} ₫
              </div>
              <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

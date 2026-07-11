import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGetService, usePublishService, useUnpublishService, useDeleteService } from '@/hooks/use-services';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/Button';
import { ArrowLeft, Loader2, DollarSign, Clock, CheckCircle, XCircle, Trash2 } from 'lucide-react';
import { ConfirmModal } from '@/components/ui/Modal';
import { useState } from 'react';

export default function ServiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: service, isLoading } = useGetService(id);
  const publishService = usePublishService();
  const unpublishService = useUnpublishService();
  const deleteService = useDeleteService();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const renderTimeline = (timelineStr: string) => {
    if (!timelineStr) return null;
    if (timelineStr.trim().startsWith('{') && timelineStr.trim().endsWith('}')) {
      try {
        const jsonStr = timelineStr.replace(/'/g, '"');
        const obj = JSON.parse(jsonStr);
        return (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 font-bold">
              <Clock size={16} />
              <span>Total Estimated Time: {obj.total_estimated_time || 'N/A'}</span>
            </div>
            <div className="pl-6 mt-1 flex flex-col gap-1">
              {Object.entries(obj).map(([k, v]) => {
                if (k === 'total_estimated_time') return null;
                const label = k.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                return <div key={k} className="text-xs text-blue-800/80">• {label}: {String(v)}</div>
              })}
            </div>
          </div>
        );
      } catch (e) {
        // Fallback to regex if JSON parse fails
        const match = timelineStr.match(/['"]total_estimated_time['"]\s*:\s*['"]([^'"]+)['"]/);
        if (match && match[1]) {
           return <div className="flex items-center gap-2"><Clock size={16} /><span>{match[1]}</span></div>;
        }
      }
    }
    return <div className="flex items-center gap-2"><Clock size={16} /><span>{timelineStr}</span></div>;
  };

  if (isLoading) {
    return (
      <div className="w-full max-w-2xl px-6 mx-auto py-12 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!service) {
    return (
      <div className="w-full max-w-2xl px-6 mx-auto py-12 text-center">
        <h2 className="text-xl font-bold text-slate-900 mb-2">Service Not Found</h2>
        <p className="text-slate-500 mb-6">This service listing doesn't exist or you don't have access.</p>
        <Button onClick={() => navigate(-1)} variant="outline">Go Back</Button>
      </div>
    );
  }

  const isPublished = service.state === 'PUBLISHED';
  const isDraft = service.state === 'DRAFT';

  const handlePublish = () => {
    publishService.mutate(service.id);
  };

  const handleUnpublish = () => {
    unpublishService.mutate(service.id);
  };

  const handleDelete = () => {
    deleteService.mutate(service.id, {
      onSuccess: () => navigate('/expert')
    });
  };

  return (
    <div className="w-full max-w-2xl px-6 mx-auto py-12">
      <div className="flex items-center gap-3 mb-8">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="p-2 hover:bg-slate-200 rounded-full">
          <ArrowLeft size={20} />
        </Button>
        <h1 className="text-2xl font-bold text-slate-900 flex-1">Service Listing</h1>
        {isDraft && (
          <Button variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-50 gap-2" onClick={() => setShowDeleteConfirm(true)}>
            <Trash2 className="w-4 h-4" /> Delete
          </Button>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Header: User Info */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center font-headline font-semibold text-base">
              {user?.fullName?.charAt(0) || 'E'}
            </div>
            <div>
              <div className="font-headline font-semibold text-[#0F172A] leading-tight">{user?.fullName || 'Expert'}</div>
              <div className="font-body text-[13px] text-[#64748B]">Posted on {new Date(service.createdAt).toLocaleDateString()}</div>
            </div>
          </div>
          <div className={`px-3 py-1 rounded-[6px] font-bold text-xs uppercase tracking-wider ${isPublished ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
            {service.state}
          </div>
        </div>

        {/* Body */}
        <div className="p-6 bg-white font-body">
          <h2 className="text-[24px] font-headline font-semibold text-[#0F172A] mb-4">
            {service.title}
          </h2>
          <div className="text-[16px] text-[#334155] leading-[1.6] whitespace-pre-wrap mb-6">
            {service.description}
          </div>

          {service.scope && (
             <div className="mb-6">
               <h3 className="font-headline font-semibold text-lg text-slate-800 mb-2">Scope of Work</h3>
               <div className="text-[15px] text-[#334155] leading-[1.6] whitespace-pre-wrap bg-slate-50 p-4 rounded-xl border border-slate-100">
                 {service.scope}
               </div>
             </div>
          )}

          {((service.domainsJson && service.domainsJson.length > 0) || (service.seamsJson && service.seamsJson.length > 0)) && (
            <div className="mb-6 flex flex-wrap gap-2">
              {service.domainsJson?.map((d: string) => (
                <span key={`domain-${d}`} className="px-2.5 py-1 bg-purple-50 text-purple-700 text-xs font-bold rounded-md uppercase tracking-wider border border-purple-100">{d}</span>
              ))}
              {service.seamsJson?.map((s: string) => (
                <span key={`seam-${s}`} className="px-2.5 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-md uppercase tracking-wider border border-indigo-100">{s}</span>
              ))}
            </div>
          )}
          
          <div className="flex flex-wrap gap-3">
            {service.price_vnd && (
              <div className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-[8px] text-sm font-semibold flex items-center gap-2">
                <DollarSign size={16} />
                <span>{(parseInt(service.price_vnd)).toLocaleString('vi-VN')} ₫</span>
              </div>
            )}
            {service.timeline && (
              <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-[8px] text-sm flex items-start gap-2">
                {renderTimeline(service.timeline)}
              </div>
            )}
          </div>
        </div>

        {/* Footer: Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between rounded-b-[12px]">
          <div className="font-body text-[14px] text-[#64748B]">
            {isPublished ? 'This listing is visible to CEOs.' : 'This listing is a draft and not visible to anyone else.'}
          </div>
          
          {isDraft ? (
            <Button 
              variant="primary"
              className="font-headline font-semibold px-6 py-2 rounded-[8px] transition-all flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={publishService.isPending}
              onClick={handlePublish}
            >
              {publishService.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              {publishService.isPending ? 'Publishing...' : 'Publish Listing'}
            </Button>
          ) : (
            <Button 
              variant="outline"
              className="font-headline font-semibold px-6 py-2 rounded-[8px] transition-all flex items-center gap-2 text-slate-700 border-slate-300 hover:bg-slate-100"
              disabled={unpublishService.isPending}
              onClick={handleUnpublish}
            >
              {unpublishService.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
              {unpublishService.isPending ? 'Unpublishing...' : 'Unpublish'}
            </Button>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Delete Listing?"
        confirmText="Delete"
        cancelText="Cancel"
        isDestructive={true}
      >
        Are you sure you want to delete this listing? This action cannot be undone.
      </ConfirmModal>
    </div>
  );
}

import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGetService, usePublishService, useUnpublishService, useDeleteService } from '@/hooks/use-services';
import { useEngagements } from '@/hooks/use-engagements';
import { useMyReceivedReviews } from '@/hooks/use-reviews';
import { useDomains, useSeams } from '@/hooks/use-config';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, DollarSign, Clock, CheckCircle, XCircle, Trash2, Star, MessageSquare } from 'lucide-react';
import { ConfirmModal } from '@/components/ui/modal';
import { useState } from 'react';

export default function ServiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: service, isLoading } = useGetService(id);
  const publishService = usePublishService();
  const unpublishService = useUnpublishService();
  const deleteService = useDeleteService();
  const { data: domainsList } = useDomains();
  const { data: seamsList } = useSeams();
  
  const { data: engagements } = useEngagements();
  const { data: receivedReviews } = useMyReceivedReviews();

  const serviceEngagements = engagements?.filter(e => e.serviceId === id) || [];
  const serviceEngagementIds = serviceEngagements.map(e => e.id);
  const serviceReviews = receivedReviews?.filter(r => serviceEngagementIds.includes(r.engagementId)) || [];

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const renderTimeline = (timelineStr: string) => {
    if (!timelineStr) return null;
    
    // Check if it's JSON
    if (timelineStr.trim().startsWith('{') && timelineStr.trim().endsWith('}')) {
      try {
        const jsonStr = timelineStr.replace(/'/g, '"');
        const obj = JSON.parse(jsonStr);
        return (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 font-bold text-slate-800">
              <Clock size={16} className="text-emerald-600" />
              <span>Total Estimated Time: {obj.total_estimated_time || 'N/A'}</span>
            </div>
            <div className="pl-6 flex flex-col gap-1.5">
              {Object.entries(obj).map(([k, v]) => {
                if (k === 'total_estimated_time') return null;
                const label = k.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                return <div key={k} className="text-[13px] text-slate-600 font-medium flex gap-2"><span className="text-emerald-500 font-bold">•</span> <span><strong className="text-slate-700">{label}:</strong> {String(v)}</span></div>
              })}
            </div>
          </div>
        );
      } catch (e) {
        // Fallback to text rendering
      }
    }
    
    // Text formatting
    let formattedStr = timelineStr;
    
    // Add newlines before "Phase" and "Total" if they are missing
    formattedStr = formattedStr.replace(/(Phase \d+:)/g, '\n$1');
    formattedStr = formattedStr.replace(/(Total Estimated Time:)/gi, '\n$1');
    
    const lines = formattedStr.split('\n').filter(l => l.trim() !== '');
    
    if (lines.length > 1) {
      return (
        <div className="flex flex-col gap-2 w-full">
          <div className="flex flex-col gap-1.5">
            {lines.map((line, i) => {
              const isTotal = line.toLowerCase().includes('total');
              if (isTotal) {
                 return (
                   <div key={i} className="flex items-center gap-2 font-bold text-slate-800 mt-2 pt-2 border-t border-slate-200/60">
                     <Clock size={16} className="text-emerald-600" />
                     <span>{line.trim()}</span>
                   </div>
                 );
              }
              return (
                 <div key={i} className="text-[13px] text-slate-600 font-medium flex gap-2 pl-2">
                   <span className="text-emerald-500 font-bold">•</span> 
                   <span>{line.trim()}</span>
                 </div>
              );
            })}
          </div>
        </div>
      );
    }
    
    // Flat string fallback
    return <div className="flex items-center gap-2 text-slate-700 font-medium"><Clock size={16} className="text-emerald-600" /><span>{timelineStr}</span></div>;
  };

  const renderScopeOfWork = (scopeStr: string) => {
    if (!scopeStr) return null;
    try {
      // Clean string if it is surrounded by quotes or formatting
      let cleanStr = scopeStr.trim();
      if (cleanStr.startsWith('```json')) {
        cleanStr = cleanStr.replace(/```json/g, '').replace(/```/g, '').trim();
      }
      
      // Attempt to fix python style arrays (e.g. ['a', 'b'])
      if (cleanStr.startsWith("['") && cleanStr.endsWith("']")) {
         cleanStr = cleanStr.replace(/^\['/, '["').replace(/'\]$/, '"]').replace(/', '/g, '", "');
      }
      
      const scopeObj = JSON.parse(cleanStr);
      if (typeof scopeObj !== 'object' || scopeObj === null) throw new Error("Not an object");
      
      // If it's an Array at the root
      if (Array.isArray(scopeObj)) {
         return (
           <div className="flex flex-col gap-2">
             {scopeObj.map((item, i) => {
               const str = String(item).trim();
               if (str.endsWith(':') || /^[A-Z\s]+$/.test(str)) {
                 return <h4 key={i} className="font-bold text-slate-800 mt-4 mb-1 uppercase tracking-wider text-xs first:mt-0">{str.replace(/:$/, '')}</h4>
               }
               if (str.startsWith('-')) {
                 return <div key={i} className="text-[14px] text-slate-600 pl-2 flex gap-2"><span className="text-emerald-500 font-bold">•</span> <span className="leading-relaxed">{str.replace(/^-/, '').trim()}</span></div>
               }
               return <div key={i} className="text-[14px] text-slate-600 leading-relaxed mb-2">{str}</div>
             })}
           </div>
         );
      }
      
      // If it's a Dictionary/Object at the root
      return (
        <div className="flex flex-col gap-5">
          {Object.entries(scopeObj).map(([key, value]) => {
            const title = key.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            
            // If it's an array
            if (Array.isArray(value)) {
              return (
                <div key={key}>
                  <h4 className="font-semibold text-slate-800 mb-2">{title}</h4>
                  <ul className="list-none space-y-1.5">
                    {value.map((item, i) => (
                      <li key={i} className="text-[14px] text-slate-600 flex gap-2">
                        <span className="text-emerald-500 font-bold">•</span>
                        <span className="leading-relaxed">{typeof item === 'object' ? JSON.stringify(item) : String(item).replace(/^-/, '').trim()}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            }
            
            // If it's an object
            if (typeof value === 'object' && value !== null) {
              return (
                <div key={key}>
                  <h4 className="font-semibold text-slate-800 mb-2">{title}</h4>
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    {Object.entries(value).map(([k, v]) => (
                      <div key={k} className="mb-2 last:mb-0 text-[14px]">
                        <span className="font-bold text-slate-700">{k.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}: </span>
                        <span className="text-slate-600 leading-relaxed">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }
            
            // Primitive value
            return (
              <div key={key}>
                <h4 className="font-semibold text-slate-800 mb-1">{title}</h4>
                <p className="text-[14px] text-slate-600 leading-relaxed">{String(value)}</p>
              </div>
            );
          })}
        </div>
      );
    } catch (e) {
      // Fallback to text rendering with basic formatting
      let formattedStr = scopeStr;
      formattedStr = formattedStr.replace(/\\n/g, '\n');
      formattedStr = formattedStr.replace(/(INCLUDED:)/g, '\n$1\n');
      formattedStr = formattedStr.replace(/(NOT INCLUDED:)/g, '\n$1\n');
      
      const lines = formattedStr.split('\n').filter(l => l.trim() !== '');
      if (lines.length > 1) {
        return (
           <div className="flex flex-col gap-2">
             {lines.map((line, i) => {
               const str = line.trim();
               if (str.endsWith(':') || /^[A-Z\s]+$/.test(str)) {
                 return <h4 key={i} className="font-bold text-slate-800 mt-4 mb-1 uppercase tracking-wider text-xs first:mt-0">{str.replace(/:$/, '')}</h4>
               }
               if (str.startsWith('-')) {
                 return <div key={i} className="text-[14px] text-slate-600 pl-2 flex gap-2"><span className="text-emerald-500 font-bold">•</span> <span className="leading-relaxed">{str.replace(/^-/, '').trim()}</span></div>
               }
               return <div key={i} className="text-[14px] text-slate-600 leading-relaxed mb-2">{str}</div>
             })}
           </div>
        );
      }
      
      return <div className="whitespace-pre-wrap text-[14px] text-slate-600 leading-relaxed">{scopeStr}</div>;
    }
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
    <div className="w-full max-w-[1440px] px-6 mx-auto py-12 font-body animate-in fade-in duration-500">
      {/* Back Button & Top Bar */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors cursor-pointer uppercase tracking-wider"
        >
          <ArrowLeft size={18} />
          <span>Back to Services</span>
        </button>
        
        <div className="ml-auto flex items-center gap-3">
          {isDraft && (
            <Button variant="ghost" className="text-red-500 hover:text-red-600 hover:bg-red-50 gap-2 text-sm font-semibold px-4 py-2 rounded-[8px]" onClick={() => setShowDeleteConfirm(true)}>
              <Trash2 className="w-4 h-4" /> Delete Draft
            </Button>
          )}
        </div>
      </div>

      {/* Hero Header Section */}
      <div className="relative w-full rounded-3xl overflow-hidden mb-8 border border-slate-200/50 shadow-sm">
        {/* Background Graphic */}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-900 z-0">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>
          <div className="absolute -top-32 -left-32 w-96 h-96 bg-emerald-500/20 rounded-full blur-[100px]"></div>
          <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-blue-500/20 rounded-full blur-[100px]"></div>
        </div>

        {/* Header Content */}
        <div className="relative z-10 px-10 py-12 flex flex-col md:flex-row md:items-end justify-between gap-6 backdrop-blur-sm">
          <div className="max-w-3xl">
            <div className="flex items-center gap-3 mb-4">
              <div className={`px-3 py-1 rounded-[6px] font-bold text-xs uppercase tracking-wider shadow-sm ${isPublished ? 'bg-emerald-500/20 text-emerald-100 border border-emerald-400/30' : 'bg-amber-500/20 text-amber-100 border border-amber-400/30'}`}>
                {isPublished ? 'Published Listing' : 'Draft Listing'}
              </div>
              <span className="text-slate-300 text-sm font-semibold">Posted on {new Date(service.createdAt).toLocaleDateString()}</span>
            </div>
            <h1 className="text-3xl md:text-5xl font-headline font-bold text-white leading-tight mb-6">
              {service.title}
            </h1>
            
            {/* User Info */}
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/10 text-white border border-white/20 rounded-full flex items-center justify-center font-headline font-bold text-lg shadow-inner">
                {user?.fullName?.charAt(0) || 'E'}
              </div>
              <div>
                <div className="font-headline font-semibold text-slate-100 text-lg leading-tight">{user?.fullName || 'Expert'}</div>
                <div className="font-body text-[14px] text-slate-300">Verified Expert</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="flex flex-col lg:flex-row gap-8 items-start relative">
        
        {/* Left Column: Details */}
        <div className="flex-1 w-full space-y-8">
          
          {/* Description Section */}
          <section className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm relative overflow-hidden group hover:border-slate-300 transition-colors">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <h3 className="text-xl font-headline font-bold text-slate-900 mb-4 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
              Service Overview
            </h3>
            <div className="text-[16px] text-slate-600 leading-[1.8] whitespace-pre-wrap">
              {service.description}
            </div>
          </section>

          {/* Scope of Work */}
          {service.scope && (
            <section className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm group hover:border-slate-300 transition-colors">
              <h3 className="text-xl font-headline font-bold text-slate-900 mb-4">Scope of Work</h3>
              <div className="text-[15px] text-slate-700 leading-[1.8] bg-slate-50 p-6 rounded-xl border border-slate-100">
                {renderScopeOfWork(service.scope)}
              </div>
            </section>
          )}

          {/* Tags / Domains / Seams */}
          {((service.domainsJson && service.domainsJson.length > 0) || (service.seamsJson && service.seamsJson.length > 0)) && (
            <section className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm group hover:border-slate-300 transition-colors">
              <h3 className="text-xl font-headline font-bold text-slate-900 mb-6">Technical Expertise</h3>
              
              <div className="space-y-6">
                {service.domainsJson && service.domainsJson.length > 0 && (
                  <div>
                    <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Target Domains</h4>
                    <div className="flex flex-wrap gap-3">
                      {service.domainsJson.map((d: string) => {
                        const domainName = domainsList?.find(x => x.code === d)?.name || d;
                        return (
                          <span key={`domain-${d}`} className="px-3.5 py-1.5 bg-slate-50 text-slate-700 text-[13px] font-bold rounded-lg uppercase tracking-wide border border-slate-200 shadow-sm flex items-center">
                            {domainName}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {service.seamsJson && service.seamsJson.length > 0 && (
                  <div>
                    <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Technical Seams</h4>
                    <div className="flex flex-wrap gap-3">
                      {service.seamsJson.map((s: string) => {
                        const seamName = seamsList?.find(x => x.code === s)?.name || s;
                        return (
                          <span key={`seam-${s}`} className="px-3.5 py-1.5 bg-slate-50 text-slate-700 text-[13px] font-bold rounded-lg uppercase tracking-wide border border-slate-200 shadow-sm flex items-center">
                            {seamName}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Client Reviews Section */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
            <div className="p-8 pb-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900 font-headline">Client Reviews</h2>
                <p className="text-sm text-slate-500 mt-1">Feedback from CEOs who purchased this service</p>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 rounded-lg text-amber-700 font-bold border border-amber-200/50">
                <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
                <span>
                  {serviceReviews.length > 0 
                    ? (serviceReviews.reduce((sum, r) => sum + r.rating, 0) / serviceReviews.length).toFixed(1)
                    : 'No reviews'}
                </span>
                <span className="text-amber-700/60 font-medium ml-1 text-sm">
                  ({serviceReviews.length})
                </span>
              </div>
            </div>
            
            <div className="p-8">
              {serviceReviews.length > 0 ? (
                <div className="space-y-6">
                  {serviceReviews.map((review) => (
                    <div key={review.id} className="pb-6 border-b border-slate-100 last:pb-0 last:border-b-0">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="font-bold text-slate-900">{review.reviewer?.fullName || 'Anonymous Client'}</div>
                        </div>
                        <div className="flex text-amber-400 gap-0.5">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`w-4 h-4 ${star <= review.rating ? 'fill-current' : 'text-slate-200 fill-slate-200'}`}
                            />
                          ))}
                        </div>
                      </div>
                      {review.comment ? (
                        <p className="text-slate-600 text-sm leading-relaxed">{review.comment}</p>
                      ) : (
                        <p className="text-slate-400 text-sm italic">No written feedback provided.</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <MessageSquare className="w-8 h-8 text-slate-300" />
                  </div>
                  <h4 className="text-base font-bold text-slate-700 mb-1">No reviews yet</h4>
                  <p className="text-sm text-slate-500 max-w-xs mx-auto">
                    Reviews left by clients will appear here once an engagement is closed.
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Right Column: Sticky Sidebar */}
        <div className="w-full lg:w-[400px] shrink-0 sticky top-24 space-y-6">
          
          {/* Action & Price Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
            <div className="p-8 pb-6 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Investment</h3>
              {service.priceVnd ? (
                <div className="flex items-end gap-1 mb-1 text-slate-900">
                  <span className="text-[32px] font-headline font-bold leading-none">{Number(service.priceVnd).toLocaleString('vi-VN')}</span>
                  <span className="text-xl font-semibold mb-1">₫</span>
                </div>
              ) : (
                <div className="text-[28px] font-headline font-bold text-slate-900 leading-none">Contact for Pricing</div>
              )}
            </div>

            {service.timeline && (
              <div className="px-8 py-5 border-b border-slate-100 bg-slate-50/50">
                <h3 className="text-sm font-bold text-slate-500 mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4" /> Estimated Timeline
                </h3>
                <div className="text-slate-800 font-semibold text-[15px]">
                  {renderTimeline(service.timeline)}
                </div>
              </div>
            )}

            <div className="p-8 bg-slate-50">
              <div className="font-body text-[13px] font-semibold text-slate-500 mb-4 text-center">
                {isPublished ? 'This listing is live on the marketplace.' : 'This listing is hidden until you publish it.'}
              </div>
              
              {isDraft ? (
                <Button 
                  variant="primary"
                  className="w-full font-headline font-bold text-base py-4 rounded-xl shadow-emerald-glow transition-all flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 hover:-translate-y-0.5 text-white"
                  disabled={publishService.isPending}
                  onClick={handlePublish}
                >
                  {publishService.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                  {publishService.isPending ? 'Publishing...' : 'Publish Listing'}
                </Button>
              ) : (
                <Button 
                  variant="outline"
                  className="w-full font-headline font-bold text-base py-4 rounded-xl transition-all flex items-center justify-center gap-2 text-slate-700 border-slate-300 hover:bg-slate-100 hover:text-slate-900"
                  disabled={unpublishService.isPending}
                  onClick={handleUnpublish}
                >
                  {unpublishService.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <XCircle className="w-5 h-5" />}
                  {unpublishService.isPending ? 'Unpublishing...' : 'Unpublish Listing'}
                </Button>
              )}
            </div>
          </div>

          {/* Secondary Info Card */}
          <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6 flex items-start gap-4 text-slate-600 text-sm">
             <div className="p-2 bg-white rounded-lg border border-slate-200 shrink-0">
               <DollarSign className="w-5 h-5 text-emerald-600" />
             </div>
             <div>
               <p className="font-semibold text-slate-800 mb-1">Secure Payments</p>
               <p className="leading-relaxed">Payments are held in escrow until milestones are delivered and approved by the client.</p>
             </div>
          </div>
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
        Are you sure you want to permanently delete this listing draft? This action cannot be undone.
      </ConfirmModal>
    </div>
  );
}

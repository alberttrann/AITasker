import React, { useState } from 'react';
import { useGetServices, useMyPurchase, usePurchaseService } from '@/hooks/use-services';
import { useMarketplaceProjects } from '@/hooks/use-projects';
import { useExpertSearch, useExpertProfile } from '@/hooks/use-expert-profile';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/Card';
import { Loader2, Search, Briefcase, User, Star, ArrowRight, MessageSquare, CreditCard, Clock, CheckCircle, FolderOpen, Receipt } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { formatVND } from '@/lib/utils';
import { DataTable } from '@/components/layout/Table';

export default function MarketplaceBrowse() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const isExpert = user?.activeRole === 'EXPERT';
  
  const [activeTab, setActiveTab] = useState<'SERVICES' | 'EXPERTS' | 'PURCHASES' | 'OPEN_PROJECTS'>(() => {
    if (location.state?.tab) return location.state.tab;
    if (isExpert && location.state?.fromProjects) return 'OPEN_PROJECTS';
    return 'SERVICES';
  });
  
  const { data: services, isLoading: isLoadingServices } = useGetServices();
  const { data: purchases, isLoading: isLoadingPurchases } = useMyPurchase(user?.id || '');
  const { data: openProjects, isLoading: isLoadingOpenProjects } = useMarketplaceProjects(undefined, { enabled: isExpert });
  const { profile: expertProfile } = useExpertProfile({ enabled: isExpert });
  const { data: experts, isLoading: isLoadingExperts } = useExpertSearch(undefined, { enabled: !isExpert });
  
  const purchaseMutation = usePurchaseService();

  const isClient = user?.activeRole === 'CLIENT';

  // Build a set of purchased service IDs to hide them from catalog browsing
  const purchasedIds = new Set(purchases?.map((p: any) => p.serviceId) || []);
  const filteredServices = services?.filter((s: any) => !purchasedIds.has(s.id)) || [];

  const handlePayNow = (serviceId: string) => {
    purchaseMutation.mutate(serviceId, {
      onSuccess: (data: any) => {
        navigate(`/ceo/marketplace/service/${serviceId}/purchase`, {
          state: {
            engagementId: data.engagement.id,
            vietqrUrl: data.vietqrUrl,
            vaNumber: data.virtualAccount.vaNumber,
            price: data.virtualAccount.fixedAmount ? parseFloat(data.virtualAccount.fixedAmount) : 0,
            title: data.engagement.service?.title || 'Service Listing',
          },
        });
      },
    });
  };

  return (
    <div className="w-full max-w-[1440px] px-6 mx-auto py-8">
      {/* Title */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Marketplace</h1>
        <p className="text-slate-500">Discover ready-to-buy AI services and top-tier experts for your projects.</p>
      </div>

      {/* Tabs list */}
      <div className="flex flex-wrap bg-slate-100 p-1 rounded-xl mb-8 w-fit gap-1">
        <button
          onClick={() => setActiveTab('SERVICES')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${
            activeTab === 'SERVICES' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Briefcase className="w-4 h-4" /> Ready-to-Buy Services
        </button>
        {!isExpert && (
          <button
            onClick={() => setActiveTab('EXPERTS')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'EXPERTS' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <User className="w-4 h-4" /> Browse Experts
          </button>
        )}
        {isExpert && (
          <button
            onClick={() => setActiveTab('OPEN_PROJECTS')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'OPEN_PROJECTS' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Search className="w-4 h-4" /> Open Projects
          </button>
        )}
        {isClient && (
          <button
            onClick={() => setActiveTab('PURCHASES')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'PURCHASES' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Clock className="w-4 h-4" /> My Purchases
          </button>
        )}
      </div>

      {/* Tab 1: SERVICES */}
      {activeTab === 'SERVICES' && (
        <div className="animate-in fade-in duration-300">
          {isLoadingServices || isLoadingPurchases ? (
            <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>
          ) : filteredServices.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredServices.map((service: any) => (
                <div key={service.id} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col h-full">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="px-2 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase tracking-wider rounded-md">
                      {service.serviceType === 'AI_SERVICE' ? 'AI Build' : 'Discovery'}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2 line-clamp-2">{service.title}</h3>
                  <p className="text-slate-500 text-sm mb-6 line-clamp-3 flex-1">{service.description}</p>
                  
                  <div className="flex items-end justify-between border-t border-slate-100 pt-4 mt-auto">
                    <div>
                      <p className="text-xs text-slate-400 font-semibold uppercase mb-1">Fixed Price</p>
                      <p className="text-lg font-bold text-slate-900">
                        {service.priceVnd ? `${service.priceVnd.toLocaleString('vi-VN')} ₫` : 'Contact for pricing'}
                      </p>
                    </div>
                    <Button 
                      onClick={() => navigate(isExpert ? `/expert/marketplace/service/${service.id}` : `/ceo/marketplace/service/${service.id}`)} 
                      variant="outline" 
                      size="sm" 
                      className="gap-2"
                    >
                      View <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-24 bg-white border border-slate-200 rounded-2xl">
              <Search className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-slate-900 mb-2">No Services Found</h3>
              <p className="text-slate-500">There are no published services available at this time.</p>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: EXPERTS */}
      {!isExpert && activeTab === 'EXPERTS' && (
        <div className="animate-in fade-in duration-300">
          {isLoadingExperts ? (
            <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
          ) : experts && experts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {experts.map((expert: any) => (
                <div key={expert.userId || expert.id} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col h-full">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-blue-100 text-blue-600 font-bold flex items-center justify-center rounded-full text-lg">
                      {expert.user?.fullName?.charAt(0) || 'E'}
                    </div>
                    <div className="flex items-center gap-1 bg-amber-50 text-amber-700 px-2 py-1 rounded-md text-xs font-bold">
                      <Star className="w-3 h-3 fill-amber-500" /> {expert.avgRating ? Number(expert.avgRating).toFixed(1) : 'New'}
                    </div>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-1">{expert.user?.fullName || 'Expert Name'}</h3>
                  <p className="text-slate-500 text-sm mb-4 line-clamp-2">{expert.bio || 'AI integration expert'}</p>
                  
                  <div className="flex flex-wrap gap-2 mb-6 flex-1">
                    {expert.expertSeamClaims?.slice(0, 3).map((claim: any) => (
                      <span key={claim.seamCode} className="px-2 py-1 bg-slate-100 text-slate-700 text-xs font-semibold rounded-md">
                        {claim.seamCode}
                      </span>
                    ))}
                  </div>

                  <div className="border-t border-slate-100 pt-4 mt-auto">
                    <Button onClick={() => navigate(`/ceo/experts/${expert.userId || expert.id}`)} variant="outline" className="w-full gap-2 justify-center">
                      View Profile <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-24 bg-white border border-slate-200 rounded-2xl">
              <Search className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-slate-900 mb-2">No Experts Found</h3>
              <p className="text-slate-500">We couldn't find any experts matching your criteria.</p>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: OPEN PROJECTS (Expert Only) */}
      {isExpert && activeTab === 'OPEN_PROJECTS' && (
        <div className="animate-in fade-in duration-300">
          {isLoadingOpenProjects ? (
            <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
          ) : openProjects && openProjects.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {openProjects.map((proj: any) => {
                // Pre-flight check: do they possess the mandatory requirements?
                const reqDomains = proj.required_domains_json?.map((d: any) => d.domain_code || d.domainCode) || [];
                const reqSeams = proj.required_seams_json?.map((s: any) => s.seam_code || s.seamCode) || [];
                
                const myDomains = expertProfile?.domainDepths?.map((d: any) => d.domainCode) || [];
                const mySeams = expertProfile?.seamClaims?.map((s: any) => s.seamCode || s.code) || [];

                const isMissingDomains = reqDomains.some((rd: string) => !myDomains.includes(rd));
                const isMissingSeams = reqSeams.some((rs: string) => !mySeams.includes(rs));
                const isMissingReqs = isMissingDomains || isMissingSeams;

                return (
                  <div key={proj.id} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col h-full">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="px-2.5 py-1 bg-blue-50 text-blue-700 text-[10px] font-bold uppercase tracking-wider rounded-md">
                        {proj.tier?.replace('_', ' ') || 'Project'}
                      </span>
                      {isMissingReqs && (
                        <span className="px-2.5 py-1 bg-rose-50 text-rose-700 text-[10px] font-bold uppercase tracking-wider rounded-md border border-rose-100" title="Your profile is missing required domains or seams. Your bid will likely be blocked or rejected.">
                          Missing Requirements
                        </span>
                      )}
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-2 line-clamp-2">{proj.projectName || `Project ${proj.id.slice(0,8)}`}</h3>
                    <p className="text-slate-500 text-sm mb-6 line-clamp-3 flex-1">{proj.artifact_a_json?.business_intent || 'No description provided.'}</p>
                    
                    <div className="border-t border-slate-100 pt-4 mt-auto flex justify-between items-end">
                      <div>
                        <p className="text-xs text-slate-400 font-semibold uppercase mb-1">Est. Budget</p>
                        <p className="text-lg font-bold text-emerald-600">
                          {proj.milestone_framework_json ? formatVND(proj.milestone_framework_json.reduce((sum: number, m: any) => sum + (m.payment_amount_vnd || m.paymentAmountVnd || 0), 0)) : 'TBD'}
                        </p>
                      </div>
                      <Button 
                        onClick={() => navigate(`/expert/bids/${proj.id}`)} 
                        variant={isMissingReqs ? "secondary" : "primary"} 
                        size="sm" 
                        className="gap-2"
                      >
                        Submit Bid <ArrowRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-24 bg-white border border-slate-200 rounded-2xl">
              <FolderOpen className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-slate-900 mb-2">No Open Projects</h3>
              <p className="text-slate-500">There are no published projects currently accepting bids.</p>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: PURCHASES (Order Ledger) */}
      {isClient && activeTab === 'PURCHASES' && (
        <div className="animate-in fade-in duration-300">
          {isLoadingPurchases ? (
            <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
          ) : (
            <DataTable
              columns={[
                { key: 'id', label: 'Order ID', render: (p: any) => <code className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded border border-slate-200">{p.id.slice(0, 8).toUpperCase()}</code> },
                { key: 'service', label: 'Service', render: (p: any) => (
                  <div className="max-w-[250px]">
                    <div className="font-bold text-slate-900 text-sm truncate">{p.service?.title || 'Deleted Service'}</div>
                    <div className="text-xs text-slate-500 mt-0.5">By {p.expert?.fullName || 'Expert'}</div>
                  </div>
                )},
                { key: 'date', label: 'Date', render: (p: any) => <span className="text-xs text-slate-500 font-medium">{new Date(p.createdAt || p.updatedAt || p.connectedAt).toLocaleDateString()}</span> },
                { key: 'amount', label: 'Escrow Amount', render: (p: any) => <span className="font-bold text-emerald-600">{formatVND(p.service?.priceVnd || 0)}</span> },
                { key: 'status', label: 'Status', render: (p: any) => {
                  return (
                    <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md border ${
                      p.state === 'PENDING' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                      p.state === 'CLOSED' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                      p.state === 'CANCELLED' ? 'bg-slate-50 text-slate-500 border-slate-200' :
                      'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}>
                      {p.state === 'PENDING' ? 'Pending Payment' :
                       p.state === 'CLOSED' ? 'Closed' :
                       p.state === 'CANCELLED' ? 'Cancelled' :
                       'Active'}
                    </span>
                  );
                }},
                { key: 'actions', label: '', render: (p: any) => (
                  <div className="flex justify-end gap-2">
                    {p.state === 'PENDING' ? (
                      <Button size="sm" onClick={() => handlePayNow(p.serviceId)} className="gap-1.5"><CreditCard size={14} /> Pay Now</Button>
                    ) : (
                      <>
                        <Button size="sm" variant="outline" onClick={() => navigate(`/ceo/engagements/${p.id}/messages`)} className="gap-1.5 text-slate-600"><MessageSquare size={14} /> Chat</Button>
                        <Button size="sm" onClick={() => navigate(`/ceo/engagements/${p.id}/milestones`)}>Workspace</Button>
                      </>
                    )}
                  </div>
                )}
              ]}
              data={purchases || []}
              keyExtractor={(p: any) => p.id}
              emptyState={
                <div className="text-center py-24 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col items-center justify-center">
                  <Receipt className="w-12 h-12 text-slate-300 mb-4" />
                  <h3 className="text-lg font-bold text-slate-900 mb-1">No Orders Found</h3>
                  <p className="text-slate-500 text-sm">You haven't purchased any ready-to-buy services yet.</p>
                </div>
              }
            />
          )}
        </div>
      )}
    </div>
  );
}

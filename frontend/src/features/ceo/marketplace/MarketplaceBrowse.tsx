import React, { useState } from 'react';
import { useGetServices, useMyPurchase, usePurchaseService } from '@/hooks/use-services';
import { useExpertSearch } from '@/hooks/use-expert-profile';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/Card';
import { Loader2, Search, Briefcase, User, Star, ArrowRight, MessageSquare, CreditCard, Clock, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatVND } from '@/lib/utils';

export default function MarketplaceBrowse() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'SERVICES' | 'EXPERTS' | 'PURCHASES'>('SERVICES');
  
  const { data: services, isLoading: isLoadingServices } = useGetServices();
  const { data: experts, isLoading: isLoadingExperts } = useExpertSearch();
  const { data: purchases, isLoading: isLoadingPurchases } = useMyPurchase(user?.id || '');
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
      <div className="flex bg-slate-100 p-1 rounded-xl mb-8 w-fit">
        <button
          onClick={() => setActiveTab('SERVICES')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${
            activeTab === 'SERVICES' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Briefcase className="w-4 h-4" /> Ready-to-Buy Services
        </button>
        <button
          onClick={() => setActiveTab('EXPERTS')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${
            activeTab === 'EXPERTS' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <User className="w-4 h-4" /> Browse Experts
        </button>
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
                    <Button onClick={() => navigate(`/ceo/marketplace/service/${service.id}`)} variant="outline" size="sm" className="gap-2">
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
      {activeTab === 'EXPERTS' && (
        <div className="animate-in fade-in duration-300">
          {isLoadingExperts ? (
            <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
          ) : experts?.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {experts.map((expert: any) => (
                <div key={expert.userId || expert.id} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col h-full">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-blue-100 text-blue-600 font-bold flex items-center justify-center rounded-full text-lg">
                      {expert.user?.fullName?.charAt(0) || 'E'}
                    </div>
                    <div className="flex items-center gap-1 bg-amber-50 text-amber-700 px-2 py-1 rounded-md text-xs font-bold">
                      <Star className="w-3 h-3 fill-amber-500" /> {expert.avgRating || 'New'}
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

      {/* Tab 3: PURCHASES */}
      {isClient && activeTab === 'PURCHASES' && (
        <div className="animate-in fade-in duration-300">
          {isLoadingPurchases ? (
            <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
          ) : purchases?.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {purchases.map((purchase: any) => {
                const isPending = purchase.state === 'PENDING';
                const service = purchase.service || {};

                return (
                  <div key={purchase.id} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col h-full">
                    <div className="flex items-center justify-between gap-2 mb-4">
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-700 text-[10px] font-bold uppercase tracking-wider rounded-md">
                        {service.serviceType === 'AI_SERVICE' ? 'AI Build' : 'Discovery'}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        isPending ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}>
                        {isPending ? 'Pending Payment' : 'Active'}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-slate-900 mb-2 line-clamp-2">{service.title || 'Service Listing'}</h3>
                    <p className="text-slate-400 text-xs mb-6">Order ID: <code className="font-mono text-[10px] select-all bg-slate-50 px-1 py-0.5 rounded border border-slate-100">{purchase.id}</code></p>

                    <div className="border-t border-slate-100 pt-4 mt-auto space-y-3">
                      <div className="flex justify-between items-center text-sm mb-2">
                        <span className="text-slate-400">Total Escrow</span>
                        <span className="font-bold text-slate-800">
                          {service.priceVnd ? `${service.priceVnd.toLocaleString('vi-VN')} ₫` : '0 ₫'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        {isPending ? (
                          <Button
                            onClick={() => handlePayNow(purchase.serviceId)}
                            disabled={purchaseMutation.isPending}
                            variant="primary"
                            size="sm"
                            className="w-full gap-1.5 justify-center"
                          >
                            <CreditCard className="w-3.5 h-3.5" /> Pay Now
                          </Button>
                        ) : (
                          <Button
                            onClick={() => navigate(`/ceo/engagements/${purchase.id}/milestones`)}
                            variant="primary"
                            size="sm"
                            className="w-full gap-1.5 justify-center"
                          >
                            <CheckCircle className="w-3.5 h-3.5" /> Milestones
                          </Button>
                        )}

                        <Button
                          onClick={() => navigate(`/ceo/engagements/${purchase.id}/messages`)}
                          variant="outline"
                          size="sm"
                          className="w-full gap-1.5 justify-center text-slate-600"
                        >
                          <MessageSquare className="w-3.5 h-3.5" /> Chat
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-24 bg-white border border-slate-200 rounded-2xl">
              <CreditCard className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-slate-900 mb-2">No Purchased Services</h3>
              <p className="text-slate-500">You haven't bought any ready-to-buy services yet.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

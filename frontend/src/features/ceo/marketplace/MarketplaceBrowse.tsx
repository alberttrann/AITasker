import React, { useState } from 'react';
import { useGetServices } from '@/hooks/use-services';
import { useExpertSearch } from '@/hooks/use-expert-profile';
import { Button } from '@/components/ui/Button';
import { Loader2, Search, Briefcase, User, Star, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function MarketplaceBrowse() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'SERVICES' | 'EXPERTS'>('SERVICES');
  
  const { data: services, isLoading: isLoadingServices } = useGetServices({ state: 'PUBLISHED' });
  const { data: experts, isLoading: isLoadingExperts } = useExpertSearch();

  return (
    <div className="w-full max-w-[1440px] px-6 mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Marketplace</h1>
        <p className="text-slate-500">Discover ready-to-buy AI services and top-tier experts for your projects.</p>
      </div>

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
      </div>

      {activeTab === 'SERVICES' && (
        <div className="animate-in fade-in duration-300">
          {isLoadingServices ? (
            <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>
          ) : services?.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {services.map((service: any) => (
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
                    <Button onClick={() => navigate(`/ceo/experts/${expert.userId || expert.id}`)} variant="outline" className="w-full gap-2">
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
    </div>
  );
}

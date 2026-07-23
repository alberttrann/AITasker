import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useEngagements } from "@/hooks/use-engagements";
import { Loader2, ArrowLeft, Briefcase, Search, Filter, Hash, CheckCircle2, MessageSquare, ArrowRight, FolderKanban, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";

type UnifiedOrder = {
  id: string;
  serviceTitle: string;
  clientName: string;
  priceVnd: number;
  state: 'PENDING' | 'ACTIVE' | 'CLOSED';
  updatedAt: number;
  engagement: any;
};

export default function ExpertOrdersPage() {
  const navigate = useNavigate();
  const { data: engagements, isLoading: isLoadingEngagements } = useEngagements();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilters, setStatusFilters] = useState<Set<string>>(new Set());
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});

  const toggleOrderExpand = (id: string) => {
    setExpandedOrders(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const unifiedOrders = useMemo(() => {
    if (!engagements) return [];
    
    // Filter engagements where user is expert and it's a service order (even if service listing is deleted)
    const serviceEngagements = engagements.filter((eng) => !eng.project && (eng.type === 'SERVICE_PURCHASE' || eng.type === 'TECH_DISCOVERY'));
    
    // Find active combination of (serviceId, clientId)
    const activeCombinations = new Set<string>();
    serviceEngagements.forEach(eng => {
      if (eng.state === 'ACTIVE' && eng.serviceId && eng.clientId) {
        activeCombinations.add(`${eng.serviceId}-${eng.clientId}`);
      }
    });

    // Filter out duplicates (pending ones if an active one exists for the same service and client)
    const filtered = serviceEngagements.filter(eng => {
      if (eng.state === 'PENDING' && eng.serviceId && eng.clientId) {
        if (activeCombinations.has(`${eng.serviceId}-${eng.clientId}`)) {
          return false; // hide duplicate pending
        }
      }
      return true;
    });
    
    return filtered
      .map((e) => {
        const eng = e as any;
        const milestones = eng.milestones || [];
        const totalMilestonesPrice = milestones.reduce((sum: number, m: any) => sum + Number(m.paymentAmountVnd), 0);
        
        return {
          id: eng.id,
          serviceTitle: eng.service?.title || `Deleted Service Order (${eng.id.slice(0, 8)})`,
          clientName: eng.client?.fullName || 'Client',
          priceVnd: eng.service?.priceVnd ? Number(eng.service.priceVnd) : totalMilestonesPrice,
          state: eng.state as any,
          updatedAt: new Date(eng.updatedAt || eng.connectedAt || Date.now()).getTime(),
          engagement: eng,
        };
      })
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [engagements]);

  const filteredOrders = useMemo(() => {
    let result = unifiedOrders;
    if (statusFilters.size > 0) {
      result = result.filter(o => statusFilters.has(o.state));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(o => 
        o.serviceTitle.toLowerCase().includes(q) || 
        o.clientName.toLowerCase().includes(q)
      );
    }
    return result;
  }, [unifiedOrders, statusFilters, searchQuery]);

  const formatVND = (value: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
  };

  const getStatusColor = (state: string) => {
    switch (state) {
      case 'ACTIVE':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'PENDING':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const getMilestoneStateColor = (state: string) => {
    switch (state) {
      case 'FUNDED':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'APPROVED':
      case 'RELEASED':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'SUBMITTED':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      default:
        return 'bg-slate-50 text-slate-500 border-slate-200';
    }
  };

  return (
    <div className="w-full max-w-[1000px] mx-auto relative flex flex-col min-h-[calc(100vh-140px)] mb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/expert/service')}
            className="text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
            aria-label="Go back"
          >
            <ArrowLeft size={20} />
          </button>
          <h3 className="text-2xl font-bold text-slate-900">Service Orders</h3>
        </div>

        {/* Search & Filter */}
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search services or clients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all shadow-sm"
            />
          </div>
          
          <div className="relative">
            <button 
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className="flex items-center gap-1.5 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <Filter className="w-4 h-4"/> Filter {statusFilters.size > 0 && `(${statusFilters.size})`}
            </button>
            {isFilterOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setIsFilterOpen(false)}></div>
                <div className="absolute right-0 top-full mt-1.5 w-40 bg-white border border-slate-200 rounded-xl shadow-lg z-20 py-2">
                  {['PENDING', 'ACTIVE', 'CLOSED'].map(status => (
                    <label key={status} className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 cursor-pointer text-xs">
                      <input 
                        type="checkbox" 
                        checked={statusFilters.has(status)}
                        onChange={(e) => {
                          const newFilters = new Set(statusFilters);
                          if (e.target.checked) newFilters.add(status);
                          else newFilters.delete(status);
                          setStatusFilters(newFilters);
                        }}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      {status === 'PENDING' ? 'Pending Payment' : status}
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {isLoadingEngagements ? (
        <div className="flex-grow flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        </div>
      ) : unifiedOrders.length === 0 ? (
        <div className="flex-grow flex flex-col items-center justify-center bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
            <Briefcase className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">No service orders yet</h3>
          <p className="text-slate-500 max-w-sm">
            When clients purchase your service listings, their orders and milestone workspaces will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-sm">No matching orders found.</div>
          ) : (
            filteredOrders.map((order) => {
              const isExpanded = !!expandedOrders[order.id];
              const milestones = order.engagement.milestones || [];
              const activeMilestone = milestones.find((m: any) => m.state !== 'RELEASED' && m.state !== 'APPROVED') || milestones[0];

              return (
                <div key={order.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden transition-all hover:shadow-md">
                  {/* Accordion Header */}
                  <div 
                    onClick={() => toggleOrderExpand(order.id)}
                    className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/50 transition-colors select-none"
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2.5">
                        <span className="text-[10px] font-black text-slate-400 tracking-wider uppercase">Service Order</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${getStatusColor(order.state)}`}>
                          {order.state === 'PENDING' ? 'Pending Payment' : order.state}
                        </span>
                      </div>
                      <h4 className="text-base font-bold text-slate-900 leading-snug truncate">{order.serviceTitle}</h4>
                      <p className="text-xs text-slate-500">
                        Client: <strong className="text-slate-700">{order.clientName}</strong> • Ordered on {new Date(order.updatedAt).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="flex items-center gap-4 justify-between sm:justify-end">
                      <div className="sm:text-right">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Total Value</span>
                        <span className="text-base font-bold text-slate-800">{formatVND(order.priceVnd)}</span>
                      </div>
                      
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </div>
                    </div>
                  </div>

                  {/* Accordion Body */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 bg-slate-50/30 p-5 space-y-4">
                      {/* Action buttons */}
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="outline"
                          onClick={() => navigate(`/expert/engagements/${order.id}/messages`)}
                          className="gap-1.5 text-slate-700 bg-white hover:bg-slate-50 border-slate-200"
                          size="sm"
                        >
                          <MessageSquare size={14} /> Chat with Client
                        </Button>

                        {order.state === 'ACTIVE' && activeMilestone && (
                          <Button 
                            onClick={() => navigate(`/expert/engagements/${order.id}/milestones/${activeMilestone.id}`)}
                            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                            size="sm"
                          >
                            <FolderKanban size={14} /> Open Milestone Workspace
                          </Button>
                        )}

                        {/* Leave a Review — only once the engagement is CLOSED */}
                        {order.state === 'CLOSED' && (
                          <Button
                            onClick={() => navigate(`/expert/engagements/${order.id}/review`)}
                            variant="outline"
                            className="gap-1.5 text-amber-700 bg-white hover:bg-amber-50 border-amber-200"
                            size="sm"
                          >
                            <CheckCircle2 size={14} /> Leave a Review
                          </Button>
                        )}
                      </div>

                      {/* Milestones checklist */}
                      <div className="space-y-3 pt-2">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                          <span className="text-xs font-black uppercase text-slate-400 tracking-wider">Milestones Checklist</span>
                          <span className="text-xs text-slate-500 font-semibold">{milestones.length} milestones defined</span>
                        </div>

                        {milestones.length > 0 ? (
                          <div className="grid grid-cols-1 gap-3">
                            {milestones.map((m: any) => {
                              const isMilestoneActive = m.state !== 'RELEASED' && m.state !== 'APPROVED';
                              return (
                                <div 
                                  key={m.id}
                                  className={`p-4 rounded-xl border flex justify-between items-center gap-4 transition-all bg-white hover:border-slate-300 shadow-sm ${
                                    isMilestoneActive && order.state === 'ACTIVE'
                                      ? 'border-emerald-500/20'
                                      : 'border-slate-100'
                                  }`}
                                >
                                  <div className="space-y-1 min-w-0 flex-1">
                                    <div className="flex items-center gap-2.5">
                                      <span className="text-[10px] font-bold text-slate-400">Milestone #{m.milestoneNumber}</span>
                                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${getMilestoneStateColor(m.state)}`}>
                                        {m.state}
                                      </span>
                                    </div>
                                    <p className="text-sm font-semibold text-slate-800 truncate">
                                      {m.deliverableStatement || (order.serviceTitle ? `Full Delivery for Service: "${order.serviceTitle}"` : 'No deliverable statement provided.')}
                                    </p>
                                  </div>

                                  <div className="flex items-center gap-3 shrink-0">
                                    <span className="text-xs font-bold text-slate-700">{formatVND(m.paymentAmountVnd)}</span>
                                    {order.state === 'ACTIVE' && (
                                      <button
                                        onClick={() => navigate(`/expert/engagements/${order.id}/milestones/${m.id}`)}
                                        className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-emerald-600 transition-colors"
                                        title="View workspace"
                                      >
                                        <ArrowRight size={16} />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-center py-8 text-slate-400 text-xs border border-dashed rounded-xl bg-white">
                            No milestones created yet. Milestones will be defined and funded after the client pays.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

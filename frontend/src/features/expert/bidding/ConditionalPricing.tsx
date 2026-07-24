import { cn } from '@/lib/utils';
import { Plus, Trash2, Clock } from 'lucide-react';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import type { MilestoneFrameworkItem } from '@/types/jsonb.types';
import type { PricingItem } from '@/types/api.types';

export type { PricingItem }; // re-export for backwards-compatibility with BidForm.tsx

interface ConditionalPricingProps {
  frameworkItems: MilestoneFrameworkItem[];
  items: PricingItem[];
  onChange: (items: PricingItem[]) => void;
  errors?: {
    items?: string;
    offers?: Record<number, { price?: string; condition?: string }>;
    milestones?: Record<number, { price?: string; condition?: string }>;
  };
  disabled?: boolean;
  readOnly?: boolean;
}

const formatVND = (n: number) =>
  n ? n.toLocaleString('vi-VN') + ' ₫' : '0 ₫';

export default function ConditionalPricing({
  frameworkItems = [],
  items,
  onChange,
  errors = {},
  disabled = false,
  readOnly = false,
}: ConditionalPricingProps) {
  // If the CEO hasn't defined any milestones, show empty state
  if (!frameworkItems || frameworkItems.length === 0) {
    return (
      <div className="space-y-4">
        <div>
          <h4 className="font-headline text-[14px] font-medium text-[#0F172A]">
            Milestones & Conditional Pricing
          </h4>
          <p className="mt-0.5 text-[12px] text-[#64748B]">
            The project does not have any predefined milestones.
          </p>
        </div>
      </div>
    );
  }

  const addOffer = (milestone_number: number) => {
    onChange([...items, { milestone_number, price_vnd: undefined, condition: '' }]);
  };

  const removeOffer = (milestone_number: number) => {
    onChange(items.filter((i) => i.milestone_number !== milestone_number));
  };

  const updateOffer = (milestone_number: number, patch: Partial<PricingItem>) => {
    onChange(
      items.map((it) =>
        it.milestone_number === milestone_number ? { ...it, ...patch } : it
      )
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <h4 className="font-headline text-[14px] font-medium text-[#0F172A]">
          Milestones & Conditional Pricing
        </h4>
        {readOnly ? (
          <p className="mt-0.5 text-[12px] text-[#64748B]">
            These are the milestones and conditional prices you offered.
          </p>
        ) : (
          <p className="mt-0.5 text-[12px] text-[#64748B]">
            Review the project milestones defined by the client. You can
            optionally add a counter-offer with your own price and condition for
            any milestone. Milestones without a counter-offer keep the client's
            defaults.
          </p>
        )}
      </div>

      {errors.items && (
        <p className="text-[12px] text-[#EF4444]" role="alert">
          {errors.items}
        </p>
      )}

      <div className="space-y-4">
        {frameworkItems.map((fwItem) => {
          // Check if an offer exists for this milestone
          const offerIndex = items.findIndex((it) => it.milestone_number === fwItem.milestone_number);
          const offer = offerIndex >= 0 ? items[offerIndex] : null;
          const itemErr = offerIndex >= 0 ? errors.offers?.[offerIndex] || {} : {};
          const milestoneErr = errors.milestones?.[fwItem.milestone_number];

          return (
            <div
              key={fwItem.milestone_number}
              className="rounded-[8px] border border-[#E2E8F0] bg-white overflow-hidden"
            >
              {/* CEO Milestone Detail */}
              <div className="bg-[#F8FAFC] p-4 border-b border-[#E2E8F0]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <h5 className="font-headline text-[13px] font-semibold text-[#0F172A]">
                        Milestone {fwItem.milestone_number}
                      </h5>
                      {fwItem.estimated_duration_days !== undefined && fwItem.estimated_duration_days > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                          <Clock className="w-3 h-3" /> {fwItem.estimated_duration_days}d
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-[13px] text-[#475569] leading-relaxed">
                      {fwItem.deliverable_statement || 'No deliverable statement provided.'}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[11px] font-medium text-[#64748B] uppercase tracking-wider mb-0.5">Budget</p>
                    <p className="font-headline text-[14px] font-semibold text-[#0F172A]">
                      {formatVND(
                        fwItem.estimated_cost_vnd ??
                          fwItem.estimatedCostVnd ??
                          fwItem.payment_amount_vnd ??
                          fwItem.paymentAmountVnd ??
                          0,
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Expert Offer Section */}
              <div className="p-4">
                {readOnly ? (
                  offer ? (
                    <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[8px] p-4 relative shadow-sm">
                      <h6 className="font-headline text-[12px] font-semibold text-[#0F172A] mb-3 uppercase tracking-wider">Your Counter Offer</h6>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <p className="text-[11px] font-medium text-[#64748B] uppercase tracking-wider mb-1">Counter Price</p>
                          <p className="text-[14px] font-bold text-[#0F172A]">{formatVND(offer.price_vnd || 0)}</p>
                        </div>
                        <div>
                          <p className="text-[11px] font-medium text-[#64748B] uppercase tracking-wider mb-1">Condition / Deliverable</p>
                          <p className="text-[14px] font-medium text-[#0F172A] leading-relaxed">{offer.condition}</p>
                        </div>
                        {offer.estimated_duration_days !== undefined && (
                          <div className="col-span-2 sm:col-span-1">
                            <p className="text-[11px] font-medium text-[#64748B] uppercase tracking-wider mb-1">Estimated Duration</p>
                            <p className="text-[14px] font-medium text-[#0F172A]">{offer.estimated_duration_days} days</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-[13px] text-[#94A3B8] italic px-2">No counter-offer made for this milestone.</div>
                  )
                ) : (
                  !offer ? (
                    <div className="space-y-2">
                      {milestoneErr?.price && (
                        <p className="text-[12px] text-[#EF4444]" role="alert">
                          {milestoneErr.price}
                        </p>
                      )}
                      {milestoneErr?.condition && (
                        <p className="text-[12px] text-[#EF4444]" role="alert">
                          {milestoneErr.condition}
                        </p>
                      )}
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => addOffer(fwItem.milestone_number)}
                        className="inline-flex items-center gap-1.5 rounded-[6px] border border-dashed border-[#CBD5E1] px-3 py-2 text-[13px] font-medium text-[#2563EB] hover:border-[#2563EB] hover:bg-[#2563EB]/5 transition-colors"
                      >
                        <Plus size={14} />
                        {milestoneErr ? 'Add required offer' : 'Add your offer'}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3 relative pt-2">
                      <div className="absolute right-4 top-2">
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => removeOffer(fwItem.milestone_number)}
                          className="inline-flex items-center gap-1.5 rounded-[6px] px-2 py-1 text-[12px] font-medium text-[#EF4444] hover:bg-[#FEF2F2] transition-colors"
                        >
                          <Trash2 size={14} />
                          Remove offer
                        </button>
                      </div>
                      
                      <h6 className="font-headline text-[12px] font-semibold text-[#2563EB] mb-3">Your Counter Offer</h6>

                      <div className="grid gap-4 sm:grid-cols-2">
                        {/* Price */}
                        <div>
                          <label className="block text-[12px] font-medium text-[#64748B] mb-1">
                            Counter Price (VND) <span className="text-[#EF4444]">*</span>
                          </label>
                          <CurrencyInput
                            value={offer.price_vnd}
                            onChange={(val) => updateOffer(fwItem.milestone_number, { price_vnd: val })}
                            disabled={disabled}
                            aria-invalid={!!itemErr.price}
                            className={cn(
                              'w-full rounded-[8px] border bg-white px-[14px] py-[10px] font-body text-[14px] text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0F172A]/10',
                              itemErr.price
                                ? 'border-[#EF4444] ring-1 ring-[#EF4444]/10'
                                : 'border-[#E2E8F0]'
                            )}
                            placeholder="e.g. 5.000.000"
                          />
                          {itemErr.price && (
                            <p className="mt-1 text-[12px] text-[#EF4444]" role="alert">
                              {itemErr.price}
                            </p>
                          )}
                          <p className="mt-0.5 text-[12px] text-[#94A3B8]">
                            {formatVND(offer.price_vnd || 0)}
                          </p>
                        </div>

                        {/* Condition */}
                        <div>
                          <label className="block text-[12px] font-medium text-[#64748B] mb-1">
                            Condition / Deliverable <span className="text-[#EF4444]">*</span>
                          </label>
                          <input
                            type="text"
                            value={offer.condition}
                            onChange={(e) => updateOffer(fwItem.milestone_number, { condition: e.target.value })}
                            disabled={disabled}
                            aria-invalid={!!itemErr.condition}
                            className={cn(
                              'w-full rounded-[8px] border bg-white px-[14px] py-[10px] font-body text-[14px] text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#0F172A]/10',
                              itemErr.condition
                                ? 'border-[#EF4444] ring-1 ring-[#EF4444]/10'
                                : 'border-[#E2E8F0]'
                            )}
                            placeholder="e.g. After data schema freeze"
                          />
                          {itemErr.condition && (
                            <p className="mt-1 text-[12px] text-[#EF4444]" role="alert">
                              {itemErr.condition}
                            </p>
                          )}
                        </div>

                        {/* Duration */}
                        <div className="col-span-2 sm:col-span-1">
                          <label className="block text-[12px] font-medium text-[#64748B] mb-1">
                            Estimated Duration (Days)
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="1000"
                            value={offer.estimated_duration_days || ''}
                            onChange={(e) => updateOffer(fwItem.milestone_number, { estimated_duration_days: parseInt(e.target.value, 10) || undefined })}
                            disabled={disabled}
                            className={cn(
                              'w-full rounded-[8px] border border-[#E2E8F0] bg-white px-[14px] py-[10px] font-body text-[14px] text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#0F172A]/10'
                            )}
                            placeholder="e.g. 7"
                          />
                        </div>
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

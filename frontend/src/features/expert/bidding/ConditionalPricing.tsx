import { cn } from '@/lib/utils';
import { Plus, Trash2 } from 'lucide-react';
import type { MilestoneFrameworkItem } from '@/types/jsonb.types';

export interface PricingItem {
  milestone_number: number;
  price_vnd: number;
  condition: string;
}

interface ConditionalPricingProps {
  frameworkItems: MilestoneFrameworkItem[];
  items: PricingItem[];
  onChange: (items: PricingItem[]) => void;
  errors?: { items?: string; [key: number]: { price?: string; condition?: string } };
  disabled?: boolean;
}

const formatVND = (n: number) =>
  n ? n.toLocaleString('vi-VN') + ' ₫' : '0 ₫';

export default function ConditionalPricing({
  frameworkItems = [],
  items,
  onChange,
  errors = {},
  disabled = false,
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
    onChange([...items, { milestone_number, price_vnd: 0, condition: '' }]);
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
        <p className="mt-0.5 text-[12px] text-[#64748B]">
          Review the project milestones defined by the client. You can optionally add a counter-offer with your own price and condition for any milestone.
        </p>
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
          // error index matches the items array index
          const itemErr = offerIndex >= 0 ? errors[offerIndex] || {} : {};

          return (
            <div
              key={fwItem.milestone_number}
              className="rounded-[8px] border border-[#E2E8F0] bg-white overflow-hidden"
            >
              {/* CEO Milestone Detail */}
              <div className="bg-[#F8FAFC] p-4 border-b border-[#E2E8F0]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h5 className="font-headline text-[13px] font-semibold text-[#0F172A]">
                      Milestone {fwItem.milestone_number}
                    </h5>
                    <p className="mt-1 text-[13px] text-[#475569] leading-relaxed">
                      {fwItem.deliverable_statement || 'No deliverable statement provided.'}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[11px] font-medium text-[#64748B] uppercase tracking-wider mb-0.5">Budget</p>
                    <p className="font-headline text-[14px] font-semibold text-[#0F172A]">
                      {formatVND(fwItem.payment_amount_vnd)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Expert Offer Section */}
              <div className="p-4">
                {!offer ? (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => addOffer(fwItem.milestone_number)}
                    className="inline-flex items-center gap-1.5 rounded-[6px] border border-dashed border-[#CBD5E1] px-3 py-2 text-[13px] font-medium text-[#2563EB] hover:border-[#2563EB] hover:bg-[#2563EB]/5 transition-colors"
                  >
                    <Plus size={14} />
                    Add your offer
                  </button>
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
                        <input
                          type="text"
                          value={offer.price_vnd ? offer.price_vnd.toLocaleString('vi-VN') : ''}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/\D/g, '');
                            updateOffer(fwItem.milestone_number, { price_vnd: parseInt(raw, 10) || 0 });
                          }}
                          disabled={disabled}
                          aria-invalid={!!itemErr.price}
                          className={cn(
                            'w-full rounded-[8px] border bg-white px-[14px] py-[10px] font-body text-[14px] text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0F172A]/10',
                            itemErr.price
                              ? 'border-[#EF4444] ring-1 ring-[#EF4444]/10'
                              : 'border-[#E2E8F0]'
                          )}
                          placeholder="0"
                        />
                        {itemErr.price && (
                          <p className="mt-1 text-[12px] text-[#EF4444]" role="alert">
                            {itemErr.price}
                          </p>
                        )}
                        <p className="mt-0.5 text-[12px] text-[#94A3B8]">
                          {formatVND(offer.price_vnd)}
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
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

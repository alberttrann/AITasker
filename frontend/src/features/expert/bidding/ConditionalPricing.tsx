import { cn } from '@/lib/utils';
import { Plus, Trash2 } from 'lucide-react';

export interface PricingItem {
  milestone_number: number;
  price_vnd: number;
  condition: string;
}

interface ConditionalPricingProps {
  items: PricingItem[];
  onChange: (items: PricingItem[]) => void;
  errors?: { items?: string; [key: number]: { price?: string; condition?: string } };
  disabled?: boolean;
}

const formatVND = (n: number) =>
  n ? n.toLocaleString('vi-VN') + ' ₫' : '0 ₫';

export default function ConditionalPricing({
  items,
  onChange,
  errors = {},
  disabled = false,
}: ConditionalPricingProps) {
  const total = items.reduce((sum, it) => sum + (it.price_vnd || 0), 0);

  const addItem = () => {
    const nextNum = items.length > 0 ? Math.max(...items.map((i) => i.milestone_number)) + 1 : 1;
    onChange([...items, { milestone_number: nextNum, price_vnd: 0, condition: '' }]);
  };

  const removeItem = (idx: number) => {
    onChange(items.filter((_, i) => i !== idx));
  };

  const updateItem = (idx: number, patch: Partial<PricingItem>) => {
    onChange(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  return (
    <div className="space-y-4">
      <div>
        <h4 className="font-headline text-[14px] font-medium text-[#0F172A]">
          Conditional Pricing
          <span className="ml-1 text-[#EF4444]">*</span>
        </h4>
        <p className="mt-0.5 text-[12px] text-[#64748B]">
          Define pricing per milestone. Each price is conditional on deliverable
          acceptance.
        </p>
      </div>

      {errors.items && (
        <p className="text-[12px] text-[#EF4444]" role="alert">
          {errors.items}
        </p>
      )}

      {items.length === 0 && (
        <div className="rounded-[8px] border border-dashed border-[#E2E8F0] bg-[#F8FAFC] p-6 text-center">
          <p className="text-[14px] text-[#64748B]">
            No milestones defined yet.
          </p>
          <p className="mt-1 text-[12px] text-[#94A3B8]">
            Add at least one pricing milestone to continue.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {items.map((item, idx) => {
          const itemErr = errors?.[idx] || {};
          return (
            <div
              key={idx}
              className="rounded-[8px] border border-[#E2E8F0] bg-white p-4"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="font-headline text-[13px] font-semibold text-[#0F172A]">
                  Milestone {item.milestone_number}
                </span>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => removeItem(idx)}
                  className="rounded-[6px] p-1 text-[#64748B] hover:bg-[#FEF2F2] hover:text-[#EF4444] transition-colors"
                  aria-label={`Remove milestone ${item.milestone_number}`}
                >
                  <Trash2 size={16} />
                </button>
              </div>

              {/* Price */}
              <div className="mb-3">
                <label className="block text-[12px] font-medium text-[#64748B] mb-1">
                  Price (VND)
                </label>
                <input
                  type="text"
                  value={item.price_vnd ? item.price_vnd.toLocaleString('vi-VN') : ''}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, '');
                    updateItem(idx, { price_vnd: parseInt(raw, 10) || 0 });
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
                  {formatVND(item.price_vnd)}
                </p>
              </div>

              {/* Condition */}
              <div>
                <label className="block text-[12px] font-medium text-[#64748B] mb-1">
                  Condition / Deliverable
                </label>
                <input
                  type="text"
                  value={item.condition}
                  onChange={(e) => updateItem(idx, { condition: e.target.value })}
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
          );
        })}
      </div>

      {/* Add + Total */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          disabled={disabled}
          onClick={addItem}
          className="inline-flex items-center gap-1.5 rounded-[8px] border border-dashed border-[#CBD5E1] px-3 py-1.5 text-[13px] font-medium text-[#059669] hover:border-[#059669] hover:bg-[#059669]/5 transition-colors"
        >
          <Plus size={14} />
          Add Milestone
        </button>

        {items.length > 0 && (
          <p className="text-right">
            <span className="text-[12px] text-[#64748B]">Total </span>
            <span className="font-headline text-[14px] font-semibold text-[#0F172A]">
              {formatVND(total)}
            </span>
          </p>
        )}
      </div>
    </div>
  );
}

import { cn } from '@/lib/utils';

interface ApproachSummaryProps {
  value: string;
  onChange: (v: string) => void;
  error?: string | null;
  disabled?: boolean;
  readOnly?: boolean;
  maxLength?: number;
}

/**
 * ApproachSummary — expert writes their technical approach.
 * Max 2000 chars, required field for POST /bids.
 */
export default function ApproachSummary({
  value,
  onChange,
  error,
  disabled = false,
  readOnly = false,
  maxLength = 2000,
}: ApproachSummaryProps) {
  const remaining = maxLength - value.length;
  const isOver = remaining < 0;

  return (
    <div className="space-y-1.5">
      <label
        htmlFor="approach-summary"
        className="block font-headline text-[14px] font-medium text-[#0F172A]"
      >
        Approach Summary
        <span className="ml-1 text-[#EF4444]">*</span>
      </label>
      <p className="text-[12px] text-[#64748B]">
        Describe your technical approach to this project. Be specific about
        architecture, tools, and methodology.
      </p>
      {readOnly ? (
        <div className="w-full rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] p-4 font-body text-[14px] leading-relaxed text-[#0F172A] whitespace-pre-wrap shadow-inner min-h-[140px]">
          {value || <span className="text-[#94A3B8] italic">No approach summary provided.</span>}
        </div>
      ) : (
        <textarea
          id="approach-summary"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          rows={6}
          maxLength={maxLength}
          aria-describedby={error ? 'approach-error' : 'approach-helper'}
          aria-invalid={!!error}
          className={cn(
            'w-full rounded-[8px] border bg-white px-[14px] py-[10px] font-body text-[14px] leading-[1.6] text-[#0F172A] placeholder:text-[#94A3B8] transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-[#0F172A]/10',
            error
              ? 'border-[#EF4444] ring-1 ring-[#EF4444]/10'
              : 'border-[#E2E8F0]',
            disabled && 'cursor-not-allowed bg-[#F1F5F9] opacity-50'
          )}
          placeholder="e.g. We will build a RAG pipeline using LangChain and Pinecone..."
        />
      )}
      {!readOnly && (
        <div className="flex items-center justify-between">
          {error && (
            <p id="approach-error" className="text-[12px] text-[#EF4444]" role="alert">
              {error}
            </p>
          )}
          <p
            id="approach-helper"
            className={cn(
              'ml-auto text-[12px]',
              isOver ? 'text-[#EF4444] font-medium' : 'text-[#64748B]'
            )}
          >
            {remaining}/{maxLength}
          </p>
        </div>
      )}
    </div>
  );
}

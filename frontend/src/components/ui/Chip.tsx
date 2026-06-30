import * as React from "react"
import { cn } from "@lib/utils"

export interface ChipProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'filter' | 'filter-active' | 'success' | 'warning' | 'error';
}

const Chip = React.forwardRef<HTMLDivElement, ChipProps>(
  ({ className, variant = 'filter', ...props }, ref) => {
    const variants = {
      filter: "bg-background text-primary border border-slate-200",
      'filter-active': "bg-primary text-white border-none",
      success: "bg-[#22C55E15] text-[#16A34A] border-none",
      warning: "bg-[#EAB30815] text-[#CA8A04] border-none",
      error: "bg-[#EF444415] text-[#DC2626] border-none",
    };

    return (
      <div
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-[4px] px-[12px] py-[4px] text-[12px] font-medium uppercase tracking-[0.5px]",
          variants[variant],
          className
        )}
        {...props}
      />
    )
  }
)
Chip.displayName = "Chip"

export { Chip }

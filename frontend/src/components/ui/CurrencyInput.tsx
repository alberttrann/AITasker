import React from 'react';
import { cn } from '@/lib/utils';

export interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  /**
   * The numeric value. Use `undefined` or `null` for empty states to avoid the '0' prefix bug.
   */
  value?: number | null;
  /**
   * Callback when the numeric value changes. It will pass `undefined` if the input is completely cleared.
   */
  onChange?: (val: number | undefined) => void;
}

export const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ className, value, onChange, placeholder, disabled, ...props }, ref) => {
    
    // Convert current value to properly formatted VND string for display.
    // Explicitly handle 0 vs undefined/null so we don't trap '0' in the input when clearing.
    const displayValue = (value === undefined || value === null || Number.isNaN(value)) 
      ? '' 
      : Number(value).toLocaleString('vi-VN');

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!onChange) return;
      
      // Strip everything except digits
      const raw = e.target.value.replace(/\D/g, '');
      
      if (!raw) {
        onChange(undefined);
      } else {
        onChange(parseInt(raw, 10));
      }
    };

    return (
      <input
        ref={ref}
        type="text"
        inputMode="numeric"
        value={displayValue}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        className={cn("bg-transparent border-none outline-none font-semibold w-full font-body placeholder:text-slate-400 focus:ring-0", className)}
        {...props}
      />
    );
  }
);

CurrencyInput.displayName = 'CurrencyInput';

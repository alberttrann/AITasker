import * as React from "react"
import { cn } from "@lib/utils"

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-[42px] w-full rounded-[8px] border bg-surface px-[14px] py-[10px] text-[14px] font-body text-primary transition-shadow file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-secondary disabled:cursor-not-allowed disabled:bg-primary-bg disabled:opacity-50",
          error 
            ? "border-[2px] border-error focus:border-error focus:ring-[3px] focus:ring-error/10 focus:outline-none" 
            : "border-slate-200 hover:border-primary focus:border-[2px] focus:border-primary focus:ring-[3px] focus:ring-primary/10 focus:outline-none",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn("block text-[14px] font-medium font-body text-primary mb-[6px]", className)}
      {...props}
    />
  )
)
Label.displayName = "Label"

export { Input, Label }

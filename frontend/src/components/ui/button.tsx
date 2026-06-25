import * as React from "react"
import { cn } from "@lib/utils"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    const baseClasses = "inline-flex items-center justify-center font-headline rounded transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-40 disabled:pointer-events-none";
    
    const variants = {
      primary: "bg-primary text-white border-none hover:bg-primary-dark shadow-sm",
      secondary: "bg-transparent text-primary border border-primary hover:bg-primary/5",
      ghost: "bg-transparent text-secondary border-none hover:bg-primary-bg",
      destructive: "bg-error text-white border-none hover:bg-red-600 shadow-sm",
    };

    const sizes = {
      sm: "px-[14px] py-[6px] text-[14px] h-[32px]",
      md: "px-[22px] py-[10px] text-[14px] h-[42px]",
      lg: "px-[28px] py-[12px] text-[16px] h-[48px]",
    };

    return (
      <button
        ref={ref}
        className={cn(baseClasses, variants[variant], sizes[size], className)}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }

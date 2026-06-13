import * as React from "react";
import { cn } from "@lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'default', ...props }, ref) => {
    const variants = {
      primary: "bg-zinc-900 text-white shadow-lg shadow-zinc-200 hover:bg-zinc-800 active:scale-[0.98]",
      secondary: "bg-zinc-100 text-zinc-900 hover:bg-zinc-200",
      outline: "border border-zinc-200 bg-white text-zinc-900 shadow-sm hover:bg-zinc-50",
      ghost: "bg-transparent text-zinc-900 hover:bg-zinc-100",
    };
    
    const sizes = {
      default: "py-3.5 px-4 text-sm rounded-xl",
      sm: "h-9 px-3 rounded-lg text-xs",
      lg: "h-11 px-8 rounded-xl text-base",
      icon: "h-10 w-10 rounded-xl",
    };

    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center font-medium transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400 disabled:pointer-events-none disabled:opacity-50",
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };

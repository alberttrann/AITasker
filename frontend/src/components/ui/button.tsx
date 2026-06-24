import * as React from "react";
import { cn } from "@lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'counter-plus' | 'counter-minus' | 'boom' | 'flip7' | 'secondary' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon' | 'counter';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'default', ...props }, ref) => {
    const variants = {
      primary: "bg-gradient-to-r from-accent to-accent-light text-primary-dark shadow-accent-glow hover:brightness-110 active:scale-95 relative overflow-hidden before:absolute before:inset-0 before:bg-white/20 before:opacity-0 hover:before:opacity-100",
      "counter-plus": "bg-primary-light text-white hover:bg-primary active:scale-95",
      "counter-minus": "bg-coral-light text-white hover:bg-coral active:scale-95",
      boom: "bg-coral text-white shadow-coral-glow hover:bg-coral-dark active:scale-95 animate-[boom-pulse_2s_infinite]",
      flip7: "bg-sky-blue text-white shadow-sky-glow hover:brightness-110 active:scale-95",
      secondary: "bg-primary-bg text-primary-dark hover:bg-primary-light hover:text-white active:scale-95",
      outline: "border-2 border-primary-light bg-transparent text-primary hover:bg-primary-bg active:scale-95",
      ghost: "bg-transparent text-primary hover:bg-primary-bg active:scale-95",
    };
    
    const sizes = {
      default: "min-h-[72px] py-3.5 px-6 text-body rounded-full",
      sm: "min-h-[56px] px-4 rounded-full text-sm",
      lg: "min-h-[88px] px-8 rounded-full text-h3",
      icon: "min-h-[72px] min-w-[72px] rounded-full",
      counter: "h-[80px] w-[80px] rounded-[16px]",
    };

    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center font-headline font-extrabold transition-all duration-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 disabled:pointer-events-none disabled:opacity-50",
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

import * as React from "react";
import { cn } from "@lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "w-full px-4 py-4 min-h-[72px] bg-cream border-2 border-primary-light rounded-[16px] text-body focus:outline-none focus:border-primary focus:shadow-focus transition-all placeholder:text-primary-light/70 disabled:cursor-not-allowed disabled:opacity-50 text-primary-dark font-body",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };

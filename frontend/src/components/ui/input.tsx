import * as React from "react";
import { cn } from "@lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 transition-all placeholder:text-zinc-400 disabled:cursor-not-allowed disabled:opacity-50 text-zinc-900",
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

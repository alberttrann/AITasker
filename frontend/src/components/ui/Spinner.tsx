import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SpinnerProps extends React.HTMLAttributes<SVGSVGElement> {
  size?: "sm" | "md" | "lg" | "xl";
}

const sizeClasses = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-8 w-8",
  xl: "h-10 w-10",
};

export function Spinner({ size = "md", className, ...props }: SpinnerProps) {
  return (
    <Loader2 
      className={cn("animate-spin text-primary", sizeClasses[size], className)} 
      {...props} 
    />
  );
}

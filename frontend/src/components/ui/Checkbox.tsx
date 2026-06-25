import * as React from "react"
import { cn } from "@lib/utils"

export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        type="checkbox"
        ref={ref}
        className={cn(
          "h-[18px] w-[18px] shrink-0 appearance-none rounded-[4px] border-[1.5px] border-slate-300 bg-white checked:border-none checked:bg-primary checked:bg-[url('data:image/svg+xml;base64,PHN2ZyBmaWxsPSJub25lIiB2aWV3Qm94PSIwIDAgMjQgMjQiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iMyIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIGQ9Ik01IDEzbDQgNEwxOSA3Ii8+PC9zdmc+')] disabled:cursor-not-allowed disabled:opacity-40 transition-all",
          className
        )}
        {...props}
      />
    )
  }
)
Checkbox.displayName = "Checkbox"

export { Checkbox }

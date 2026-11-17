import * as React from "react";
import { cn } from "../../lib/utils";

export const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-xl shadow-2xl p-6 md:p-8",
      className
    )}
    {...props}
  />
));
Card.displayName = "Card";


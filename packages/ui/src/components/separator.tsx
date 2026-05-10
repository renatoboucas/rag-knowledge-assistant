import * as React from "react";

import { cn } from "../lib/utils";

const Separator = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "bg-border shrink-0 data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full",
        className,
      )}
      data-orientation="horizontal"
      {...props}
    />
  ),
);
Separator.displayName = "Separator";

export { Separator };

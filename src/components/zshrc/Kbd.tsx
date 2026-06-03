import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[5px] border border-border bg-secondary px-1 font-mono text-[10.5px] font-medium text-muted-foreground tnum",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

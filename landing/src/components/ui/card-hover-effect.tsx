import { AnimatePresence, motion } from "motion/react";
import { type ReactNode, useState } from "react";
import { cn } from "../../lib/utils";

// aceternity "card hover effect", adapted: generic items (no links), square corners,
// brand-soft highlight that slides between cells of the hairline grid.
export function HoverEffect({
  items,
  className,
}: {
  items: { title: string; body: ReactNode }[];
  className?: string;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <div className={cn("grid grid-cols-1 gap-px sm:grid-cols-2 lg:grid-cols-4", className)}>
      {items.map((item, idx) => (
        <div
          key={item.title}
          className="group relative bg-bg"
          onMouseEnter={() => setHoveredIndex(idx)}
          onMouseLeave={() => setHoveredIndex(null)}
        >
          <AnimatePresence>
            {hoveredIndex === idx && (
              <motion.span
                layoutId="feature-hover"
                className="absolute inset-0 block bg-[var(--brand-soft)]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { duration: 0.15 } }}
                exit={{ opacity: 0, transition: { duration: 0.15, delay: 0.2 } }}
              />
            )}
          </AnimatePresence>
          <div className="relative z-10 h-full p-5">
            <h3 className="text-[16px] leading-tight">{item.title}</h3>
            <p className="mt-2 mono text-[12px] leading-relaxed text-muted">{item.body}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

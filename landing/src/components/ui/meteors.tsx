import { motion, useInView } from "motion/react";
import { useRef, useState } from "react";
import { cn } from "../../lib/utils";

// aceternity "meteors", adapted: square pixel heads (no rounding), brand-green trails,
// percent-based spread; randomness fixed once so re-renders don't reshuffle, and the
// infinite animations pause while the card is off-screen.
export function Meteors({ number = 12, className }: { number?: number; className?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref);
  const [meteors] = useState(() =>
    Array.from({ length: number }, (_, idx) => ({
      left: `${(idx / number) * 100}%`,
      delay: `${(Math.random() * 5).toFixed(2)}s`,
      duration: `${Math.floor(Math.random() * 5 + 5)}s`,
    })),
  );

  return (
    <motion.div
      ref={ref}
      aria-hidden
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {meteors.map((m, idx) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: meteors are anonymous and never reorder
          key={idx}
          className={cn(
            "animate-meteor-effect absolute top-[-40px] h-[3px] w-[3px] rotate-[215deg] bg-brand opacity-70",
            "before:absolute before:top-1/2 before:h-px before:w-[50px] before:-translate-y-1/2 before:bg-gradient-to-r before:from-[var(--brand)] before:to-transparent before:content-['']",
            className,
          )}
          style={{
            left: m.left,
            animationDelay: m.delay,
            animationDuration: m.duration,
            animationPlayState: inView ? "running" : "paused",
          }}
        />
      ))}
    </motion.div>
  );
}

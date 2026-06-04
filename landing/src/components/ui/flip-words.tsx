import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "../../lib/utils";

// aceternity "flip words", adapted: index-based cycling (duplicate-safe), timeout cleaned up,
// and an invisible sizer reserves the widest word so the surrounding headline never reflows.
// aria-hidden: the rotating word is decorative — the parent heading carries a stable aria-label.
export function FlipWords({
  words,
  duration = 3000,
  className,
}: {
  words: string[];
  duration?: number;
  className?: string;
}) {
  const [index, setIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  const longest = useMemo(
    () => words.reduce((a, b) => (b.length > a.length ? b : a), ""),
    [words],
  );

  const startAnimation = useCallback(() => {
    setIndex((i) => (i + 1) % words.length);
    setIsAnimating(true);
  }, [words.length]);

  useEffect(() => {
    if (isAnimating) return;
    const t = setTimeout(startAnimation, duration);
    return () => clearTimeout(t);
  }, [isAnimating, duration, startAnimation]);

  const currentWord = words[index];

  return (
    <span aria-hidden className={cn("relative inline-block", className)}>
      {/* invisible sizer: keeps the box as wide as the longest word */}
      <span className="invisible">{longest}</span>
      <AnimatePresence onExitComplete={() => setIsAnimating(false)}>
        <motion.span
          key={index}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 100, damping: 10 }}
          exit={{ opacity: 0, y: -28, filter: "blur(6px)" }}
          className="absolute inset-0 z-10 text-center"
        >
          {currentWord.split("").map((letter, letterIndex) => (
            <motion.span
              // biome-ignore lint/suspicious/noArrayIndexKey: letters repeat within a word; index is the identity
              key={`${index}-${letterIndex}`}
              initial={{ opacity: 0, y: 8, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ delay: letterIndex * 0.05, duration: 0.2 }}
              className="inline-block"
            >
              {letter}
            </motion.span>
          ))}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

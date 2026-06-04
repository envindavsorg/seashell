import { motion, stagger, useAnimate, useInView } from "motion/react";
import { Fragment, useEffect } from "react";
import { cn } from "../../lib/utils";

// aceternity "text generate effect", adapted: triggers when scrolled into view
// (the original fires on mount, which is useless below the fold).
export function TextGenerateEffect({
  words,
  className,
  duration = 0.6,
}: {
  words: string;
  className?: string;
  duration?: number;
}) {
  const [scope, animate] = useAnimate();
  const inView = useInView(scope, { once: true, margin: "-80px" });

  useEffect(() => {
    if (!inView) return;
    animate("span", { opacity: 1, filter: "blur(0px)" }, { duration, delay: stagger(0.12) });
  }, [inView, animate, duration]);

  return (
    <motion.span ref={scope} className={cn("inline", className)}>
      {words.split(" ").map((word, idx) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: words can repeat; position is the identity
        <Fragment key={`${word}-${idx}`}>
          {/* inline-block is required for the blur filter; the space lives outside the span */}
          <motion.span className="inline-block opacity-0" style={{ filter: "blur(8px)" }}>
            {word}
          </motion.span>{" "}
        </Fragment>
      ))}
    </motion.span>
  );
}

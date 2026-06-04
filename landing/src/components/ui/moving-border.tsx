import {
  motion,
  useAnimationFrame,
  useInView,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import { type ElementType, type ReactNode, useRef } from "react";
import { cn } from "../../lib/utils";

// aceternity "moving border", adapted: square corners (rx/ry 0 — pixel aesthetic),
// brand-green bead, surface inner. The rAF loop only runs while the button is near
// the viewport and motion isn't reduced. The caller provides content styling.
export function MovingBorderButton({
  children,
  as: Component = "a",
  containerClassName,
  borderClassName,
  duration = 4000,
  className,
  ...otherProps
}: {
  children: ReactNode;
  as?: ElementType;
  containerClassName?: string;
  borderClassName?: string;
  duration?: number;
  className?: string;
} & Record<string, unknown>) {
  return (
    <Component
      className={cn("relative inline-flex overflow-hidden bg-transparent p-px", containerClassName)}
      {...otherProps}
    >
      <div className="absolute inset-0">
        <MovingBorder duration={duration}>
          <div
            className={cn(
              "h-16 w-16 bg-[radial-gradient(var(--brand)_40%,transparent_60%)] opacity-90",
              borderClassName,
            )}
          />
        </MovingBorder>
      </div>
      <div
        className={cn(
          "relative flex h-full w-full items-center justify-center border border-border bg-surface",
          className,
        )}
      >
        {children}
      </div>
    </Component>
  );
}

export function MovingBorder({
  children,
  duration = 4000,
}: {
  children: ReactNode;
  duration?: number;
}) {
  const pathRef = useRef<SVGRectElement | null>(null);
  const progress = useMotionValue<number>(0);
  const inView = useInView(pathRef, { margin: "200px" });
  const reduceMotion = useReducedMotion();

  useAnimationFrame((time) => {
    if (reduceMotion || !inView) return; // no per-frame geometry reads off-screen
    const length = pathRef.current?.getTotalLength();
    if (length) {
      const pxPerMillisecond = length / duration;
      progress.set((time * pxPerMillisecond) % length);
    }
  });

  const x = useTransform(progress, (val) => {
    const p = pathRef.current?.getPointAtLength(val);
    return p ? p.x : 0;
  });
  const y = useTransform(progress, (val) => {
    const p = pathRef.current?.getPointAtLength(val);
    return p ? p.y : 0;
  });
  const transform = useMotionTemplate`translateX(${x}px) translateY(${y}px) translateX(-50%) translateY(-50%)`;

  return (
    <>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
        className="absolute h-full w-full"
        width="100%"
        height="100%"
        aria-hidden
      >
        <rect fill="none" width="100%" height="100%" rx="0" ry="0" ref={pathRef} />
      </svg>
      <motion.div className="absolute top-0 left-0 inline-block" style={{ transform }}>
        {children}
      </motion.div>
    </>
  );
}

"use client";

import { useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import { LiquidGlass } from "./ui/liquid-glass";

type LiquidGlassDemoProps = {
  shape?: "circle" | "pill";
  scale?: number;
  aberration?: number;
  bevelDepth?: number;
  frost?: number;
  tint?: number;
};

export default function LiquidGlassDemo({
  shape = "circle",
  scale = 48,
  aberration = 14,
  bevelDepth = 37,
  frost = 0.4,
  tint = 0.12,
}: LiquidGlassDemoProps) {
  const constraintsRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const size = shape === "pill" ? { w: 320, h: 120 } : { w: 200, h: 200 };

  return (
    <div
      ref={constraintsRef}
      className="relative h-[36rem] w-full overflow-hidden bg-neutral-900"
    >
      <img
        src="/liquid-glass-office.webp"
        alt=""
        className="absolute inset-0 size-full object-cover"
        draggable={false}
      />
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center p-8 text-center select-none">
        <p className="text-6xl leading-[0.95] font-bold tracking-tighter text-white md:text-8xl">
          Bend the
          <br />
          light.
        </p>
        <div className="mt-8 grid w-full max-w-md grid-cols-12 gap-1.5">
          {Array.from({ length: 48 }).map((_, i) => (
            <span key={i} className="h-1.5 rounded-full bg-white/80" />
          ))}
        </div>
      </div>

      <motion.div
        drag
        dragConstraints={constraintsRef}
        dragElastic={0.1}
        whileDrag={reduceMotion ? undefined : { scale: 1.04 }}
        className="absolute top-1/2 left-1/2 cursor-grab touch-none active:cursor-grabbing"
        style={{
          width: size.w,
          height: size.h,
          marginLeft: -size.w / 2,
          marginTop: -size.h / 2,
        }}
      >
        <LiquidGlass
          radius={size.h / 2}
          scale={scale}
          aberration={aberration}
          bevelDepth={bevelDepth}
          frost={frost}
          tint={tint}
          className="size-full shadow-[0_12px_40px_rgb(0_0_0/0.25),inset_0_1px_0_rgb(255_255_255/0.5)]"
        />
      </motion.div>
    </div>
  );
}

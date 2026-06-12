"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type PanInfo,
} from "motion/react";
import type { DeckItem, VoteValue } from "@/lib/types";
import { PosterImage } from "@/components/media/PosterImage";

export type SwipeCardHandle = { swipe: (value: VoteValue) => void };

const X_THRESHOLD = 100;
const Y_THRESHOLD = 110;
const VELOCITY_THRESHOLD = 600;

/**
 * The top card. Drag right = yes, left = no, up = super like. The
 * accessibility buttons drive the exact same fly-out via the imperative
 * `swipe` handle, so gesture and button votes share one code path.
 */
export const SwipeCard = forwardRef<
  SwipeCardHandle,
  {
    item: DeckItem;
    superLeft: number;
    onVote: (value: VoteValue) => void;
    onSuperRejected: () => void;
    onOpenDetail: () => void;
  }
>(function SwipeCard({ item, superLeft, onVote, onSuperRejected, onOpenDetail }, ref) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-250, 250], [-12, 12]);
  const likeOpacity = useTransform(x, [30, X_THRESHOLD], [0, 1]);
  const nopeOpacity = useTransform(x, [-X_THRESHOLD, -30], [1, 0]);
  const superOpacity = useTransform(y, [-Y_THRESHOLD, -30], [1, 0]);
  const reducedMotion = useReducedMotion();
  const departed = useRef(false);

  const flyOut = (value: VoteValue) => {
    if (departed.current) return;
    departed.current = true;
    if (reducedMotion) {
      onVote(value);
      return;
    }
    const w = typeof window !== "undefined" ? window.innerWidth : 400;
    const h = typeof window !== "undefined" ? window.innerHeight : 800;
    const targetX = value === 1 ? w : value === 0 ? -w : 0;
    const targetY = value === 2 ? -h : y.get();
    animate(x, targetX, { duration: 0.25, ease: "easeIn" });
    animate(y, targetY, {
      duration: 0.25,
      ease: "easeIn",
      onComplete: () => onVote(value),
    });
  };

  useImperativeHandle(ref, () => ({ swipe: flyOut }));

  const settleBack = () => {
    animate(x, 0, { type: "spring", stiffness: 400, damping: 30 });
    animate(y, 0, { type: "spring", stiffness: 400, damping: 30 });
  };

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const goneX =
      Math.abs(info.offset.x) > X_THRESHOLD ||
      Math.abs(info.velocity.x) > VELOCITY_THRESHOLD;
    const goneUp =
      info.offset.y < -Y_THRESHOLD || info.velocity.y < -VELOCITY_THRESHOLD;

    if (goneUp && !goneX) {
      if (superLeft > 0) flyOut(2);
      else {
        onSuperRejected();
        settleBack();
      }
      return;
    }
    if (goneX) {
      flyOut(info.offset.x > 0 ? 1 : 0);
      return;
    }
    settleBack();
  };

  return (
    <motion.div
      drag
      dragElastic={0.9}
      onDragEnd={onDragEnd}
      onTap={onOpenDetail}
      style={{ x, y, rotate }}
      className="absolute inset-0 cursor-grab touch-none overflow-hidden rounded-2xl bg-zinc-900 shadow-2xl active:cursor-grabbing"
      aria-label={`${item.title}${item.year ? ` (${item.year})` : ""} — tap for details, swipe right for yes, left for no, up to super like`}
    >
      <PosterImage
        posterPath={item.posterPath}
        title={item.title}
        size="w780"
        className="h-full w-full"
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-4 pt-16">
        <h2 className="text-2xl font-bold">{item.title}</h2>
        <p className="text-sm text-zinc-300">
          {[
            item.year,
            item.runtimeMin ? `${item.runtimeMin} min` : null,
            item.contentRating,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>

      <motion.span
        style={{ opacity: likeOpacity }}
        className="pointer-events-none absolute left-4 top-6 -rotate-12 rounded-lg border-4 border-emerald-400 px-3 py-1 text-3xl font-extrabold text-emerald-400"
      >
        LIKE
      </motion.span>
      <motion.span
        style={{ opacity: nopeOpacity }}
        className="pointer-events-none absolute right-4 top-6 rotate-12 rounded-lg border-4 border-rose-500 px-3 py-1 text-3xl font-extrabold text-rose-500"
      >
        NOPE
      </motion.span>
      <motion.span
        style={{ opacity: superOpacity }}
        className="pointer-events-none absolute inset-x-0 bottom-24 mx-auto w-fit rounded-lg border-4 border-sky-400 px-3 py-1 text-3xl font-extrabold text-sky-400"
      >
        SUPER ★
      </motion.span>
    </motion.div>
  );
});

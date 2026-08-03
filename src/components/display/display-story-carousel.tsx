"use client";

import { useEffect, useState } from "react";
import { ChevronRight, Radio } from "lucide-react";
import type { DisplayStoryline } from "@/lib/display/storylines";
import { cn } from "@/lib/utils";

type DisplayStoryCarouselProps = {
  stories: DisplayStoryline[];
};

function getToneClasses(tone: DisplayStoryline["tone"]) {
  switch (tone) {
    case "emerald":
      return {
        badge: "border-emerald-300/30 bg-emerald-400/12 text-emerald-100",
        glow: "bg-emerald-400/18",
      };
    case "amber":
      return {
        badge: "border-amber-300/30 bg-amber-400/12 text-amber-100",
        glow: "bg-amber-400/18",
      };
    case "rose":
      return {
        badge: "border-rose-300/30 bg-rose-400/12 text-rose-100",
        glow: "bg-rose-400/18",
      };
    default:
      return {
        badge: "border-sky-300/30 bg-sky-400/12 text-sky-100",
        glow: "bg-sky-400/18",
      };
  }
}

export function DisplayStoryCarousel({ stories }: DisplayStoryCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeStory = stories[activeIndex] ?? stories[0];

  useEffect(() => {
    setActiveIndex(0);
  }, [stories]);

  useEffect(() => {
    if (stories.length <= 1) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % Math.max(stories.length, 1));
    }, 6200);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [stories.length]);

  if (!activeStory) {
    return null;
  }

  const toneClasses = getToneClasses(activeStory.tone);

  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/70 p-6 shadow-[0_32px_90px_-52px_rgba(2,6,23,0.9)] backdrop-blur-xl">
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute right-[-5rem] top-[-4rem] size-48 rounded-full blur-3xl",
          toneClasses.glow
        )}
      />
      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <span
            className={cn(
              "inline-flex rounded-full border px-3 py-1 text-xs font-semibold tracking-[0.16em]",
              toneClasses.badge
            )}
          >
            {activeStory.badge}
          </span>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Radio className="size-3.5" />
            自动播报
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <h2 className="text-3xl font-semibold tracking-tight text-white">
            {activeStory.title}
          </h2>
          <p className="max-w-3xl text-sm leading-8 text-slate-200">
            {activeStory.detail}
          </p>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {stories.map((story, index) => (
              <button
                key={story.id}
                type="button"
                className={cn(
                  "h-2 rounded-full transition-all",
                  index === activeIndex
                    ? "w-10 bg-white"
                    : "w-2 bg-white/20 hover:bg-white/40"
                )}
                aria-label={`切换到播报 ${index + 1}`}
                onClick={() => setActiveIndex(index)}
              />
            ))}
          </div>
          <div className="inline-flex items-center gap-2 text-sm text-slate-300">
            <span>
              {String(activeIndex + 1).padStart(2, "0")} /{" "}
              {String(stories.length).padStart(2, "0")}
            </span>
            <ChevronRight className="size-4" />
          </div>
        </div>
      </div>
    </section>
  );
}

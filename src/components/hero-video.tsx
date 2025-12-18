"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

const VIDEO_SRC =
  "https://res.cloudinary.com/dhqpqfw6w/video/upload/v1766088136/iron_man_zcd3pj.mp4";
const POSTER_SRC =
  "https://res.cloudinary.com/dhqpqfw6w/video/upload/so_0/v1766088136/iron_man_zcd3pj.jpg";

export function HeroVideo({ className }: { className?: string }) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [reducedMotion, setReducedMotion] = React.useState(true);

  React.useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();

    media.addEventListener("change", update);

    return () => {
      media.removeEventListener("change", update);
    };
  }, []);

  React.useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (reducedMotion) {
      video.pause();
      video.currentTime = 0;
      return;
    }

    const playPromise = video.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {});
    }
  }, [reducedMotion]);

  return (
    <section
      className={cn("overflow-hidden rounded-xl border bg-card", className)}
      aria-hidden="true"
    >
      <div className="relative aspect-[16/9] md:aspect-[21/9]">
        {reducedMotion ? (
          <img
            src={POSTER_SRC}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            loading="eager"
            decoding="async"
          />
        ) : (
          <video
            ref={videoRef}
            className="absolute inset-0 h-full w-full object-cover"
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
            poster={POSTER_SRC}
            tabIndex={-1}
            disablePictureInPicture
          >
            <source src={VIDEO_SRC} type="video/mp4" />
          </video>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/40 via-transparent to-transparent" />
      </div>
    </section>
  );
}

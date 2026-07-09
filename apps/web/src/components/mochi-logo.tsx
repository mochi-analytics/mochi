"use client";

import { useId } from "react";

/**
 * The Mochi mascot. Colors come from the --mochi-* custom properties in
 * globals.css, so the dark palette swaps in under any `.dark` ancestor with
 * no client state — the same trick as ThemeToggle.
 */
export function MochiLogo({ className }: { className?: string }) {
  // The sidebar renders two logos at once, so the gradient and clip ids have
  // to be per-instance. React 19's useId is url()-safe, but strip anyway.
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const bodyGrad = `mochi-body-${uid}`;
  const mouthClip = `mochi-mouth-${uid}`;
  const mouth = "M51 62 C53 71,67 71,69 62 C63 66,57 66,51 62 Z";

  return (
    <svg
      viewBox="0 -9 120 120"
      className={className}
      aria-hidden
      focusable="false"
    >
      <defs>
        <radialGradient
          id={bodyGrad}
          cx="42.105301"
          cy="21.941532"
          r="73.324878"
          fx="42.105301"
          fy="21.941532"
          gradientTransform="matrix(1.1150377,0,0,0.49962579,0,14.578445)"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="var(--mochi-body-0)" />
          <stop offset="0.78064793" stopColor="var(--mochi-body-1)" />
          <stop offset="1" stopColor="var(--mochi-body-2)" />
        </radialGradient>
        <clipPath id={mouthClip}>
          <path d={mouth} />
        </clipPath>
      </defs>

      <path
        d="m 10,48 c 0,-21 20,-37 50,-37 30,0 50,16 50,37 0,12 -3,22 -13,31 C 85,89 72,91 60,91 48,91 35,89 23,79 13,70 10,60 10,48 Z"
        fill={`url(#${bodyGrad})`}
        stroke="var(--mochi-outline)"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />

      <ellipse cx="31" cy="60" rx="9" ry="5" fill="var(--mochi-cheek)" />
      <ellipse cx="89" cy="60" rx="9" ry="5" fill="var(--mochi-cheek)" />

      <ellipse cx="45" cy="48.5" rx="6.6" ry="8" fill="var(--mochi-eye)" />
      <ellipse cx="75" cy="48.5" rx="6.6" ry="8" fill="var(--mochi-eye)" />
      <circle cx="47.6" cy="45" r="2.7" fill="var(--mochi-glint)" />
      <circle cx="77.6" cy="45" r="2.7" fill="var(--mochi-glint)" />
      <circle cx="43" cy="52" r="1.4" fill="var(--mochi-glint)" opacity="0.85" />
      <circle cx="73" cy="52" r="1.4" fill="var(--mochi-glint)" opacity="0.85" />

      <path d={mouth} fill="var(--mochi-mouth)" />
      <g clipPath={`url(#${mouthClip})`}>
        <ellipse cx="60" cy="70" rx="6" ry="3.6" fill="var(--mochi-tongue)" />
      </g>
      <path
        d={mouth}
        fill="none"
        stroke="var(--mochi-mouth)"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

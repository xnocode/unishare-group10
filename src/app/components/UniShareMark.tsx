import React from "react";

interface UniShareMarkProps {
  size?: number;
  className?: string;
}

/** Shared UniShare brand glyph (overlapping campus circles + bridge bar). */
export function UniShareMark({ size = 28, className }: UniShareMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="16" r="8.5" stroke="currentColor" strokeWidth="2.4" />
      <circle cx="20" cy="16" r="8.5" stroke="currentColor" strokeWidth="2.4" />
      <path d="M16 11.5v9" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}


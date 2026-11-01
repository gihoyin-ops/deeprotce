'use client';

import React from 'react';

type DeepChatLogoMarkProps = React.SVGProps<SVGSVGElement>;

// svg logo matching theme currentColor
export default function DeepChatLogoMark({ className = '', ...props }: DeepChatLogoMarkProps) {
  return (
    <svg
      viewBox="0 0 120 120"
      role="img"
      aria-label="DeepChat"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      {...props}
    >
      <g transform="translate(1, 0)">
        <path d="M 29,32 L 29,24 L 55,24 A 36,36 0 0 1 91,60 A 36,36 0 0 1 81,84" strokeWidth="10" />
        <path d="M 67,94 A 36,36 0 0 1 55,96 L 29,96 L 29,62" strokeWidth="10" />
        <path d="M 45,40 L 55,40 A 20,20 0 0 1 75,60 A 20,20 0 0 1 55,80 L 45,80" strokeWidth="6" />
        <circle cx="29" cy="47" r="4" fill="currentColor" stroke="none" />
        <circle cx="74" cy="89" r="4" fill="currentColor" stroke="none" />
        <circle cx="45" cy="60" r="4.5" fill="currentColor" stroke="none" />
      </g>
    </svg>
  );
}

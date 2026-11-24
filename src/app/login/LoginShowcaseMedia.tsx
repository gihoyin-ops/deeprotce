'use client';

import React from 'react';

const LOGIN_VIDEO_URL =
  'https://cdn.deepsia.my.id/videos/Person_sitting_at_desk_thoughtful_dd1a9880.webm';

export default function LoginShowcaseMedia() {
  return (
    <div className="relative mx-auto h-[420px] w-full max-w-[460px] overflow-hidden rounded-[24px] bg-slate-950 sm:h-[500px] lg:h-[540px]">
      <video
        src={LOGIN_VIDEO_URL}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        aria-hidden="true"
        className="block h-full w-full object-cover"
      />
    </div>
  );
}

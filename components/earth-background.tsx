"use client"

import { useEffect, useRef } from "react"

export function EarthBackground() {
  const videoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    const vid = videoRef.current
    if (!vid) return

    const handle = () => {
      if (mq.matches) {
        vid.pause()
        vid.currentTime = 0
      } else {
        // Attempt to play; ignore promise rejection in some browsers when autoplay policies block
        vid.play().catch(() => {})
      }
    }

    handle()
    mq.addEventListener?.("change", handle)
    return () => mq.removeEventListener?.("change", handle)
  }, [])

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0" style={{ contain: "layout paint size" }}>
      {/* Video layer */}
      <video ref={videoRef} className="h-full w-full object-cover" autoPlay muted loop playsInline preload="auto">
        {/* Prefer root public path first: /public/main-earth-bg.mp4 */}
        <source src="/main-earth-bg.mp4" type="video/mp4" />
        {/* Fallback if the file is inside /public/videos */}
        <source src="/videos/main-earth-bg.mp4" type="video/mp4" />
      </video>

      {/* Readability overlays: subtle vignette + top/bottom gradient using tokens */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(0,0,0,0.25)_100%)]" />
      <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/10 to-background/50" />
    </div>
  )
}

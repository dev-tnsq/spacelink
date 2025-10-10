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
      <video
        ref={videoRef}
        className="h-full w-full object-cover"
        src="/videos/earth.mp4"
        // Using a token-friendly soft poster to avoid hard-coded colors
        poster="/earth-view-from-space.jpg"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
      />
      {/* Overlay for readability over bright frames */}
      <div className="absolute inset-0 bg-background/60" />
    </div>
  )
}

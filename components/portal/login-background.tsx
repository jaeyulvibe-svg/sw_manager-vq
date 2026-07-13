"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { cn } from "@/lib/utils"

function Video({ src, className, placeholder }: { src: string; className?: string; placeholder?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [videoLoaded, setVideoLoaded] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleLoaded = () => setVideoLoaded(true)
    video.addEventListener("loadeddata", handleLoaded)
    video.addEventListener("canplay", handleLoaded)
    video.load()
    if (video.readyState >= 2) setVideoLoaded(true)

    return () => {
      video.removeEventListener("loadeddata", handleLoaded)
      video.removeEventListener("canplay", handleLoaded)
    }
  }, [src])

  useEffect(() => {
    if (videoRef.current && videoLoaded) {
      videoRef.current.play()
    }
  }, [videoLoaded])

  return (
    <>
      {placeholder ? (
        <Image
          src={placeholder}
          alt=""
          fill
          priority
          sizes="50vw"
          quality={100}
          className={cn(className, "object-cover transition-opacity duration-700 ease-out", videoLoaded && "opacity-0")}
        />
      ) : null}
      <video
        ref={videoRef}
        src={src}
        muted
        playsInline
        controls={false}
        preload="auto"
        // 영상이 준비되기 전에는 배경색만 보여주고, 로드되면 부드럽게 페이드인한다
        className={cn(className, "opacity-0 transition-opacity duration-700 ease-out", videoLoaded && "opacity-100")}
      />
    </>
  )
}

export function LoginBackground({ src, placeholder }: { src: string; placeholder?: string }) {
  const classNames = "absolute left-0 top-0 h-full w-full object-cover bg-background"

  return <Video src={src} placeholder={placeholder} className={classNames} />
}

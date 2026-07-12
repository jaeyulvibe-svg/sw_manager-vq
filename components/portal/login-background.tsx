"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { cn } from "@/lib/utils"

function VideoWithPlaceholder({
  src,
  className,
  placeholder,
}: {
  src: string
  className?: string
  placeholder?: string
}) {
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
          loading="eager"
          priority
          sizes="100vw"
          alt="배경"
          className={cn(className, videoLoaded && "invisible")}
          quality={100}
          fill
        />
      ) : null}
      <video
        ref={videoRef}
        src={src}
        muted
        playsInline
        controls={false}
        preload="auto"
        className={cn(className, !videoLoaded && "invisible")}
      />
    </>
  )
}

export function LoginBackground({
  src,
  placeholder,
}: {
  src: string
  placeholder?: string
}) {
  const classNames =
    "absolute left-0 top-0 h-full w-full rounded-[42px] object-cover bg-background md:rounded-[72px]"

  return <VideoWithPlaceholder src={src} className={classNames} placeholder={placeholder} />
}

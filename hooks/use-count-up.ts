"use client"

import { useEffect, useRef, useState } from "react"

type Options = {
  duration?: number
  decimals?: number
  delay?: number
}

// Animated count-up that eases toward the target value on mount.
export function useCountUp(target: number, options: Options = {}) {
  const { duration = 1600, decimals = 0, delay = 0 } = options
  const [value, setValue] = useState(0)
  const frameRef = useRef<number | null>(null)

  useEffect(() => {
    let start: number | null = null
    let timeoutId: ReturnType<typeof setTimeout>

    const step = (timestamp: number) => {
      if (start === null) start = timestamp
      const progress = Math.min((timestamp - start) / duration, 1)
      // easeOutExpo for a dramatic, premium settle
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress)
      setValue(target * eased)
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(step)
      }
    }

    timeoutId = setTimeout(() => {
      frameRef.current = requestAnimationFrame(step)
    }, delay)

    return () => {
      clearTimeout(timeoutId)
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
    }
  }, [target, duration, delay])

  const factor = Math.pow(10, decimals)
  const rounded = Math.round(value * factor) / factor
  return rounded
}

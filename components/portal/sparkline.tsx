"use client"

import { useId } from "react"

type SparklineProps = {
  data: number[]
  /** CSS color token, e.g. "var(--primary)" */
  color?: string
  width?: number
  height?: number
  className?: string
}

/**
 * Lightweight dependency-free sparkline drawn with inline SVG.
 * Includes a soft gradient area fill, an animated draw-in line,
 * and a glowing end dot for a premium feel.
 */
export function Sparkline({
  data,
  color = "var(--primary)",
  width = 120,
  height = 36,
  className,
}: SparklineProps) {
  const id = useId()
  const pad = 3
  const w = width
  const h = height
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1

  const points = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2)
    const y = pad + (1 - (v - min) / range) * (h - pad * 2)
    return [x, y] as const
  })

  const linePath = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`)
    .join(" ")

  const areaPath =
    `${linePath} L${points[points.length - 1][0].toFixed(2)},${h - pad} ` +
    `L${points[0][0].toFixed(2)},${h - pad} Z`

  const [lastX, lastY] = points[points.length - 1]

  // Approximate path length for the draw-in animation
  let length = 0
  for (let i = 1; i < points.length; i++) {
    const dx = points[i][0] - points[i - 1][0]
    const dy = points[i][1] - points[i - 1][1]
    length += Math.sqrt(dx * dx + dy * dy)
  }

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className={className}
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <linearGradient id={`fill-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#fill-${id})`} />
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="spark-line"
        style={{ ["--spark-len" as string]: length }}
      />
      <circle cx={lastX} cy={lastY} r={2.6} fill={color}>
        <animate
          attributeName="r"
          values="2.6;4;2.6"
          dur="2s"
          repeatCount="indefinite"
        />
      </circle>
      <circle cx={lastX} cy={lastY} r={5} fill={color} opacity="0.25" />
    </svg>
  )
}

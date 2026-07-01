export function AmbientBackground() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden
    >
      {/* 은은한 단색 글로우 — 배경 깊이감만 부여 */}
      <div className="absolute -left-48 -top-40 h-[32rem] w-[32rem] rounded-full bg-primary/8 blur-[120px]" />

      {/* Static grid lattice */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(oklch(0.72 0.19 235) 1px, transparent 1px), linear-gradient(90deg, oklch(0.72 0.19 235) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage:
            "radial-gradient(ellipse at 50% 0%, #000 30%, transparent 80%)",
          WebkitMaskImage:
            "radial-gradient(ellipse at 50% 0%, #000 30%, transparent 80%)",
        }}
      />

      {/* Film grain */}
      <div className="noise-overlay absolute inset-0" />
    </div>
  )
}

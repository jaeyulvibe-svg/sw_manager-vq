export function AmbientBackground() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden
    >
      {/* Aurora blobs — subtle, low-contrast for projector readability */}
      <div className="aurora-blob absolute -left-48 -top-40 h-[32rem] w-[32rem] rounded-full bg-primary/12 blur-[120px]" />
      <div className="aurora-blob aurora-blob-slow absolute right-[-12rem] top-1/4 h-[30rem] w-[30rem] rounded-full bg-neon/10 blur-[130px]" />
      <div className="aurora-blob absolute bottom-[-14rem] left-1/3 h-[28rem] w-[28rem] rounded-full bg-eos/8 blur-[140px]" />

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

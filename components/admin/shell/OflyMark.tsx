// Biểu tượng mặt trời mọc (semicircle + tia + đường chân trời, stroke rust) + chữ OpenFly.
// Tham chiếu pixel: logo trong `OpenFly Admin.dc.html`.

interface OflyMarkProps {
  size?: number;
  wordmarkSize?: number;
  showWordmark?: boolean;
}

export function OflyMark({ size = 26, wordmarkSize = 22, showWordmark = true }: OflyMarkProps) {
  return (
    <div className="flex items-center gap-2.5">
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        stroke="var(--rust)"
        strokeWidth="2.1"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <line x1="4" y1="25" x2="28" y2="25" />
        <path d="M9.5 25a6.5 6.5 0 0 1 13 0" />
        <line x1="16" y1="6.5" x2="16" y2="11" />
        <line x1="7" y1="9.5" x2="9.7" y2="13" />
        <line x1="25" y1="9.5" x2="22.3" y2="13" />
      </svg>
      {showWordmark ? (
        <span
          className="ofly-serif leading-none"
          style={{ fontSize: wordmarkSize, fontWeight: 500, letterSpacing: "-0.3px" }}
        >
          Open<span style={{ color: "var(--rust)" }}>Fly</span>
        </span>
      ) : null}
    </div>
  );
}

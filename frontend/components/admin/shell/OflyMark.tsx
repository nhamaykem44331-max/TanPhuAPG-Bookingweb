import Image from "next/image";

// Thương hiệu Tân Phú APG ở đầu sidebar — logo ảnh + tên + dòng phụ.
// Giữ nguyên tên file/export `OflyMark` để không phải sửa file khác.

interface OflyMarkProps {
  /** Cạnh của ô logo (px). */
  size?: number;
  /** Cỡ chữ tên thương hiệu (px). */
  wordmarkSize?: number;
  showWordmark?: boolean;
}

export function OflyMark({ size = 32, wordmarkSize = 15, showWordmark = true }: OflyMarkProps) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <Image
        src="/assets/tanphu-apg-logo.jpg"
        alt="Tân Phú APG"
        width={size}
        height={size}
        priority
        style={{
          width: size,
          height: size,
          flexShrink: 0,
          borderRadius: 9,
          objectFit: "cover",
          // Bóng nhẹ để logo ảnh không "dán phẳng" vào nền giấy của sidebar.
          boxShadow: "0 2px 8px rgba(10,37,71,0.18)",
        }}
      />
      {showWordmark ? (
        <span style={{ display: "flex", flexDirection: "column", lineHeight: 1, minWidth: 0 }}>
          <span
            style={{
              fontFamily: "var(--sans)",
              fontSize: wordmarkSize,
              fontWeight: 800,
              letterSpacing: "0.3px",
              color: "var(--ink)",
              whiteSpace: "nowrap",
            }}
          >
            Tân Phú <span style={{ color: "var(--rust)" }}>APG</span>
          </span>
          <span
            style={{
              fontFamily: "var(--sans)",
              fontSize: 7.5,
              fontWeight: 600,
              letterSpacing: "0.6px",
              textTransform: "uppercase",
              color: "var(--ink4)",
              marginTop: 3,
              whiteSpace: "nowrap",
            }}
          >
            Corporate Aviation Services
          </span>
        </span>
      ) : null}
    </span>
  );
}

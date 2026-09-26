import Image from "next/image";
import Link from "next/link";

export function Logo({ height = 40 }: { height?: number }) {
  const width = Math.round(height * (1586 / 992));
  return (
    <Link href="/" aria-label="Foccus Car — início" style={{ display: "inline-flex" }}>
      <Image src="/brand/foccus-car-logo-sm.webp" alt="Foccus Car — Locadora de Veículos" width={width} height={height} priority />
    </Link>
  );
}

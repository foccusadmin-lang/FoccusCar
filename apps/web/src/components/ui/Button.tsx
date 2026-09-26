import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost";
type Size = "md" | "lg";

function cls(variant: Variant, size: Size, block?: boolean, extra?: string) {
  return ["btn", `btn-${variant}`, size === "lg" && "btn-lg", block && "btn-block", extra].filter(Boolean).join(" ");
}

export function Button({
  variant = "primary", size = "md", block, className, ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; block?: boolean }) {
  return <button className={cls(variant, size, block, className)} {...props} />;
}

export function ButtonLink({
  href, variant = "primary", size = "md", block, children,
}: { href: string; variant?: Variant; size?: Size; block?: boolean; children: ReactNode }) {
  return <Link href={href} className={cls(variant, size, block)}>{children}</Link>;
}

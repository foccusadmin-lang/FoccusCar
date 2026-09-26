import type { ReactNode } from "react";

export type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "gold";

/** Status sempre com texto (não depende só de cor — acessibilidade, seção 101). */
export function Badge({ tone = "neutral", plain, children }: { tone?: Tone; plain?: boolean; children: ReactNode }) {
  return <span className={["badge", tone !== "neutral" && tone, plain && "plain"].filter(Boolean).join(" ")}>{children}</span>;
}

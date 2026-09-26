import type { ReactNode } from "react";

export function Alert({ tone = "neutral", title, children }: { tone?: "neutral" | "warning" | "danger" | "success"; title?: string; children: ReactNode }) {
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={["alert", tone !== "neutral" && tone].filter(Boolean).join(" ")}>
      <div className="stack" style={{ gap: 4 }}>
        {title && <strong>{title}</strong>}
        <div>{children}</div>
      </div>
    </div>
  );
}

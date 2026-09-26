import type { ReactNode } from "react";

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="card card-pad stack" style={{ alignItems: "center", textAlign: "center", padding: "48px 24px" }}>
      <div aria-hidden style={{ width: 56, height: 2, background: "var(--fc-gold-gradient)", borderRadius: 2 }} />
      <h3 style={{ fontSize: 20 }}>{title}</h3>
      <p className="muted" style={{ margin: 0, maxWidth: 420 }}>{description}</p>
      {action}
    </div>
  );
}

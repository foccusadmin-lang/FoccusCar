"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "./Button";

/** Confirmação de operações críticas (seção 104). */
export function ConfirmDialog(props: {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  tone?: "primary" | "danger";
  busy?: boolean;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!props.open) return;
    ref.current?.querySelector<HTMLElement>("textarea, input, button")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && props.onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props.open, props.onCancel]);
  if (!props.open) return null;
  return (
    <div className="dialog-backdrop" role="presentation" onClick={props.onCancel}>
      <div ref={ref} className="dialog card stack" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" onClick={(e) => e.stopPropagation()} style={{ gap: 16 }}>
        <h2 id="confirm-title" style={{ fontSize: 20 }}>{props.title}</h2>
        {props.children}
        <div className="actions-bar">
          <Button variant="ghost" onClick={props.onCancel}>Cancelar</Button>
          <Button
            onClick={props.onConfirm}
            disabled={props.busy || props.confirmDisabled}
            aria-busy={props.busy}
            style={props.tone === "danger" ? { background: "var(--fc-danger)", color: "#fff", boxShadow: "none" } : undefined}
          >
            {props.busy ? "Aguarde…" : props.confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

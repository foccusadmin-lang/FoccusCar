"use client";

import { ADMIN_BLOCK_NOTE, MANUAL_VEHICLE_STATUSES, STATUS_NEEDS_REASON, VEHICLE_STATUS_LABELS, checkManualStatusChange, type VehicleStatus } from "@foccus/core";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "../ui/Alert";
import { ConfirmDialog } from "../ui/ConfirmDialog";

/** Troca manual de status com confirmação e motivo (seções 30 e 104). */
export function VehicleStatusControl({ vehicleId, status }: { vehicleId: string; status: VehicleStatus }) {
  const router = useRouter();
  const [target, setTarget] = useState<VehicleStatus | "">("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const options = MANUAL_VEHICLE_STATUSES.filter((s) => checkManualStatusChange(status, s).ok);
  const needsReason = target !== "" && STATUS_NEEDS_REASON.includes(target);

  async function confirm() {
    if (!target) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/vehicles/${vehicleId}/status`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: target, reason: reason.trim() || undefined }) }).catch(() => null);
    const json = await res?.json().catch(() => null);
    setBusy(false);
    setTarget("");
    setReason("");
    if (!res?.ok) return setError(json?.error?.message ?? "Sem conexão. Tente novamente.");
    router.refresh();
  }

  if (status === "RENTED") return <span className="muted" style={{ fontSize: 14 }}>Em locação: o status muda na devolução.</span>;

  return (
    <div className="stack" style={{ gap: 8, minWidth: 220 }}>
      <label className="sr-only" htmlFor="status-change">Mudar status</label>
      <select id="status-change" className="select" value="" onChange={(e) => setTarget(e.target.value as VehicleStatus)}>
        <option value="">Mudar status…</option>
        {options.map((s) => <option key={s} value={s}>{VEHICLE_STATUS_LABELS[s]}</option>)}
      </select>
      {error && <Alert tone="danger">{error}</Alert>}
      <ConfirmDialog
        open={target !== ""}
        title={target ? `Mudar para ${VEHICLE_STATUS_LABELS[target]}?` : ""}
        confirmLabel={target === "BLOCKED" ? "Bloquear veículo" : "Confirmar"}
        tone={target === "BLOCKED" || target === "INACTIVE" ? "danger" : "primary"}
        busy={busy}
        confirmDisabled={needsReason && reason.trim().length < 5}
        onCancel={() => { setTarget(""); setReason(""); }}
        onConfirm={confirm}
      >
        <p style={{ margin: 0 }}>
          {VEHICLE_STATUS_LABELS[status]} → <strong>{target ? VEHICLE_STATUS_LABELS[target] : ""}</strong>. A mudança fica registrada na Vida do Veículo.
        </p>
        {(target === "BLOCKED" || target === "INACTIVE") && <p className="muted" style={{ margin: 0, fontSize: 14 }}>O veículo sai da vitrine e não aceita novas reservas.</p>}
        {target === "BLOCKED" && <p className="muted" style={{ margin: 0, fontSize: 14 }}>{ADMIN_BLOCK_NOTE}</p>}
        <div className="field">
          <label htmlFor="status-reason">Motivo{needsReason ? "" : " (opcional)"}</label>
          <textarea id="status-reason" className="input" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="Ex.: revisão dos 40.000 km" />
        </div>
      </ConfirmDialog>
    </div>
  );
}

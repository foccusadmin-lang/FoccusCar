"use client";

import { VEHICLE_DOCUMENT_LABELS, VEHICLE_DOCUMENT_TYPES } from "@foccus/core";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { formatCents, formatDate, parseMoneyToCents } from "@/lib/format";
import { Alert } from "../ui/Alert";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { EmptyState } from "../ui/EmptyState";

type Doc = { id: string; type: string; label: string; number: string | null; issuedAt: string | null; expiresAt: string | null; costCents: number | null; hasFile: boolean; state: string; daysLeft: number | null };

function ExpiryBadge({ d }: { d: Doc }) {
  if (d.state === "EXPIRED") return <Badge tone="danger">Vencido</Badge>;
  if (d.state === "EXPIRING") return <Badge tone="warning">Vence em {d.daysLeft} dia(s)</Badge>;
  if (d.state === "VALID") return <Badge tone="success">Em dia</Badge>;
  return <Badge plain>Sem vencimento</Badge>;
}

/** Documentos da frota (seção 74) com alerta de vencimento e arquivo opcional. */
export function VehicleDocuments({ vehicleId, documents, canManage }: { vehicleId: string; documents: Doc[]; canManage: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: "danger" | "success"; text: string } | null>(null);
  const [archiving, setArchiving] = useState<Doc | null>(null);
  const [reason, setReason] = useState("");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    form.set("costCents", String(parseMoneyToCents(String(form.get("cost") ?? "")) ?? ""));
    form.delete("cost");
    const file = form.get("file");
    if (file instanceof File && file.size === 0) form.delete("file");
    setBusy(true);
    setErrors({});
    setMessage(null);
    const res = await fetch(`/api/vehicles/${vehicleId}/documents`, { method: "POST", body: form }).catch(() => null);
    const json = await res?.json().catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      setErrors(json?.error?.fields ?? {});
      return setMessage({ tone: "danger", text: json?.error?.message ?? "Sem conexão. Tente novamente." });
    }
    setOpen(false);
    setMessage({ tone: "success", text: "Documento registrado." });
    router.refresh();
  }

  async function archive() {
    if (!archiving) return;
    setBusy(true);
    const res = await fetch(`/api/vehicle-documents/${archiving.id}`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ reason }) }).catch(() => null);
    const json = await res?.json().catch(() => null);
    setBusy(false);
    setArchiving(null);
    setReason("");
    if (!res?.ok) return setMessage({ tone: "danger", text: json?.error?.message ?? "Sem conexão. Tente novamente." });
    router.refresh();
  }

  return (
    <div className="stack" style={{ gap: 16 }}>
      {message && <Alert tone={message.tone}>{message.text}</Alert>}
      {canManage && !open && <div><Button onClick={() => setOpen(true)}>Adicionar documento</Button></div>}
      {open && (
        <form className="card card-pad stack" onSubmit={submit} style={{ gap: 14 }} noValidate>
          <strong>Novo documento</strong>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="d-type">Tipo *</label>
              <select id="d-type" name="type" className="select" defaultValue="CRLV">
                {VEHICLE_DOCUMENT_TYPES.map((t) => <option key={t} value={t}>{VEHICLE_DOCUMENT_LABELS[t]}</option>)}
              </select>
            </div>
            <div className="field"><label htmlFor="d-number">Número / apólice</label><input id="d-number" name="number" className="input" maxLength={60} /></div>
            <div className="field"><label htmlFor="d-issued">Emissão</label><input id="d-issued" name="issuedAt" type="date" className="input" /></div>
            <div className="field">
              <label htmlFor="d-expires">Vencimento</label><input id="d-expires" name="expiresAt" type="date" className="input" aria-invalid={Boolean(errors.expiresAt)} />
              {errors.expiresAt && <span className="error">{errors.expiresAt}</span>}
            </div>
            <div className="field"><label htmlFor="d-cost">Custo (R$)</label><input id="d-cost" name="cost" className="input" inputMode="decimal" placeholder="0,00" /></div>
            <div className="field">
              <label htmlFor="d-file">Arquivo (PDF ou foto, até 10 MB)</label>
              <input id="d-file" name="file" type="file" className="input" accept="image/jpeg,image/png,image/webp,application/pdf" style={{ paddingTop: 10 }} />
            </div>
          </div>
          <div className="actions-bar">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={busy}>{busy ? "Salvando…" : "Salvar documento"}</Button>
          </div>
        </form>
      )}
      {documents.length === 0 ? (
        <EmptyState title="Nenhum documento" description="Registre CRLV, licenciamento, seguro e IPVA para receber alertas antes do vencimento." />
      ) : (
        <div className="table-wrap"><table className="data-table">
          <thead><tr><th>Documento</th><th>Número</th><th>Vencimento</th><th>Situação</th><th>Custo</th><th aria-label="Ações" /></tr></thead>
          <tbody>
            {documents.map((d) => (
              <tr key={d.id}>
                <td><strong>{d.label}</strong></td>
                <td data-label="Número">{d.number ?? "—"}</td>
                <td data-label="Vencimento">{d.expiresAt ? formatDate(d.expiresAt) : "—"}</td>
                <td><ExpiryBadge d={d} /></td>
                <td data-label="Custo">{d.costCents != null ? formatCents(d.costCents) : "—"}</td>
                <td>
                  <div className="row" style={{ gap: 4 }}>
                    {d.hasFile && <a className="btn btn-ghost" style={{ minHeight: 36, padding: "0 10px" }} href={`/api/vehicle-documents/${d.id}`} target="_blank" rel="noreferrer">Ver arquivo</a>}
                    {canManage && <Button variant="ghost" style={{ minHeight: 36, padding: "0 10px" }} onClick={() => setArchiving(d)}>Arquivar</Button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
      <ConfirmDialog open={Boolean(archiving)} title="Arquivar documento?" confirmLabel="Arquivar" tone="danger" busy={busy} confirmDisabled={reason.trim().length < 5} onCancel={() => { setArchiving(null); setReason(""); }} onConfirm={archive}>
        <p style={{ margin: 0 }}>{archiving?.label} sai da lista e dos alertas, mas continua no histórico do veículo.</p>
        <div className="field">
          <label htmlFor="d-reason">Motivo</label>
          <textarea id="d-reason" className="input" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="Ex.: substituído pelo licenciamento 2027" />
        </div>
      </ConfirmDialog>
    </div>
  );
}

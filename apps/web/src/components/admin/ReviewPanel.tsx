"use client";

import type { getReviewDetail } from "@foccus/services";
import { useState } from "react";
import { formatDate } from "@/lib/format";
import { maskCpfInput, maskPhone } from "@/lib/masks";
import { Alert } from "../ui/Alert";
import { Badge, type Tone } from "../ui/Badge";
import { Button, ButtonLink } from "../ui/Button";
import { ConfirmDialog } from "../ui/ConfirmDialog";

type Detail = Awaited<ReturnType<typeof getReviewDetail>>;
type Pending = { kind: "approve" | "reject"; docId: string; label: string } | { kind: "account" } | null;

const TONE: Record<string, Tone> = { PENDING: "info", UNDER_REVIEW: "info", APPROVED: "success", REJECTED: "danger", EXPIRED: "danger" };
const LABEL: Record<string, string> = { PENDING: "Pendente", UNDER_REVIEW: "Em análise", APPROVED: "Aprovado", REJECTED: "Recusado", EXPIRED: "Vencido" };

export function ReviewPanel({ initial }: { initial: Detail }) {
  const [d, setD] = useState(initial);
  const [pending, setPending] = useState<Pending>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "danger" | "success"; text: string } | null>(null);
  const cnhExpired = d.cnh?.expiresAt ? new Date(d.cnh.expiresAt) < new Date() : true;

  async function reload() {
    const res = await fetch(location.pathname.replace("/admin/cadastros/", "/api/customers/") + "/detail");
    if (res.ok) setD(await res.json());
  }

  async function confirm() {
    if (!pending) return;
    setBusy(true);
    setMessage(null);
    const url = pending.kind === "account" ? `/api/customers/${d.customer.id}/approve` : `/api/documents/${pending.docId}/review`;
    const body = pending.kind === "account" ? undefined : JSON.stringify(pending.kind === "approve" ? { decision: "APPROVE" } : { decision: "REJECT", reason });
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body }).catch(() => null);
    const json = await res?.json().catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      setMessage({ tone: "danger", text: json?.error?.fields?.reason ?? json?.error?.message ?? "Não foi possível concluir. Tente novamente." });
      setPending(null);
      return;
    }
    setMessage({ tone: "success", text: pending.kind === "account" ? "Conta liberada. O cliente foi avisado." : pending.kind === "approve" ? "Documento aprovado." : "Documento recusado. O cliente foi avisado com o motivo." });
    setPending(null);
    setReason("");
    await reload();
  }

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div className="stack" style={{ gap: 4 }}>
          <span className="eyebrow">Análise de cadastro</span>
          <h1 style={{ fontSize: "clamp(22px, 5vw, 30px)" }}>{d.customer.fullName}</h1>
        </div>
        <ButtonLink href="/admin/cadastros" variant="ghost">Voltar à fila</ButtonLink>
      </div>
      {message && <Alert tone={message.tone}>{message.text}</Alert>}
      {d.account.status === "ACTIVE" && <Alert tone="success">Conta ativa.</Alert>}

      <div className="detail" style={{ padding: 0 }}>
        <section className="stack" style={{ gap: 12 }}>
          <h2 style={{ fontSize: 18 }}>Documentos</h2>
          {d.documents.length === 0 && <p className="muted">Nenhum documento enviado.</p>}
          {d.documents.map((doc) => (
            <article key={doc.id} className="card" style={{ overflow: "hidden" }}>
              <a href={`/api/documents/${doc.id}/file`} target="_blank" rel="noreferrer" style={{ display: "block", background: "var(--fc-black-950)" }} aria-label={`Abrir ${doc.label} em tamanho real`}>
                {doc.mimeType.startsWith("image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/documents/${doc.id}/file`} alt={doc.label} style={{ width: "100%", maxHeight: 360, objectFit: "contain" }} />
                ) : (
                  <div style={{ padding: 32, textAlign: "center" }}>Abrir PDF</div>
                )}
              </a>
              <div className="stack" style={{ gap: 10, padding: 16 }}>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <strong>{doc.label}{doc.required ? "" : " (opcional)"}</strong>
                  <Badge tone={TONE[doc.status] ?? "neutral"}>{LABEL[doc.status] ?? doc.status}</Badge>
                </div>
                <span className="muted" style={{ fontSize: 13 }}>Enviado em {formatDate(doc.submittedAt)}</span>
                {doc.rejectionReason && <span style={{ fontSize: 14, color: "#f09a97" }}>Motivo: {doc.rejectionReason}</span>}
                {(doc.status === "UNDER_REVIEW" || doc.status === "PENDING") && (
                  <div className="row">
                    <Button onClick={() => setPending({ kind: "approve", docId: doc.id, label: doc.label })}>Aprovar</Button>
                    <Button variant="secondary" onClick={() => setPending({ kind: "reject", docId: doc.id, label: doc.label })}>Recusar</Button>
                  </div>
                )}
              </div>
            </article>
          ))}
        </section>

        <aside className="card card-pad stack summary" style={{ gap: 16 }}>
          <h2 style={{ fontSize: 18 }}>Dados informados</h2>
          <dl>
            <dt>CPF</dt><dd>{d.customer.cpf ? maskCpfInput(d.customer.cpf) : "—"}</dd>
            <dt>Nascimento</dt><dd>{d.customer.birthDate?.split("-").reverse().join("/") ?? "—"}</dd>
            <dt>Celular</dt><dd>{d.customer.phone ? maskPhone(d.customer.phone) : "—"}</dd>
            <dt>WhatsApp</dt><dd>{d.customer.whatsapp ? maskPhone(d.customer.whatsapp) : "—"}</dd>
            <dt>E-mail</dt><dd>{d.customer.email}{d.account.emailVerified ? " · confirmado" : " · não confirmado"}</dd>
            <dt>Endereço</dt><dd>{d.customer.address}</dd>
            <dt>CNH</dt><dd>{d.cnh ? `${d.cnh.number} · ${d.cnh.categories}` : "—"}</dd>
            <dt>Validade CNH</dt><dd style={cnhExpired ? { color: "#f09a97" } : undefined}>{d.cnh?.expiresAt?.split("-").reverse().join("/") ?? "—"}{cnhExpired ? " (vencida)" : ""}</dd>
          </dl>
          <p className="muted" style={{ margin: 0, fontSize: 14 }}>Confira se nome, CPF e CNH conferem com as fotos e se a selfie corresponde à CNH.</p>
          {d.account.status === "UNDER_REVIEW" && (
            <Button size="lg" block disabled={!d.progress.allRequiredApproved || cnhExpired} onClick={() => setPending({ kind: "account" })}>
              Liberar conta
            </Button>
          )}
          {d.account.status === "UNDER_REVIEW" && !d.progress.allRequiredApproved && (
            <span className="muted" style={{ fontSize: 13 }}>Aprove todos os documentos obrigatórios para liberar.</span>
          )}
        </aside>
      </div>

      <ConfirmDialog
        open={pending !== null}
        title={pending?.kind === "account" ? `Liberar a conta de ${d.customer.fullName}?` : pending?.kind === "approve" ? `Aprovar ${pending.label}?` : pending?.kind === "reject" ? `Recusar ${pending.label}?` : ""}
        confirmLabel={pending?.kind === "reject" ? "Recusar documento" : pending?.kind === "account" ? "Liberar conta" : "Aprovar documento"}
        tone={pending?.kind === "reject" ? "danger" : "primary"}
        busy={busy}
        confirmDisabled={pending?.kind === "reject" && reason.trim().length < 5}
        onConfirm={confirm}
        onCancel={() => { setPending(null); setReason(""); }}
      >
        {pending?.kind === "reject" && (
          <div className="field">
            <label htmlFor="reason">Motivo (o cliente verá esta mensagem)</label>
            <textarea id="reason" className="input" rows={3} style={{ padding: 12 }} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: foto sem nitidez, envie outra." />
          </div>
        )}
        {pending?.kind === "account" && <p className="muted" style={{ margin: 0 }}>O cliente poderá reservar, alugar e pagar a partir de agora.</p>}
        {pending?.kind === "approve" && <p className="muted" style={{ margin: 0 }}>Confirme que o documento está legível e confere com os dados informados.</p>}
      </ConfirmDialog>
    </div>
  );
}

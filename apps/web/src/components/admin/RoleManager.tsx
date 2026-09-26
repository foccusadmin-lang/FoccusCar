"use client";

import type { Role } from "@foccus/core";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "../ui/Alert";
import { ConfirmDialog } from "../ui/ConfirmDialog";

type RoleRow = { role: Role; label: string; active: boolean; editable: boolean };

const DESCRIPTIONS: Record<Role, string> = {
  CLIENTE: "Reserva e aluga veículos. Base de toda conta.",
  REPRESENTANTE: "Publica ofertas com margem e acompanha ganhos.",
  OPERADOR: "Frota, reservas, locações, checklists e análise de cadastros.",
  FINANCEIRO: "Receitas, despesas, pagamentos, estornos e conciliação.",
  GERENTE: "Operação completa, frota, relatórios e consulta de usuários.",
  ADMIN: "Controle total, inclusive perfis e configurações.",
};

/** Concessão e retirada de perfis com confirmação e motivo (seções 17, 80 e 104). */
export function RoleManager({ userId, roles, isSelf }: { userId: string; roles: RoleRow[]; isSelf: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState<RoleRow | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "danger" | "success"; text: string } | null>(null);

  async function confirm() {
    if (!pending) return;
    setBusy(true);
    setMessage(null);
    const action = pending.active ? "REVOKE" : "GRANT";
    const res = await fetch(`/api/users/${userId}/roles`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: pending.role, action, reason }) }).catch(() => null);
    const json = await res?.json().catch(() => null);
    setBusy(false);
    const label = pending.label;
    setPending(null);
    setReason("");
    if (!res?.ok) return setMessage({ tone: "danger", text: json?.error?.fields?.reason ?? json?.error?.message ?? "Sem conexão. Tente novamente." });
    setMessage({ tone: "success", text: action === "GRANT" ? `Perfil ${label} concedido. A pessoa foi avisada.` : `Perfil ${label} retirado.` });
    router.refresh();
  }

  return (
    <section className="stack" style={{ gap: 12 }} aria-labelledby="perfis-h">
      <h2 id="perfis-h" style={{ fontSize: 18 }}>Perfis nesta empresa</h2>
      {isSelf && <Alert>Você não pode alterar os seus próprios perfis. Peça a outro administrador.</Alert>}
      {message && <Alert tone={message.tone}>{message.text}</Alert>}
      <ul className="stack" style={{ listStyle: "none", margin: 0, padding: 0, gap: 8 }}>
        {roles.map((r) => (
          <li key={r.role} className="card row" style={{ padding: 14, justifyContent: "space-between" }}>
            <div className="stack" style={{ gap: 2, flex: "1 1 220px" }}>
              <strong>{r.label}{r.active && <span className="badge success" style={{ marginLeft: 8 }}>Ativo</span>}</strong>
              <span className="muted" style={{ fontSize: 14 }}>{DESCRIPTIONS[r.role]}</span>
            </div>
            {r.editable && (
              <button type="button" className={r.active ? "btn btn-ghost" : "btn btn-secondary"} onClick={() => setPending(r)} disabled={busy}>
                {r.active ? "Retirar" : "Conceder"}
              </button>
            )}
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={Boolean(pending)}
        title={pending ? `${pending.active ? "Retirar" : "Conceder"} perfil ${pending.label}?` : ""}
        confirmLabel={pending?.active ? "Retirar perfil" : "Conceder perfil"}
        tone={pending?.active || pending?.role === "ADMIN" ? "danger" : "primary"}
        busy={busy}
        confirmDisabled={reason.trim().length < 5}
        onCancel={() => { setPending(null); setReason(""); }}
        onConfirm={confirm}
      >
        {pending && <p style={{ margin: 0 }}>{DESCRIPTIONS[pending.role]} A mudança vale a partir do próximo acesso da pessoa e fica registrada na auditoria.</p>}
        <div className="field">
          <label htmlFor="role-reason">Motivo</label>
          <textarea id="role-reason" className="input" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="Ex.: contratado como operador da loja central" />
        </div>
      </ConfirmDialog>
    </section>
  );
}

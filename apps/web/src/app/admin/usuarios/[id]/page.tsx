import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ServiceError, getMember, listAuditLogs } from "@foccus/services";
import { RoleManager } from "@/components/admin/RoleManager";
import { ACCOUNT_STATUS_LABEL, formatDate, formatDateTime } from "@/lib/format";
import { requirePagePermission } from "@/server/guard";
import { deps } from "@/server/services";

export const metadata: Metadata = { title: "Usuário" };

export default async function UserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requirePagePermission("users:view", `/admin/usuarios/${id}`);
  const m = await getMember(deps, ctx, id).catch((e) => (e instanceof ServiceError && e.status === 404 ? null : Promise.reject(e)));
  if (!m) notFound();
  const history = ctx.permissions.has("audit:view") ? (await listAuditLogs(deps, ctx, { entidade: "users", registro: id, acao: "user.role" })).items : [];

  return (
    <div className="stack" style={{ gap: 20, maxWidth: 900 }}>
      <div className="page-head">
        <div className="stack" style={{ gap: 6 }}>
          <Link href="/admin/usuarios" className="muted" style={{ fontSize: 14 }}>‹ Usuários</Link>
          <h1>{m.user.name}</h1>
          <span className="muted" style={{ wordBreak: "break-all" }}>{m.user.email}</span>
        </div>
      </div>
      <div className="spec-grid">
        <div className="spec"><span>Conta</span>{ACCOUNT_STATUS_LABEL[m.user.status] ?? m.user.status}</div>
        <div className="spec"><span>Criada em</span>{formatDate(m.user.createdAt)}</div>
        <div className="spec"><span>Cadastro de cliente</span>{m.customerId ? <Link href={`/admin/cadastros/${m.customerId}`} style={{ color: "var(--fc-accent)" }}>Ver cadastro</Link> : "Não preenchido"}</div>
      </div>
      <RoleManager userId={m.user.id} roles={m.roles} isSelf={m.isSelf} />
      {history.length > 0 && (
        <section className="stack" style={{ gap: 10 }}>
          <h2 style={{ fontSize: 18 }}>Histórico de perfis</h2>
          <ol className="timeline">
            {history.map((h) => {
              const nv = h.newValue as { role?: string; reason?: string } | null;
              return (
                <li key={h.id} className="stack" style={{ gap: 2 }}>
                  <span>{h.actionLabel}: <strong>{nv?.role}</strong></span>
                  <span className="meta">{formatDateTime(h.at)} · por {h.actor}{nv?.reason ? ` · motivo: ${nv.reason}` : ""}</span>
                </li>
              );
            })}
          </ol>
        </section>
      )}
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { getAdminDashboard } from "@foccus/services";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCents, formatDateTime } from "@/lib/format";
import { redirect } from "next/navigation";
import { canAccessAdmin } from "@foccus/core";
import { getAccess } from "@/server/auth";
import { deps } from "@/server/services";

export const metadata: Metadata = { title: "Painel" };

const TONE_CLASS = { danger: "danger", warning: "warning", info: "" } as const;

/** Dashboard administrativo (seção 69): cada bloco aparece conforme a permissão do perfil. */
export default async function AdminDashboardPage() {
  // Layout e página renderizam em paralelo: a página também confere o acesso antes de buscar dados.
  const ctx = await getAccess();
  if (!ctx) redirect("/entrar?next=/admin");
  if (!canAccessAdmin(ctx.permissions) && !ctx.permissions.has("customers:documents.review")) redirect("/");
  const d = await getAdminDashboard(deps, ctx);
  const c = d.fleet?.counts ?? {};

  return (
    <div className="stack" style={{ gap: 24 }}>
      <div className="page-head">
        <div className="stack" style={{ gap: 4 }}>
          <span className="eyebrow">Dashboard</span>
          <h1>Visão geral da operação</h1>
        </div>
        <span className="muted" style={{ fontSize: 13 }}>Atualizado em {formatDateTime(d.generatedAt)}</span>
      </div>

      {d.fleet && (
        <section className="stack" style={{ gap: 12 }} aria-labelledby="frota-h">
          <h2 id="frota-h" style={{ fontSize: 18 }}>Frota</h2>
          <div className="kpi-grid">
            <Link href="/admin/veiculos?status=AVAILABLE" className="card kpi"><span>Disponíveis</span><strong>{c.AVAILABLE ?? 0}</strong><small>de {d.fleet.total} veículos</small></Link>
            <Link href="/admin/veiculos?status=RENTED" className="card kpi"><span>Alugados</span><strong>{c.RENTED ?? 0}</strong><small>{c.RESERVED ?? 0} reservados</small></Link>
            <Link href="/admin/veiculos?status=MAINTENANCE" className="card kpi"><span>Manutenção</span><strong>{c.MAINTENANCE ?? 0}</strong><small>{(c.CLEANING ?? 0) + (c.INSPECTION ?? 0)} em preparação/inspeção</small></Link>
            <div className="card kpi">
              <span>Ocupação</span><strong>{d.fleet.occupancy}%</strong>
              <div className="bar" role="img" aria-label={`Ocupação da frota ${d.fleet.occupancy}%`}><i style={{ width: `${d.fleet.occupancy}%` }} /></div>
            </div>
          </div>
        </section>
      )}

      {(d.operations || d.customers) && (
        <section className="stack" style={{ gap: 12 }} aria-labelledby="op-h">
          <h2 id="op-h" style={{ fontSize: 18 }}>Operação</h2>
          <div className="kpi-grid">
            {d.operations && <>
              <div className="card kpi"><span>Reservas futuras</span><strong>{d.operations.reservationsUpcoming}</strong><small>pendentes e confirmadas</small></div>
              <div className="card kpi"><span>Locações ativas</span><strong>{d.operations.rentalsActive}</strong><small>{d.operations.rentalsLate} com atraso</small></div>
            </>}
            {d.customers && <Link href="/admin/cadastros" className="card kpi"><span>Cadastros</span><strong>{d.customers.underReview}</strong><small>aguardando análise</small></Link>}
          </div>
        </section>
      )}

      {d.finance && (
        <section className="stack" style={{ gap: 12 }} aria-labelledby="fin-h">
          <h2 id="fin-h" style={{ fontSize: 18 }}>Financeiro do mês</h2>
          <div className="kpi-grid">
            <div className="card kpi"><span>Receitas</span><strong>{formatCents(d.finance.incomeCents)}</strong><small>confirmadas</small></div>
            <div className="card kpi"><span>Despesas</span><strong>{formatCents(d.finance.expenseCents)}</strong><small>confirmadas</small></div>
            <div className="card kpi"><span>Resultado</span><strong style={{ color: d.finance.resultCents < 0 ? "#f09a97" : undefined }}>{formatCents(d.finance.resultCents)}</strong><small>receitas − despesas</small></div>
            <div className="card kpi"><span>Pagamentos</span><strong>{d.finance.pendingPayments}</strong><small>{d.finance.overduePayments} vencidos</small></div>
          </div>
        </section>
      )}

      <section className="stack" style={{ gap: 12 }} aria-labelledby="alertas-h">
        <h2 id="alertas-h" style={{ fontSize: 18 }}>Alertas</h2>
        {d.alerts.length === 0 ? (
          <EmptyState title="Nenhum alerta agora" description="Documentos em dia, sem bloqueios e sem pendências de análise." />
        ) : (
          <ul className="stack" style={{ listStyle: "none", margin: 0, padding: 0, gap: 8 }}>
            {d.alerts.map((a) => (
              <li key={a.title}>
                <Link href={a.href} className={`alert ${TONE_CLASS[a.tone]}`} style={{ justifyContent: "space-between", alignItems: "center" }}>
                  <div className="stack" style={{ gap: 2 }}><strong>{a.title}</strong><span className="muted" style={{ fontSize: 14 }}>{a.detail}</span></div>
                  <span aria-hidden>›</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

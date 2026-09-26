import type { Metadata } from "next";
import Link from "next/link";
import { listFleetDocumentAlerts } from "@foccus/services";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDate } from "@/lib/format";
import { requirePagePermission } from "@/server/guard";
import { deps } from "@/server/services";

export const metadata: Metadata = { title: "Documentos da frota" };

const WINDOWS = [30, 60, 90];

/** Documentos da frota vencidos ou a vencer (seção 74). */
export default async function FleetDocumentsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await requirePagePermission("vehicles:view", "/admin/documentos");
  const sp = await searchParams;
  const days = WINDOWS.includes(Number(sp.dias)) ? Number(sp.dias) : 30;
  const items = await listFleetDocumentAlerts(deps, ctx, days);
  const expired = items.filter((i) => i.state === "EXPIRED").length;

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="page-head">
        <div className="stack" style={{ gap: 4 }}>
          <span className="eyebrow">Documentos</span>
          <h1>Vencimentos da frota</h1>
          <p className="muted" style={{ margin: 0 }}>{expired} vencido(s) e {items.length - expired} a vencer em até {days} dias.</p>
        </div>
        <nav className="row" aria-label="Janela de vencimento" style={{ gap: 6 }}>
          {WINDOWS.map((w) => <Link key={w} href={`?dias=${w}`} className={w === days ? "btn btn-secondary" : "btn btn-ghost"} aria-current={w === days ? "true" : undefined}>{w} dias</Link>)}
        </nav>
      </div>
      {items.length === 0 ? (
        <EmptyState title="Tudo em dia" description={`Nenhum documento vencido ou vencendo nos próximos ${days} dias.`} />
      ) : (
        <div className="table-wrap"><table className="data-table">
          <thead><tr><th>Veículo</th><th>Documento</th><th>Vencimento</th><th>Situação</th></tr></thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id}>
                <td><Link className="row-link" href={`/admin/veiculos/${i.vehicleId}?aba=documentos`}>{i.vehicle}</Link><div className="muted" style={{ fontSize: 13 }}>{i.plate}</div></td>
                <td data-label="Documento">{i.label}</td>
                <td data-label="Vencimento">{formatDate(i.expiresAt)}</td>
                <td>{i.state === "EXPIRED" ? <Badge tone="danger">Vencido há {Math.abs(i.daysLeft ?? 0)} dia(s)</Badge> : <Badge tone="warning">Vence em {i.daysLeft} dia(s)</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
    </div>
  );
}

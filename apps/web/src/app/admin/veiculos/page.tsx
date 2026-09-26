import type { Metadata } from "next";
import Link from "next/link";
import { VEHICLE_STATUSES, VEHICLE_STATUS_LABELS } from "@foccus/core";
import { listVehicles, vehicleListFiltersSchema } from "@foccus/services";
import { VehicleStatusBadge } from "@/components/admin/VehicleStatusBadge";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCents, formatKm } from "@/lib/format";
import { vehicleImage } from "@/lib/vehicle-image";
import { requirePagePermission } from "@/server/guard";
import { deps } from "@/server/services";

export const metadata: Metadata = { title: "Veículos" };

type SP = Promise<Record<string, string | undefined>>;

export default async function FleetPage({ searchParams }: { searchParams: SP }) {
  const ctx = await requirePagePermission("vehicles:view", "/admin/veiculos");
  const sp = await searchParams;
  const parsed = vehicleListFiltersSchema.safeParse({ q: sp.q || undefined, status: sp.status || undefined, categoria: sp.categoria || undefined, pagina: sp.pagina || "1" });
  const filters = parsed.success ? parsed.data : vehicleListFiltersSchema.parse({});
  const data = await listVehicles(deps, ctx, filters);
  const canManage = ctx.permissions.has("vehicles:manage");
  const total = Object.values(data.counts).reduce((a, n) => a + (n ?? 0), 0);
  const qs = (p: number) => new URLSearchParams(Object.entries({ q: filters.q, status: filters.status, categoria: filters.categoria, pagina: String(p) }).filter(([, v]) => v) as [string, string][]).toString();
  const filtered = Boolean(filters.q || filters.status || filters.categoria);

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="page-head">
        <div className="stack" style={{ gap: 4 }}>
          <span className="eyebrow">Frota</span>
          <h1>Veículos</h1>
          <p className="muted" style={{ margin: 0 }}>{total} veículo(s) cadastrado(s)</p>
        </div>
        {canManage && <ButtonLink href="/admin/veiculos/novo">Cadastrar veículo</ButtonLink>}
      </div>

      <form className="card card-pad filters" method="get" role="search" aria-label="Filtrar veículos" style={{ padding: 16 }}>
        <div className="field" style={{ gridColumn: "span 2" }}>
          <label htmlFor="q">Buscar</label>
          <input id="q" name="q" className="input" defaultValue={filters.q} placeholder="Placa, marca ou modelo" />
        </div>
        <div className="field">
          <label htmlFor="status">Status</label>
          <select id="status" name="status" className="select" defaultValue={filters.status ?? ""}>
            <option value="">Todos</option>
            {VEHICLE_STATUSES.map((s) => <option key={s} value={s}>{VEHICLE_STATUS_LABELS[s]} ({data.counts[s] ?? 0})</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="categoria">Categoria</label>
          <select id="categoria" name="categoria" className="select" defaultValue={filters.categoria ?? ""}>
            <option value="">Todas</option>
            {data.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="row" style={{ alignItems: "end", gap: 8 }}>
          <button className="btn btn-secondary" type="submit">Filtrar</button>
          {filtered && <Link className="btn btn-ghost" href="/admin/veiculos">Limpar</Link>}
        </div>
      </form>

      {data.items.length === 0 ? (
        <EmptyState
          title={filtered ? "Nenhum veículo com estes filtros" : "Nenhum veículo cadastrado"}
          description={filtered ? "Ajuste a busca ou limpe os filtros." : "Cadastre o primeiro veículo para começar a montar a frota."}
          action={!filtered && canManage ? <ButtonLink href="/admin/veiculos/novo">Cadastrar veículo</ButtonLink> : undefined}
        />
      ) : (
        <div className="table-wrap"><table className="data-table">
          <thead>
            <tr><th className="hide-sm" aria-label="Foto" /><th>Veículo</th><th>Placa</th><th>Status</th><th>KM</th><th>Diária</th><th>Alertas</th></tr>
          </thead>
          <tbody>
            {data.items.map((v) => (
              <tr key={v.id}>
                <td className="hide-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="thumb-sm" src={vehicleImage(v.coverPhotoId ? `/api/vehicle-photos/${v.coverPhotoId}` : null, v.color)} alt="" loading="lazy" />
                </td>
                <td>
                  <Link className="row-link" href={`/admin/veiculos/${v.id}`}>{v.brand} {v.model} {v.modelYear}</Link>
                  <div className="muted" style={{ fontSize: 13 }}>{[v.version, v.category, v.location].filter(Boolean).join(" · ")}</div>
                </td>
                <td data-label="Placa"><strong style={{ letterSpacing: "0.06em" }}>{v.plate}</strong></td>
                <td><VehicleStatusBadge status={v.status} /></td>
                <td data-label="KM">{formatKm(v.currentKm)}</td>
                <td data-label="Diária">{formatCents(v.dailyRateCents)}</td>
                <td>
                  <div className="row" style={{ gap: 6 }}>
                    {v.documentAlert === "EXPIRED" && <Badge tone="danger">Documento vencido</Badge>}
                    {v.documentAlert === "EXPIRING" && <Badge tone="warning">Documento vencendo</Badge>}
                    {!v.showcaseVisible && <Badge plain>Fora da vitrine</Badge>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}

      {(data.page > 1 || data.hasMore) && (
        <nav className="row" aria-label="Paginação" style={{ justifyContent: "center" }}>
          {data.page > 1 && <Link className="btn btn-secondary" href={`?${qs(data.page - 1)}`}>Anterior</Link>}
          <span className="muted">Página {data.page}</span>
          {data.hasMore && <Link className="btn btn-secondary" href={`?${qs(data.page + 1)}`}>Próxima</Link>}
        </nav>
      )}
    </div>
  );
}

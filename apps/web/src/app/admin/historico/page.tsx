import type { Metadata } from "next";
import Link from "next/link";
import { auditFiltersSchema, listAuditLogs } from "@foccus/services";
import { AuditDetails } from "@/components/admin/AuditDetails";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDateTime } from "@/lib/format";
import { requirePagePermission } from "@/server/guard";
import { deps } from "@/server/services";

export const metadata: Metadata = { title: "Histórico e auditoria" };

const ENTITY_LABEL: Record<string, string> = {
  vehicles: "Veículos", vehicle_photos: "Fotos de veículos", vehicle_documents: "Documentos da frota", users: "Usuários",
  customers: "Clientes", customer_documents: "Documentos de clientes", vehicle_categories: "Categorias", locations: "Localizações",
};

/** Trilha de auditoria (seção 80): quem fez, o quê, quando, em qual registro, valor anterior e novo. */
export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await requirePagePermission("audit:view", "/admin/historico");
  const sp = await searchParams;
  const parsed = auditFiltersSchema.safeParse({ entidade: sp.entidade || undefined, de: sp.de || undefined, ate: sp.ate || undefined, antes: sp.antes || undefined, registro: sp.registro || undefined });
  const filters = parsed.success ? parsed.data : {};
  const data = await listAuditLogs(deps, ctx, filters);
  const next = new URLSearchParams(Object.entries({ entidade: sp.entidade, de: sp.de, ate: sp.ate, registro: sp.registro, antes: data.nextCursor ? String(data.nextCursor) : undefined }).filter(([, v]) => v) as [string, string][]);

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="page-head">
        <div className="stack" style={{ gap: 4 }}>
          <span className="eyebrow">Histórico</span>
          <h1>Auditoria</h1>
          <p className="muted" style={{ margin: 0 }}>Registro permanente das ações importantes. Nada aqui pode ser alterado ou apagado.</p>
        </div>
      </div>
      <form className="card filters" method="get" style={{ padding: 16 }}>
        <div className="field">
          <label htmlFor="entidade">Área</label>
          <select id="entidade" name="entidade" className="select" defaultValue={sp.entidade ?? ""}>
            <option value="">Todas</option>
            {data.entities.map((e) => <option key={e} value={e}>{ENTITY_LABEL[e] ?? e}</option>)}
          </select>
        </div>
        <div className="field"><label htmlFor="de">De</label><input id="de" name="de" type="date" className="input" defaultValue={sp.de} /></div>
        <div className="field"><label htmlFor="ate">Até</label><input id="ate" name="ate" type="date" className="input" defaultValue={sp.ate} /></div>
        <div className="row" style={{ alignItems: "end", gap: 8 }}>
          <button className="btn btn-secondary" type="submit">Filtrar</button>
          {(sp.entidade || sp.de || sp.ate || sp.registro) && <Link className="btn btn-ghost" href="/admin/historico">Limpar</Link>}
        </div>
      </form>
      {data.items.length === 0 ? (
        <EmptyState title="Nenhum registro" description="Nenhuma ação encontrada para estes filtros." />
      ) : (
        <div className="table-wrap"><table className="data-table">
          <thead><tr><th>Quando</th><th>Quem</th><th>Ação</th><th>Área</th><th>Detalhes</th></tr></thead>
          <tbody>
            {data.items.map((a) => (
              <tr key={a.id}>
                <td data-label="Quando" style={{ whiteSpace: "nowrap" }}>{formatDateTime(a.at)}</td>
                <td data-label="Quem">{a.actor}</td>
                <td><strong>{a.actionLabel}</strong></td>
                <td data-label="Área">{ENTITY_LABEL[a.entity] ?? a.entity}</td>
                <td><AuditDetails oldValue={a.oldValue} newValue={a.newValue} ip={a.ip} entityId={a.entityId} /></td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
      {data.nextCursor && <div style={{ textAlign: "center" }}><Link className="btn btn-secondary" href={`?${next}`}>Registros anteriores</Link></div>}
    </div>
  );
}

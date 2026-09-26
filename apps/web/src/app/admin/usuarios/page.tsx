import type { Metadata } from "next";
import Link from "next/link";
import { ROLES, ROLE_LABELS } from "@foccus/core";
import { listMembers, memberFiltersSchema } from "@foccus/services";
import { UserLookup } from "@/components/admin/UserLookup";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ACCOUNT_STATUS_LABEL } from "@/lib/format";
import { requirePagePermission } from "@/server/guard";
import { deps } from "@/server/services";

export const metadata: Metadata = { title: "Usuários" };

export default async function UsersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await requirePagePermission("users:view", "/admin/usuarios");
  const sp = await searchParams;
  const parsed = memberFiltersSchema.safeParse({ q: sp.q || undefined, perfil: sp.perfil || undefined, pagina: sp.pagina || "1" });
  const filters = parsed.success ? parsed.data : memberFiltersSchema.parse({});
  const data = await listMembers(deps, ctx, filters);
  const qs = (p: number) => new URLSearchParams(Object.entries({ q: filters.q, perfil: filters.perfil, pagina: String(p) }).filter(([, v]) => v) as [string, string][]).toString();

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="page-head">
        <div className="stack" style={{ gap: 4 }}>
          <span className="eyebrow">Usuários</span>
          <h1>Usuários e perfis</h1>
          <p className="muted" style={{ margin: 0 }}>Toda conta nasce como Cliente. Perfis internos só são concedidos aqui, com motivo registrado.</p>
        </div>
      </div>
      {ctx.permissions.has("users:roles.assign") && <UserLookup />}
      <form className="card filters" method="get" role="search" style={{ padding: 16 }}>
        <div className="field" style={{ gridColumn: "span 2" }}>
          <label htmlFor="q">Buscar</label>
          <input id="q" name="q" className="input" defaultValue={filters.q} placeholder="Nome ou e-mail" />
        </div>
        <div className="field">
          <label htmlFor="perfil">Perfil</label>
          <select id="perfil" name="perfil" className="select" defaultValue={filters.perfil ?? ""}>
            <option value="">Todos</option>
            {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
        </div>
        <div className="row" style={{ alignItems: "end" }}><button className="btn btn-secondary" type="submit">Filtrar</button></div>
      </form>
      {data.items.length === 0 ? (
        <EmptyState title="Nenhum usuário encontrado" description="Ajuste a busca ou o filtro de perfil." />
      ) : (
        <div className="table-wrap"><table className="data-table">
          <thead><tr><th>Nome</th><th>E-mail</th><th>Perfis</th><th>Conta</th></tr></thead>
          <tbody>
            {data.items.map((u) => (
              <tr key={u.id}>
                <td><Link className="row-link" href={`/admin/usuarios/${u.id}`}>{u.name}</Link></td>
                <td data-label="E-mail" style={{ wordBreak: "break-all" }}>{u.email}</td>
                <td><div className="row" style={{ gap: 6 }}>{u.roles.map((r) => <Badge key={r} tone={r === "ADMIN" ? "gold" : r === "CLIENTE" ? "neutral" : "info"} plain>{ROLE_LABELS[r]}</Badge>)}</div></td>
                <td data-label="Conta">{ACCOUNT_STATUS_LABEL[u.status] ?? u.status}</td>
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

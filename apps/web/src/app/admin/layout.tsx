import { canAccessAdmin, type Permission } from "@foccus/core";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AdminNav, type NavItem } from "@/components/admin/AdminNav";
import { getAccess } from "@/server/auth";

export const dynamic = "force-dynamic";

/** Módulos da seção 92, na ordem da especificação. `soon` = etapa do plano em que chegam. */
const MODULES: (NavItem & { permission?: Permission })[] = [
  { label: "Dashboard", href: "/admin" },
  { label: "Monitoramento", soon: 9, permission: "gps:view" },
  { label: "Veículos", href: "/admin/veiculos", permission: "vehicles:view" },
  { label: "Clientes", href: "/admin/cadastros", permission: "customers:documents.review" },
  { label: "Reservas", soon: 4, permission: "reservations:view" },
  { label: "Locações", soon: 5, permission: "rentals:view" },
  { label: "Checklists", soon: 5, permission: "checklists:execute" },
  { label: "Manutenção", soon: 6, permission: "maintenance:view" },
  { label: "Segurança", soon: 9, permission: "security:alerts.manage" },
  { label: "Ocorrências", soon: 6, permission: "occurrences:manage" },
  { label: "Multas", soon: 6, permission: "fines:manage" },
  { label: "Financeiro", soon: 7, permission: "finance:view" },
  { label: "Documentos", href: "/admin/documentos", permission: "vehicles:view" },
  { label: "Relatórios", soon: 11, permission: "reports:view" },
  { label: "Histórico", href: "/admin/historico", permission: "audit:view" },
  { label: "Usuários", href: "/admin/usuarios", permission: "users:view" },
  { label: "Configurações", href: "/admin/configuracoes", permission: "vehicles:manage" },
];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const ctx = await getAccess();
  if (!ctx) redirect("/entrar?next=/admin");
  if (!canAccessAdmin(ctx.permissions) && !ctx.permissions.has("customers:documents.review")) redirect("/");
  const items = MODULES.filter((m) => !m.permission || ctx.permissions.has(m.permission)).map(({ label, href, soon }) => ({ label, href, soon }));
  return (
    <div className="admin-shell">
      <AdminNav items={items} />
      <div className="admin-content">{children}</div>
    </div>
  );
}

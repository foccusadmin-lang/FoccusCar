import type { Permission } from "@foccus/core";
import type { IconName } from "@/components/shell/Icon";

/**
 * Menus das três áreas logadas (seções 92, 93 e 94).
 * `permission` só esconde o item; cada página e cada API continuam verificando no servidor (seção 95).
 * `mobile` marca os itens da barra inferior no celular; o resto fica no menu "Mais".
 */
export type NavItem = { href: string; label: string; icon: IconName; permission?: Permission; mobile?: boolean };
export type NavGroup = { label?: string; items: NavItem[] };
export type AreaNav = { area: "cliente" | "representante" | "equipe"; title: string; home: string; groups: NavGroup[] };

export const CLIENT_NAV: AreaNav = {
  area: "cliente",
  title: "Minha conta",
  home: "/conta",
  groups: [
    {
      items: [
        { href: "/conta", label: "Início", icon: "home", mobile: true },
        { href: "/", label: "Veículos", icon: "car", mobile: true },
        { href: "/conta/reservas", label: "Minhas Reservas", icon: "calendar", mobile: true },
        { href: "/conta/locacoes", label: "Minhas Locações", icon: "key", mobile: true },
        { href: "/conta/pagamentos", label: "Pagamentos", icon: "card" },
        { href: "/conta/documentos", label: "Documentos", icon: "idcard" },
        { href: "/conta/contratos", label: "Contratos", icon: "contract" },
        { href: "/conta/notificacoes", label: "Notificações", icon: "bell" },
        { href: "/cadastro", label: "Meu Perfil", icon: "user" },
      ],
    },
  ],
};

export const REPRESENTATIVE_NAV: AreaNav = {
  area: "representante",
  title: "Representante",
  home: "/representante",
  groups: [
    {
      items: [
        { href: "/representante", label: "Dashboard", icon: "dashboard", mobile: true },
        { href: "/representante/veiculos", label: "Veículos", icon: "car", mobile: true },
        { href: "/representante/ofertas", label: "Minhas Ofertas", icon: "tag", mobile: true },
        { href: "/representante/clientes", label: "Clientes", icon: "users" },
        { href: "/representante/reservas", label: "Reservas", icon: "calendar" },
        { href: "/representante/locacoes", label: "Locações", icon: "key" },
      ],
    },
    {
      label: "Ganhos",
      items: [
        { href: "/representante/ganhos", label: "Ganhos", icon: "trending" },
        { href: "/representante/carteira", label: "Carteira", icon: "wallet", mobile: true },
        { href: "/representante/saques", label: "Saques", icon: "withdraw" },
        { href: "/representante/invest", label: "Foccus Invest", icon: "chart" },
        { href: "/representante/perfil", label: "Perfil", icon: "user" },
      ],
    },
  ],
};

export const STAFF_NAV: AreaNav = {
  area: "equipe",
  title: "Painel da locadora",
  home: "/admin",
  groups: [
    {
      items: [
        { href: "/admin", label: "Dashboard", icon: "dashboard", mobile: true },
        { href: "/admin/monitoramento", label: "Monitoramento", icon: "map", permission: "gps:view", mobile: true },
      ],
    },
    {
      label: "Operação",
      items: [
        { href: "/admin/veiculos", label: "Veículos", icon: "car", permission: "vehicles:view", mobile: true },
        { href: "/admin/clientes", label: "Clientes", icon: "users", permission: "customers:view" },
        { href: "/admin/cadastros", label: "Análise de cadastros", icon: "idcard", permission: "customers:documents.review" },
        { href: "/admin/reservas", label: "Reservas", icon: "calendar", permission: "reservations:view" },
        { href: "/admin/locacoes", label: "Locações", icon: "key", permission: "rentals:view", mobile: true },
        { href: "/admin/checklists", label: "Checklists", icon: "checklist", permission: "checklists:execute" },
        { href: "/admin/manutencao", label: "Manutenção", icon: "wrench", permission: "maintenance:view" },
      ],
    },
    {
      label: "Controle",
      items: [
        { href: "/admin/seguranca", label: "Segurança", icon: "shield", permission: "security:alerts.manage" },
        { href: "/admin/ocorrencias", label: "Ocorrências", icon: "alert", permission: "occurrences:manage" },
        { href: "/admin/multas", label: "Multas", icon: "ticket", permission: "fines:manage" },
        { href: "/admin/financeiro", label: "Financeiro", icon: "money", permission: "finance:view" },
        { href: "/admin/representantes", label: "Representantes", icon: "tag", permission: "representatives:manage" },
        { href: "/admin/documentos", label: "Documentos", icon: "file", permission: "vehicles:view" },
      ],
    },
    {
      label: "Gestão",
      items: [
        { href: "/admin/relatorios", label: "Relatórios", icon: "chart", permission: "reports:view" },
        { href: "/admin/historico", label: "Histórico", icon: "history", permission: "audit:view" },
        { href: "/admin/usuarios", label: "Usuários", icon: "user", permission: "users:view" },
        { href: "/admin/configuracoes", label: "Configurações", icon: "settings", permission: "settings:manage" },
      ],
    },
  ],
};

/** Permissões que caracterizam alguém da equipe da locadora (acesso ao painel). */
export const STAFF_ENTRY: Permission[] = ["customers:view", "vehicles:manage", "finance:view", "reservations:view"];

export function isStaff(permissions: ReadonlySet<Permission>) {
  return STAFF_ENTRY.some((p) => permissions.has(p));
}

export function isRepresentative(permissions: ReadonlySet<Permission>) {
  return permissions.has("representative:listings.manage");
}

/** Mantém só os itens que o perfil pode ver; grupos vazios somem. */
export function filterNav(nav: AreaNav, permissions: ReadonlySet<Permission>): AreaNav {
  return {
    ...nav,
    groups: nav.groups
      .map((g) => ({ ...g, items: g.items.filter((i) => !i.permission || permissions.has(i.permission)) }))
      .filter((g) => g.items.length > 0),
  };
}

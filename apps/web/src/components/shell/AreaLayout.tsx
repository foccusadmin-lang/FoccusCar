import "server-only";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { checkServiceAccess } from "@foccus/core";
import { CLIENT_NAV, REPRESENTATIVE_NAV, STAFF_NAV, filterNav, isRepresentative, isStaff, type AreaNav } from "@/lib/navigation";
import { getAccess, getSession } from "@/server/auth";
import { AppShell, type AreaLink } from "./AppShell";

const NAVS = { cliente: CLIENT_NAV, representante: REPRESENTATIVE_NAV, equipe: STAFF_NAV } satisfies Record<AreaNav["area"], AreaNav>;

/**
 * Layout de servidor das áreas logadas: confere login e perfil antes de desenhar
 * qualquer coisa e entrega ao menu só os itens permitidos.
 */
export async function AreaLayout({ area, children }: { area: AreaNav["area"]; children: ReactNode }) {
  const nav = NAVS[area];
  const session = await getSession();
  if (!session) redirect(`/entrar?next=${encodeURIComponent(nav.home)}`);
  const ctx = await getAccess();
  if (!ctx) redirect("/");

  const staff = isStaff(ctx.permissions);
  const representative = isRepresentative(ctx.permissions);
  const client = ctx.permissions.has("self:reservations.manage");

  if (area === "equipe" && !staff) redirect("/");
  if (area === "representante" && !representative) redirect("/");
  // Seção 18: sem cadastro liberado, a conta só navega pela vitrine e completa o cadastro.
  if (area === "cliente" && !checkServiceAccess(ctx.accountStatus).allowed) redirect("/cadastro");

  const areas: AreaLink[] = [];
  if (area !== "equipe" && staff) areas.push({ href: STAFF_NAV.home, label: STAFF_NAV.title, icon: "dashboard" });
  if (area !== "representante" && representative) areas.push({ href: REPRESENTATIVE_NAV.home, label: "Área do representante", icon: "tag" });
  if (area !== "cliente" && client) areas.push({ href: CLIENT_NAV.home, label: CLIENT_NAV.title, icon: "user" });

  return (
    <AppShell nav={filterNav(nav, ctx.permissions)} userName={session.user.name} areas={areas}>
      {children}
    </AppShell>
  );
}

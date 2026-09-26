"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import type { AreaNav, NavItem } from "@/lib/navigation";
import { Icon, type IconName } from "./Icon";
import "./shell.css";

export type AreaLink = { href: string; label: string; icon: IconName };

function isActive(pathname: string, item: NavItem, home: string) {
  if (item.href === pathname) return true;
  if (item.href === home || item.href === "/") return false;
  return pathname.startsWith(item.href + "/");
}

/**
 * Estrutura das áreas logadas (seção 8):
 * - desktop: menu lateral completo;
 * - tablet: menu lateral só com ícones;
 * - celular: barra inferior com as ações principais + menu "Mais" em gaveta.
 */
export function AppShell({ nav, userName, areas, children }: { nav: AreaNav; userName: string; areas: AreaLink[]; children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const all = nav.groups.flatMap((g) => g.items);
  const tabs = all.filter((i) => i.mobile).slice(0, 4);

  const menu = (
    <>
      <div className="app-nav-head">
        <span className="eyebrow">{nav.title}</span>
        <strong className="app-nav-user">{userName}</strong>
      </div>
      {nav.groups.map((g, gi) => (
        <div key={g.label ?? gi} className="app-nav-group">
          {g.label && <span className="app-nav-label">{g.label}</span>}
          <ul>
            {g.items.map((item) => {
              const active = isActive(pathname, item, nav.home);
              return (
                <li key={item.href}>
                  <Link href={item.href} className={active ? "app-nav-link active" : "app-nav-link"} aria-current={active ? "page" : undefined} title={item.label}>
                    <Icon name={item.icon} />
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      {areas.length > 0 && (
        <div className="app-nav-group app-nav-areas">
          <span className="app-nav-label">Outras áreas</span>
          <ul>
            {areas.map((a) => (
              <li key={a.href}>
                <Link href={a.href} className="app-nav-link" title={a.label}>
                  <Icon name={a.icon} />
                  <span>{a.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );

  return (
    <div className="app-shell">
      <aside className="app-sidebar" aria-label={`Menu: ${nav.title}`}>
        <nav>{menu}</nav>
      </aside>

      <div className="app-main">{children}</div>

      <nav className="app-tabbar" aria-label="Atalhos">
        {tabs.map((item) => {
          const active = isActive(pathname, item, nav.home);
          return (
            <Link key={item.href} href={item.href} className={active ? "active" : undefined} aria-current={active ? "page" : undefined}>
              <Icon name={item.icon} size={22} />
              <span>{item.label.replace(/^Minhas? /, "")}</span>
            </Link>
          );
        })}
        <button type="button" onClick={() => setOpen(true)} aria-expanded={open} aria-controls="app-drawer">
          <Icon name="menu" size={22} />
          <span>Mais</span>
        </button>
      </nav>

      {open && (
        <div className="dialog-backdrop" role="presentation" onClick={() => setOpen(false)}>
          <div id="app-drawer" className="app-drawer card" role="dialog" aria-modal="true" aria-label={`Menu: ${nav.title}`} onClick={(e) => e.stopPropagation()}>
            <button type="button" className="btn btn-ghost app-drawer-close" onClick={() => setOpen(false)} aria-label="Fechar menu">
              <Icon name="close" />
            </button>
            <nav>{menu}</nav>
          </div>
        </div>
      )}
    </div>
  );
}

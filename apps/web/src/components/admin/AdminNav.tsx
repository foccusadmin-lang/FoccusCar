"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export interface NavItem {
  label: string;
  href?: string;
  /** Etapa do plano em que o módulo chega; itens sem href aparecem como "em breve". */
  soon?: number;
}

function isActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Navegação administrativa (seção 92): sidebar fixa no computador,
 * gaveta no celular e no tablet em pé. Só aparecem os módulos que o perfil pode usar.
 */
export function AdminNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  const current = items.find((i) => i.href && isActive(pathname, i.href));

  return (
    <>
      <div className="admin-topbar">
        <button type="button" className="btn btn-secondary" onClick={() => setOpen(true)} aria-expanded={open} aria-controls="admin-sidebar">
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden><path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          Menu
        </button>
        <span className="muted" style={{ fontSize: 14 }}>{current?.label ?? "Painel"}</span>
      </div>
      {open && <div className="admin-scrim" onClick={() => setOpen(false)} aria-hidden />}
      <nav id="admin-sidebar" className={open ? "admin-sidebar open" : "admin-sidebar"} aria-label="Painel administrativo">
        <div className="row admin-sidebar-head" style={{ justifyContent: "space-between" }}>
          <span className="eyebrow">Painel</span>
          <button type="button" className="btn btn-ghost admin-close" onClick={() => setOpen(false)} aria-label="Fechar menu">✕</button>
        </div>
        <ul>
          {items.map((item) =>
            item.href ? (
              <li key={item.label}>
                <Link href={item.href} onClick={() => setOpen(false)} className={isActive(pathname, item.href) ? "active" : undefined} aria-current={isActive(pathname, item.href) ? "page" : undefined}>
                  {item.label}
                </Link>
              </li>
            ) : (
              <li key={item.label}>
                <span className="soon" aria-disabled title={`Chega na etapa ${item.soon}`}>
                  {item.label}
                  <small>em breve</small>
                </span>
              </li>
            ),
          )}
        </ul>
      </nav>
    </>
  );
}

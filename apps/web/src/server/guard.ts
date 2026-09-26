import "server-only";
import type { Permission } from "@foccus/core";
import { redirect } from "next/navigation";
import { getAccess } from "./auth";

/** Páginas internas: exige login e permissão; sem permissão, volta à vitrine. */
export async function requirePagePermission(permission: Permission, next: string) {
  const ctx = await getAccess();
  if (!ctx) redirect(`/entrar?next=${encodeURIComponent(next)}`);
  if (!ctx.permissions.has(permission)) redirect("/");
  return ctx;
}

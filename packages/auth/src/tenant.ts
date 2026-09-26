import { eq } from "drizzle-orm";
import { companies, type Database } from "@foccus/db";

/**
 * Descobre a empresa (tenant) pelo domínio acessado; cai na empresa padrão
 * (DEFAULT_COMPANY_SLUG) em desenvolvimento ou quando o domínio não está mapeado.
 * O tenant NUNCA vem de um parâmetro enviado pelo navegador.
 */
export async function resolveCompanyFromHost(db: Database, host: string | null | undefined) {
  const clean = host?.split(":")[0]?.toLowerCase();
  if (clean) {
    const [byDomain] = await db.select().from(companies).where(eq(companies.domain, clean));
    if (byDomain) return byDomain;
  }
  const slug = process.env.DEFAULT_COMPANY_SLUG ?? "foccus-car";
  const [fallback] = await db.select().from(companies).where(eq(companies.slug, slug));
  return fallback ?? null;
}

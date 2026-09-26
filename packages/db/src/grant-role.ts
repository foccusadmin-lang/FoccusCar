import { ROLES, type Role } from "@foccus/core";
import { eq } from "drizzle-orm";
import { createDb } from "./client";
import { grantRole } from "./bootstrap";
import { companies } from "./schema";

/**
 * CLI para o primeiro administrador: `pnpm --filter @foccus/db grant-role <slug> <email> ADMIN`.
 * Roda com credencial de banco de operador (não existe rota pública que faça isso).
 */
async function main() {
  const [slug, email, role] = process.argv.slice(2);
  if (!slug || !email || !role || !ROLES.includes(role as Role)) {
    console.error(`Uso: grant-role <empresa-slug> <email> <${ROLES.join("|")}>`);
    process.exit(1);
  }
  const db = createDb(process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL);
  const [company] = await db.select().from(companies).where(eq(companies.slug, slug));
  if (!company) throw new Error(`Empresa ${slug} não encontrada.`);
  const user = await grantRole(db, { companyId: company.id, email, role: role as Role });
  console.log(`${user.email} agora é ${role} em ${company.name}.`);
  await db.$client.end();
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});

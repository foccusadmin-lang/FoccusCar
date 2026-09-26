import { appDatabaseUrl, derivedAppRolePassword } from "@foccus/db";
import { runMigrations } from "@foccus/db/migrate";
import postgres from "postgres";
import { seedDemo } from "./seed";

/**
 * Build do ambiente de testes na Vercel (docs/AMBIENTE-DE-TESTES.md), antes do `next build`:
 * 1. cria/atualiza o papel `foccus_app` (sem superusuário, sujeito ao isolamento por empresa);
 * 2. aplica migrations e políticas;
 * 3. com DEMO_MODE=true, instala a locadora de demonstração (só na primeira vez);
 * 4. confere que a aplicação consegue conectar com o papel `foccus_app`.
 */
async function main() {
  const env = process.env;
  const ownerUrl = env.DATABASE_MIGRATION_URL || env.DATABASE_URL_UNPOOLED || env.DATABASE_URL;
  if (!ownerUrl) throw new Error("Banco não conectado: adicione o Postgres (Neon) ao projeto na Vercel, em Storage.");
  if (!env.BETTER_AUTH_SECRET) throw new Error("Defina BETTER_AUTH_SECRET nas variáveis de ambiente do projeto na Vercel.");

  const useAppRole = Boolean(env.VERCEL) && env.DATABASE_APP_ROLE !== "owner" && !env.DATABASE_APP_URL;
  if (useAppRole) {
    const sql = postgres(ownerUrl, { max: 1, onnotice: () => {} });
    try {
      const password = derivedAppRolePassword(env.BETTER_AUTH_SECRET);
      const [exists] = await sql`select 1 from pg_roles where rolname = 'foccus_app'`;
      // Só a senha muda numa segunda execução: alterar atributos exigiria superusuário.
      await sql.unsafe(exists ? `ALTER ROLE foccus_app WITH LOGIN PASSWORD '${password}'` : `CREATE ROLE foccus_app LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD '${password}'`);
      const [row] = await sql<{ db: string }[]>`select current_database() as db`;
      const db = row!.db;
      await sql.unsafe(`GRANT CONNECT ON DATABASE "${db}" TO foccus_app`);
      console.log(`Papel foccus_app ${exists ? "atualizado" : "criado"}.`);
    } finally {
      await sql.end();
    }
  }

  await runMigrations(ownerUrl);
  console.log("Migrations e políticas aplicadas.");

  if (env.DEMO_MODE === "true") await seedDemo({ databaseUrl: ownerUrl });

  const appUrl = appDatabaseUrl(env);
  if (appUrl && useAppRole) {
    const app = postgres(appUrl, { max: 1, prepare: false });
    try {
      await app`select 1`;
      console.log("A aplicação conecta como foccus_app.");
    } catch (err) {
      throw new Error(`A aplicação não conseguiu conectar como foccus_app (${(err as Error).message}). Para usar o dono do banco no ambiente de testes, defina DATABASE_APP_ROLE=owner.`);
    } finally {
      await app.end();
    }
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err.message ?? err);
    process.exit(1);
  },
);

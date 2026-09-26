import { appDatabaseUrl, derivedAppRolePassword, ownerDatabaseUrl } from "@foccus/db";
import { runMigrations } from "@foccus/db/migrate";
import postgres from "postgres";
import { seedDemo } from "./seed";

/**
 * Build do ambiente de testes na Vercel (docs/AMBIENTE-DE-TESTES.md), antes do `next build`:
 * 1. cria/atualiza o papel `foccus_app` (sem superusuário, sujeito ao isolamento por empresa);
 * 2. aplica migrations e políticas;
 * 3. com DEMO_MODE=true, instala a locadora de demonstração (só na primeira vez);
 * 4. confere que a aplicação consegue conectar com o papel `foccus_app`.
 * Funciona com a Neon e com o Supabase (as variáveis de cada integração são reconhecidas em @foccus/db).
 */
async function main() {
  const env = process.env;
  const ownerUrl = ownerDatabaseUrl(env);
  if (!ownerUrl) throw new Error("Banco não conectado: adicione o Postgres (Neon ou Supabase) ao projeto na Vercel, em Storage.");
  if (!env.BETTER_AUTH_SECRET) throw new Error("Defina BETTER_AUTH_SECRET nas variáveis de ambiente do projeto na Vercel.");

  await checkDatabaseIsOurs(ownerUrl);

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
  await closeSupabaseDataApi(ownerUrl);

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

/**
 * Recusa instalar o Foccus Car num banco que já tem outro sistema no schema public (ex.: um projeto do
 * Supabase usado por outro aplicativo), para nunca misturar as tabelas e os dados dos dois.
 */
async function checkDatabaseIsOurs(ownerUrl: string) {
  const sql = postgres(ownerUrl, { max: 1, onnotice: () => {} });
  try {
    const [row] = await sql<{ total: number; ours: boolean }[]>`
      select count(*)::int as total, bool_or(table_name = 'companies') as ours
      from information_schema.tables where table_schema = 'public'`;
    if (row && row.total > 0 && !row.ours) {
      throw new Error(
        `Este banco já tem ${row.total} tabela(s) de outro sistema. Crie um projeto novo e vazio para o Foccus Car (no Supabase ou na Neon) e conecte-o ao projeto na Vercel.`,
      );
    }
  } finally {
    await sql.end();
  }
}

/**
 * O Supabase publica automaticamente as tabelas do schema public na sua API (papéis anon e authenticated).
 * O Foccus Car não usa essa API: todo acesso passa pelo servidor com o papel foccus_app. Retiramos o acesso
 * desses papéis para que ninguém leia usuários ou sessões com a chave pública do projeto.
 */
async function closeSupabaseDataApi(ownerUrl: string) {
  const sql = postgres(ownerUrl, { max: 1, onnotice: () => {} });
  try {
    const roles = (await sql<{ rolname: string }[]>`select rolname from pg_roles where rolname in ('anon', 'authenticated')`).map((r) => r.rolname);
    if (!roles.length) return;
    const list = roles.join(", ");
    await sql.unsafe(`
      REVOKE ALL ON ALL TABLES IN SCHEMA public FROM ${list};
      REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM ${list};
      REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM ${list};
      ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM ${list};
      ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM ${list};
      ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM ${list};`);
    console.log("API pública do Supabase fechada para as tabelas do Foccus Car.");
  } finally {
    await sql.end();
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err.message ?? err);
    process.exit(1);
  },
);

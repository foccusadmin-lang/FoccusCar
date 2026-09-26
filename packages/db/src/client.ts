import { createHash } from "node:crypto";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "./schema";

export type Database = ReturnType<typeof createDb>;
export type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

type Env = Record<string, string | undefined>;

/** Senha do papel `foccus_app` no ambiente de testes, derivada do segredo da aplicação (nunca fica no código). */
export function derivedAppRolePassword(secret: string) {
  return createHash("sha256").update(`foccus_app:${secret}`).digest("hex").slice(0, 40);
}

/**
 * URL com que a aplicação conecta. Na Vercel com o Postgres da Neon, a integração entrega só a URL do dono
 * do banco; aqui trocamos o usuário pelo papel `foccus_app` (criado no build por prepare-test-env), para
 * o isolamento por empresa valer também no ambiente de testes. DATABASE_APP_URL, se definida, tem prioridade.
 */
export function appDatabaseUrl(env: Env = process.env) {
  if (env.DATABASE_APP_URL) return env.DATABASE_APP_URL;
  const base = env.DATABASE_URL;
  if (!base || !env.VERCEL || env.DATABASE_APP_ROLE === "owner" || !env.BETTER_AUTH_SECRET) return base;
  const url = new URL(base);
  url.username = "foccus_app";
  url.password = derivedAppRolePassword(env.BETTER_AUTH_SECRET);
  return url.toString();
}

/**
 * A aplicação conecta com o papel `foccus_app` (sem superusuário, sujeito a RLS).
 * Migrations usam DATABASE_MIGRATION_URL (dono do schema).
 */
export function createDb(url = appDatabaseUrl()) {
  if (!url) throw new Error("DATABASE_URL não configurada.");
  const client = postgres(url, { max: Number(process.env.DATABASE_POOL_MAX ?? 10), prepare: false });
  return drizzle(client, { schema, casing: "snake_case" });
}

let singleton: Database | undefined;
export function getDb(): Database {
  singleton ??= createDb();
  return singleton;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Executa `fn` dentro de uma transação com o tenant fixado (seção 12).
 * O Postgres aplica as políticas RLS a partir de `app.company_id`, então mesmo
 * uma consulta esquecida sem filtro nunca enxerga dados de outra empresa.
 */
export async function withTenant<T>(
  db: Database,
  ctx: { companyId: string; userId?: string | null },
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  if (!UUID_RE.test(ctx.companyId)) throw new Error("Empresa inválida.");
  if (ctx.userId && !UUID_RE.test(ctx.userId)) throw new Error("Usuário inválido.");
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.company_id', ${ctx.companyId}, true), set_config('app.user_id', ${ctx.userId ?? ""}, true)`);
    return fn(tx);
  });
}

/** Contexto apenas do usuário (ex.: listar as empresas das quais ele participa). */
export async function withUser<T>(db: Database, userId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  if (!UUID_RE.test(userId)) throw new Error("Usuário inválido.");
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.user_id', ${userId}, true)`);
    return fn(tx);
  });
}

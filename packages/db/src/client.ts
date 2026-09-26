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

/** Parâmetros que o Supabase acrescenta às URLs e que o Postgres recusaria como configuração da sessão. */
const FOREIGN_URL_PARAMS = ["supa", "pgbouncer", "connection_limit", "pool_timeout", "schema"];

function cleanUrl(raw: string | undefined) {
  if (!raw) return undefined;
  const url = new URL(raw);
  for (const key of FOREIGN_URL_PARAMS) url.searchParams.delete(key);
  return url.toString();
}

/**
 * URL principal do banco. A Neon (Vercel Storage) entrega DATABASE_URL; o Supabase entrega POSTGRES_URL
 * (pooler em modo transação), então aceitamos os dois nomes.
 */
export function databaseUrl(env: Env = process.env) {
  return cleanUrl(env.DATABASE_URL || env.POSTGRES_URL);
}

/** URL do dono do banco, sem pooler de transação, para migrations e carga de dados. */
export function ownerDatabaseUrl(env: Env = process.env) {
  return cleanUrl(
    env.DATABASE_MIGRATION_URL || env.DATABASE_URL_UNPOOLED || env.POSTGRES_URL_NON_POOLING || env.DATABASE_URL || env.POSTGRES_URL,
  );
}

/**
 * URL com que a aplicação conecta. Na Vercel, as integrações (Neon ou Supabase) entregam só a URL do dono
 * do banco; aqui trocamos o usuário pelo papel `foccus_app` (criado no build por prepare-test-env), para
 * o isolamento por empresa valer também no ambiente de testes. DATABASE_APP_URL, se definida, tem prioridade.
 */
export function appDatabaseUrl(env: Env = process.env) {
  if (env.DATABASE_APP_URL) return env.DATABASE_APP_URL;
  const base = databaseUrl(env);
  if (!base || !env.VERCEL || env.DATABASE_APP_ROLE === "owner" || !env.BETTER_AUTH_SECRET) return base;
  const url = new URL(base);
  // O pooler do Supabase identifica o projeto pelo sufixo do usuário ("postgres.<projeto>").
  const dot = decodeURIComponent(url.username).indexOf(".");
  url.username = dot >= 0 ? `foccus_app${decodeURIComponent(url.username).slice(dot)}` : "foccus_app";
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

/**
 * Mesma conexão de getDb(), aberta só no primeiro uso. Assim o `next build` consegue analisar as rotas
 * sem precisar do banco (a Vercel monta o app antes de qualquer acesso real).
 */
export function lazyDb(): Database {
  return new Proxy({} as Database, {
    get(_, prop) {
      const db = getDb();
      const value = Reflect.get(db, prop, db);
      return typeof value === "function" ? value.bind(db) : value;
    },
  });
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

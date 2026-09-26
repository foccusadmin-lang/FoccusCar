import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { checkServiceAccess } from "@foccus/core";
import { createDb, ensureCompany, users, type Database } from "@foccus/db";
import { createAuth, socialProvidersFromEnv, type Mailer } from "./auth";
import { getAccessContext } from "./context";

const url = process.env.TEST_DATABASE_URL;
const owner = process.env.TEST_DATABASE_MIGRATION_URL ?? url;

describe("provedores de login", () => {
  it("habilita só os provedores configurados", () => {
    expect(Object.keys(socialProvidersFromEnv({}))).toEqual([]);
    const all = socialProvidersFromEnv({
      GOOGLE_CLIENT_ID: "g", GOOGLE_CLIENT_SECRET: "g", MICROSOFT_CLIENT_ID: "m", MICROSOFT_CLIENT_SECRET: "m",
      APPLE_CLIENT_ID: "a", APPLE_CLIENT_SECRET: "a",
    });
    expect(Object.keys(all)).toEqual(["google", "microsoft", "apple"]);
    expect((all.microsoft as { tenantId?: string }).tenantId).toBe("common");
  });
});

describe.skipIf(!url)("cadastro público", () => {
  let db: Database;
  const sent: string[] = [];
  const mailer: Mailer = { send: async (m) => void sent.push(m.subject) };
  const slug = `auth-${Math.random().toString(36).slice(2, 8)}`;
  const env = { BETTER_AUTH_SECRET: "test-secret-with-enough-entropy-1234567890", BETTER_AUTH_URL: "http://localhost:3000", DEFAULT_COMPANY_SLUG: slug, NODE_ENV: "test" };
  let auth: ReturnType<typeof createAuth>;

  beforeAll(async () => {
    const ownerDb = createDb(owner);
    await ensureCompany(ownerDb, { name: "Locadora Auth", slug });
    await ownerDb.$client.end();
    db = createDb(url);
    process.env.DEFAULT_COMPANY_SLUG = slug;
    auth = createAuth({ db, env, mailer });
  });
  afterAll(async () => db?.$client.end());

  it("nova conta nasce CLIENTE e PROFILE_INCOMPLETE, mesmo tentando se promover", async () => {
    const email = `novo-${Date.now()}@exemplo.com`;
    const res = await auth.api.signUpEmail({
      body: { name: "Novo Cliente", email, password: "senha-bem-forte-123", status: "ACTIVE", isPlatformAdmin: true, role: "ADMIN" } as never,
      headers: new Headers({ host: "localhost:3000" }),
      asResponse: true,
    });
    // Campos protegidos enviados pelo navegador são ignorados: a conta nasce sem privilégios.
    expect(res.ok).toBe(true);
    const [user] = await db.select().from(users).where(eq(users.email, email));
    expect(user!.status).toBe("PROFILE_INCOMPLETE");
    expect(user!.isPlatformAdmin).toBe(false);
  });

  it("conta criada entra, é CLIENTE e tem serviços bloqueados", async () => {
    const email = `cliente-${Date.now()}@exemplo.com`;
    const headers = new Headers({ host: "localhost:3000" });
    await auth.api.signUpEmail({ body: { name: "Cliente", email, password: "senha-bem-forte-123" }, headers });
    const signIn = await auth.api.signInEmail({ body: { email, password: "senha-bem-forte-123" }, headers, asResponse: true });
    const cookie = signIn.headers.get("set-cookie")!.split(";")[0]!;
    const ctx = await getAccessContext(auth, db, new Headers({ host: "localhost:3000", cookie }));
    expect(ctx?.roles).toEqual(["CLIENTE"]);
    expect(ctx?.accountStatus).toBe("PROFILE_INCOMPLETE");
    expect(ctx?.permissions.has("customers:view")).toBe(false);
    expect(checkServiceAccess(ctx!.accountStatus)).toMatchObject({ allowed: false, message: "Complete seu cadastro para continuar." });
    expect(sent).toContain("Foccus Car: confirme seu e-mail");
  });

  it("senha errada não entra", async () => {
    const res = await auth.api.signInEmail({ body: { email: "ninguem@exemplo.com", password: "errada-errada" }, asResponse: true });
    expect(res.status).toBe(401);
  });
});

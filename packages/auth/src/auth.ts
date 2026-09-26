import { betterAuth, type BetterAuthOptions } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { PUBLIC_SIGNUP_ROLE } from "@foccus/core";
import { accounts, companyMembers, sessions, users, verifications, withTenant, type Database } from "@foccus/db";
import { eq } from "drizzle-orm";
import { resolveCompanyFromHost } from "./tenant";

export interface Mailer {
  send(message: { to: string; subject: string; text: string; html?: string }): Promise<void>;
}

/** Em desenvolvimento, e-mails aparecem no console. Em produção, injete o provedor real. */
export const consoleMailer: Mailer = {
  async send(m) {
    console.info(`[e-mail] para ${m.to}: ${m.subject}\n${m.text}`);
  },
};

type Env = Record<string, string | undefined>;

/**
 * Provedores sociais habilitados conforme as variáveis de ambiente.
 * Google é o principal; Microsoft cobre contas Outlook/Hotmail (tenant "common");
 * Apple exige client secret JWT gerado com a chave .p8 (ver docs/AUTENTICACAO.md).
 */
export function socialProvidersFromEnv(env: Env): NonNullable<BetterAuthOptions["socialProviders"]> {
  const providers: NonNullable<BetterAuthOptions["socialProviders"]> = {};
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET)
    providers.google = { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET, prompt: "select_account" };
  if (env.MICROSOFT_CLIENT_ID && env.MICROSOFT_CLIENT_SECRET)
    providers.microsoft = {
      clientId: env.MICROSOFT_CLIENT_ID,
      clientSecret: env.MICROSOFT_CLIENT_SECRET,
      tenantId: env.MICROSOFT_TENANT_ID ?? "common",
      prompt: "select_account",
    };
  if (env.APPLE_CLIENT_ID && env.APPLE_CLIENT_SECRET)
    providers.apple = {
      clientId: env.APPLE_CLIENT_ID,
      clientSecret: env.APPLE_CLIENT_SECRET,
      appBundleIdentifier: env.APPLE_APP_BUNDLE_IDENTIFIER,
    };
  return providers;
}

export function createAuth(opts: { db: Database; env?: Env; mailer?: Mailer }) {
  const env = opts.env ?? process.env;
  const mailer = opts.mailer ?? consoleMailer;
  const db = opts.db;
  const isProd = env.NODE_ENV === "production";

  return betterAuth({
    appName: "Foccus Car",
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.BETTER_AUTH_URL ?? "", "https://appleid.apple.com"].filter(Boolean),
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: { user: users, session: sessions, account: accounts, verification: verifications },
    }),
    advanced: {
      database: { generateId: "uuid" },
      useSecureCookies: isProd,
      cookiePrefix: "foccus",
    },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 10,
      requireEmailVerification: isProd,
      async sendResetPassword({ user, url }) {
        await mailer.send({ to: user.email, subject: "Foccus Car: redefinição de senha", text: `Para criar uma nova senha, acesse: ${url}` });
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      async sendVerificationEmail({ user, url }) {
        await mailer.send({ to: user.email, subject: "Foccus Car: confirme seu e-mail", text: `Confirme seu e-mail em: ${url}` });
      },
    },
    socialProviders: socialProvidersFromEnv(env),
    account: {
      accountLinking: { enabled: true, trustedProviders: ["google", "microsoft", "apple"] },
    },
    user: {
      additionalFields: {
        // input:false => o navegador nunca consegue definir estes campos no cadastro (seção 17).
        status: { type: "string", input: false, required: false, defaultValue: "PROFILE_INCOMPLETE" },
        isPlatformAdmin: { type: "boolean", input: false, required: false, defaultValue: false },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      additionalFields: {
        activeCompanyId: { type: "string", input: false, required: false },
      },
    },
    rateLimit: { enabled: true, window: 60, max: 100, customRules: { "/sign-in/email": { window: 60, max: 5 } } },
    databaseHooks: {
      user: {
        create: {
          // Reforço: qualquer conta pública nasce PROFILE_INCOMPLETE e sem privilégios.
          async before(user) {
            return {
              data: { ...user, email: user.email.toLowerCase(), status: "PROFILE_INCOMPLETE", isPlatformAdmin: false },
            };
          },
          // Vincula a nova conta à empresa do domínio acessado, sempre como CLIENTE.
          async after(user, ctx) {
            const company = await resolveCompanyFromHost(db, ctx?.request?.headers.get("host"));
            if (!company) return;
            await withTenant(db, { companyId: company.id, userId: user.id }, (tx) =>
              tx
                .insert(companyMembers)
                .values({ companyId: company.id, userId: user.id, role: PUBLIC_SIGNUP_ROLE })
                .onConflictDoNothing(),
            );
          },
        },
      },
      session: {
        create: {
          async before(session, ctx) {
            const company = await resolveCompanyFromHost(db, ctx?.request?.headers.get("host"));
            await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, session.userId));
            return { data: { ...session, activeCompanyId: company?.id ?? null } };
          },
        },
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;

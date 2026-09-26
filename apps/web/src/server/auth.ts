import "server-only";
import { createAuth, getAccessContext, resolveCompanyFromHost } from "@foccus/auth";
import { headers } from "next/headers";
import { cache } from "react";
import { db } from "./db";

export const auth = createAuth({ db });

/** Empresa da requisição atual, resolvida pelo domínio (nunca por parâmetro do navegador). */
export const getCurrentCompany = cache(async () => {
  const h = await headers();
  return resolveCompanyFromHost(db, h.get("x-forwarded-host") ?? h.get("host"));
});

export const getSession = cache(async () => auth.api.getSession({ headers: await headers() }));

export const getAccess = cache(async () => getAccessContext(auth, db, await headers()));

/** Provedores sociais configurados, para a tela de login mostrar só o que funciona. */
export function enabledProviders() {
  return {
    google: Boolean(process.env.GOOGLE_CLIENT_ID),
    microsoft: Boolean(process.env.MICROSOFT_CLIENT_ID),
    apple: Boolean(process.env.APPLE_CLIENT_ID),
  };
}

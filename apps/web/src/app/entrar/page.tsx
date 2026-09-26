import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DEFAULT_DEMO_PASSWORD, DEMO_DOMAIN, DEMO_PROFILES } from "@foccus/services/demo-logins";
import { DemoLogins } from "@/components/DemoLogins";
import { LoginPanel } from "@/components/LoginPanel";
import { enabledProviders, getSession } from "@/server/auth";

export const metadata: Metadata = { title: "Entrar" };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  // Só aceita caminhos internos para evitar redirecionamento aberto.
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/cadastro";
  if (await getSession()) redirect(safeNext);
  return (
    <div className="container auth-wrap">
      <LoginPanel providers={enabledProviders()} next={safeNext} />
      {process.env.DEMO_MODE === "true" && (
        <DemoLogins
          password={process.env.DEMO_PASSWORD || DEFAULT_DEMO_PASSWORD}
          profiles={DEMO_PROFILES.map((p) => ({ email: `${p.user}@${DEMO_DOMAIN}`, label: p.label, hint: p.hint, area: p.area }))}
        />
      )}
    </div>
  );
}

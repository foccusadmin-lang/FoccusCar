import type { Metadata } from "next";
import { redirect } from "next/navigation";
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
    </div>
  );
}

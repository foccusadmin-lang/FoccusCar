import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/PasswordForms";

export const metadata: Metadata = { title: "Nova senha" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const { token, error } = await searchParams;
  return (
    <div className="container auth-wrap">
      <div className="card card-pad auth-card stack" style={{ gap: 18 }}>
        <div className="stack" style={{ gap: 6, textAlign: "center" }}>
          <span className="eyebrow">Foccus Car</span>
          <h1 style={{ fontSize: 26 }}>Criar nova senha</h1>
        </div>
        <ResetPasswordForm token={error ? null : token ?? null} />
      </div>
    </div>
  );
}

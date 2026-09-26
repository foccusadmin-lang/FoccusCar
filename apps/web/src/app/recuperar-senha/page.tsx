import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/PasswordForms";

export const metadata: Metadata = { title: "Recuperar senha" };

export default function ForgotPasswordPage() {
  return (
    <div className="container auth-wrap">
      <div className="card card-pad auth-card stack" style={{ gap: 18 }}>
        <div className="stack" style={{ gap: 6, textAlign: "center" }}>
          <span className="eyebrow">Foccus Car</span>
          <h1 style={{ fontSize: 26 }}>Esqueci minha senha</h1>
        </div>
        <ForgotPasswordForm />
      </div>
    </div>
  );
}

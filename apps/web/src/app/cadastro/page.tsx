import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { ACCOUNT_STATUS_LABEL } from "@/lib/format";
import { getAccess, getSession } from "@/server/auth";
import { SignOutButton } from "@/components/SignOutButton";

export const metadata: Metadata = { title: "Meu cadastro" };
export const dynamic = "force-dynamic";

const STEPS = [
  { title: "Dados pessoais", detail: "Nome completo, CPF, data de nascimento, telefone e WhatsApp" },
  { title: "Endereço", detail: "CEP, endereço, número, bairro, cidade e estado" },
  { title: "CNH", detail: "Número, categoria, validade e fotos da frente e do verso" },
  { title: "Documentos", detail: "RG, comprovante de residência e selfie" },
];

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) redirect("/entrar?next=/cadastro");
  const access = await getAccess();
  const status = access?.accountStatus ?? "PROFILE_INCOMPLETE";

  return (
    <div className="container" style={{ padding: "32px 0", maxWidth: 760 }}>
      <div className="stack" style={{ gap: 20 }}>
        <div className="stack" style={{ gap: 6 }}>
          <span className="eyebrow">Minha conta</span>
          <h1 style={{ fontSize: 28 }}>Olá, {session.user.name.split(" ")[0]}</h1>
          <div className="row">
            <Badge tone={status === "ACTIVE" ? "success" : "warning"}>{ACCOUNT_STATUS_LABEL[status]}</Badge>
            <span className="muted" style={{ fontSize: 14 }}>{session.user.email}</span>
          </div>
        </div>

        {status !== "ACTIVE" && (
          <Alert tone="warning" title="Complete seu cadastro para continuar.">
            Você já pode navegar pela vitrine. Reservas, locações e pagamentos são liberados depois que o cadastro estiver completo e aprovado.
          </Alert>
        )}

        <ol className="card card-pad stack" style={{ gap: 0, listStyle: "none", margin: 0 }}>
          {STEPS.map((s, i) => (
            <li key={s.title} className="row" style={{ padding: "14px 0", borderTop: i ? "1px solid var(--fc-border)" : "none", flexWrap: "nowrap", alignItems: "flex-start" }}>
              <span aria-hidden style={{ flex: "none", width: 32, height: 32, borderRadius: 16, display: "grid", placeItems: "center", border: "1px solid var(--fc-gold-700)", color: "var(--fc-gold-300)", fontWeight: 700 }}>{i + 1}</span>
              <div>
                <strong>{s.title}</strong>
                <p className="muted" style={{ margin: "2px 0 0", fontSize: 14 }}>{s.detail}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="muted" style={{ margin: 0, fontSize: 14 }}>O formulário de cadastro completo com envio de documentos é a próxima etapa do desenvolvimento.</p>
        <SignOutButton />
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { checkServiceAccess } from "@foccus/core";
import { Alert } from "@/components/ui/Alert";
import { ButtonLink } from "@/components/ui/Button";
import { getAccess } from "@/server/auth";

export const metadata: Metadata = { title: "Nova reserva" };
export const dynamic = "force-dynamic";

/** Ponto de entrada da reserva. O fluxo de datas, contrato e pagamento chega na etapa 4 do plano. */
export default async function NewReservationPage() {
  const ctx = await getAccess();
  if (!ctx) redirect("/entrar?next=/");
  if (!checkServiceAccess(ctx.accountStatus).allowed) redirect("/cadastro");
  return (
    <div className="container" style={{ paddingBlock: "48px", maxWidth: 640 }}>
      <div className="stack" style={{ gap: 16 }}>
        <span className="eyebrow">Reserva</span>
        <h1 style={{ fontSize: 28 }}>Seu cadastro está liberado</h1>
        <Alert tone="success">A reserva online com escolha de datas, contrato e pagamento está em desenvolvimento e será liberada em breve.</Alert>
        <ButtonLink href="/#frota" variant="secondary">Voltar aos veículos</ButtonLink>
      </div>
    </div>
  );
}

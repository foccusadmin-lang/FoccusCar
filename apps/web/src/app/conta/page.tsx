import type { Metadata } from "next";
import Link from "next/link";
import { Icon, type IconName } from "@/components/shell/Icon";
import { PageHeader } from "@/components/shell/ModulePage";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { getSession } from "@/server/auth";

export const metadata: Metadata = { title: "Minha conta" };
export const dynamic = "force-dynamic";

const SHORTCUTS: { href: string; label: string; icon: IconName }[] = [
  { href: "/conta/reservas", label: "Minhas reservas", icon: "calendar" },
  { href: "/conta/pagamentos", label: "Meus pagamentos", icon: "card" },
  { href: "/conta/documentos", label: "Meus documentos", icon: "idcard" },
  { href: "/conta/notificacoes", label: "Notificações", icon: "bell" },
];

/** Dashboard do cliente (seção 91). Reservas e locações entram nas etapas 4 e 5. */
export default async function ClientHomePage() {
  const session = await getSession();
  const firstName = session?.user.name.split(" ")[0] ?? "";
  return (
    <div className="page">
      <PageHeader eyebrow="Minha conta" title={`Olá, ${firstName}`} description="Seu cadastro está liberado para reservar." actions={<ButtonLink href="/">Alugar um veículo</ButtonLink>} />

      <div className="dash-grid">
        <section className="stack" style={{ gap: 12 }} aria-labelledby="proxima">
          <div className="gold-rule" id="proxima">Próxima locação</div>
          <EmptyState
            title="Nenhuma locação agendada"
            description="Quando você reservar um veículo, aqui aparecem o carro, a data, o local de retirada e o status."
            action={<ButtonLink href="/" variant="secondary">Ver veículos</ButtonLink>}
          />
        </section>
        <section className="stack" style={{ gap: 12 }} aria-labelledby="recentes">
          <div className="gold-rule" id="recentes">Meus veículos recentes</div>
          <div className="card card-pad stack" style={{ gap: 8 }}>
            <p className="muted" style={{ margin: 0 }}>Os veículos que você já alugou ficam aqui, com o botão Alugar novamente.</p>
          </div>
        </section>
      </div>

      <nav className="quick-links" aria-label="Atalhos da conta">
        {SHORTCUTS.map((s) => (
          <Link key={s.href} href={s.href} className="card quick-link">
            <Icon name={s.icon} size={24} />
            <span>{s.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}

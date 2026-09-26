import { EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="container" style={{ padding: "48px 0" }}>
      <EmptyState title="Página não encontrada" description="O endereço pode ter mudado ou o veículo saiu da vitrine." action={<ButtonLink href="/">Voltar à vitrine</ButtonLink>} />
    </div>
  );
}

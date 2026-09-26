import Image from "next/image";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { ReserveButton } from "@/components/ReserveButton";
import { FUEL_LABEL, TRANSMISSION_LABEL, formatCents, formatDate } from "@/lib/format";
import { vehicleImage } from "@/lib/vehicle-image";
import { getCurrentCompany } from "@/server/auth";
import { getShowcaseVehicle } from "@/server/services/showcase";

export const dynamic = "force-dynamic";

export default async function VehiclePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const company = await getCurrentCompany();
  const v = company ? await getShowcaseVehicle(company.id, id) : null;
  if (!v) notFound();

  const rates = [
    ["Diária", v.dailyRateCents],
    ["Semanal", v.weeklyRateCents],
    ["Mensal", v.monthlyRateCents],
  ].filter(([, c]) => c != null) as [string, number][];

  return (
    <div className="container detail">
      <section className="stack" style={{ gap: 20 }}>
        <div className="card" style={{ overflow: "hidden" }}>
          <div className="vehicle-media">
            <Image src={vehicleImage(v.coverKey, v.color)} alt={`${v.title} ${v.modelYear}`} fill priority sizes="(max-width: 960px) 100vw, 60vw" />
          </div>
        </div>
        <div className="stack" style={{ gap: 6 }}>
          <span className="eyebrow">{v.category ?? "Veículo"}</span>
          <h1 className="display" style={{ fontSize: "clamp(28px, 5vw, 42px)" }}>{v.title}</h1>
          <p className="muted" style={{ margin: 0 }}>{[v.version, v.modelYear, v.color].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="spec-grid">
          <div className="spec"><span>Câmbio</span>{TRANSMISSION_LABEL[v.transmission]}</div>
          <div className="spec"><span>Combustível</span>{FUEL_LABEL[v.fuelType]}</div>
          <div className="spec"><span>Lugares</span>{v.seats ?? "—"}</div>
          <div className="spec"><span>Ano</span>{v.modelYear}</div>
          <div className="spec"><span>Caução</span>{formatCents(v.depositCents)}</div>
          <div className="spec"><span>Status</span>{v.available ? "Disponível" : "Alugado"}</div>
        </div>
        {v.features.length > 0 && (
          <div className="row">{v.features.map((f) => <Badge key={f} plain>{f}</Badge>)}</div>
        )}
      </section>

      <aside className="card card-pad stack" style={{ gap: 18 }}>
        {v.available ? <Badge tone="success">Disponível agora</Badge> : (
          <div className="stack" style={{ gap: 6 }}>
            <Badge tone="warning">Alugado</Badge>
            {v.nextAvailableAt && <span>Disponível novamente em <strong>{formatDate(v.nextAvailableAt)}</strong></span>}
          </div>
        )}
        {rates.length ? (
          <div className="stack" style={{ gap: 10 }}>
            {rates.map(([label, cents]) => (
              <div key={label} className="row" style={{ justifyContent: "space-between" }}>
                <span className="muted">{label}</span>
                <strong style={{ fontSize: 18 }}>{formatCents(cents)}</strong>
              </div>
            ))}
          </div>
        ) : <span className="muted">Preço sob consulta</span>}
        <ReserveButton vehicleId={v.id} available={v.available} />
        <p className="muted" style={{ fontSize: 13, margin: 0 }}>
          Para reservar é preciso ter o cadastro completo e aprovado: dados pessoais, endereço e CNH válida.
        </p>
      </aside>
    </div>
  );
}

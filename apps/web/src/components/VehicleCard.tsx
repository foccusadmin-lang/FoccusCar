import Image from "next/image";
import Link from "next/link";
import type { ShowcaseVehicle } from "@/server/services/showcase";
import { FUEL_LABEL, TRANSMISSION_LABEL, formatCents, formatDate } from "@/lib/format";
import { vehicleImage } from "@/lib/vehicle-image";
import { Badge } from "./ui/Badge";

export function VehicleCard({ v }: { v: ShowcaseVehicle }) {
  return (
    <Link href={`/veiculos/${v.id}`} className="card vehicle-card" aria-label={`${v.title} ${v.modelYear}`}>
      <div className="vehicle-media">
        <Image src={vehicleImage(v.coverUrl, v.color)} alt="" fill unoptimized={Boolean(v.coverUrl)} sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" />
        <div className="vehicle-flags">
          {v.featured && <Badge tone="gold" plain>Destaque</Badge>}
          {v.available ? <Badge tone="success">Disponível</Badge> : <Badge tone="warning">Alugado</Badge>}
        </div>
      </div>
      <div className="stack" style={{ gap: 10, padding: 18 }}>
        <div>
          <div className="eyebrow" style={{ fontSize: 11 }}>{v.category ?? "Veículo"}</div>
          <h3 style={{ fontSize: 20, marginTop: 4 }}>{v.title}</h3>
          <p className="muted" style={{ margin: "2px 0 0", fontSize: 14 }}>{[v.version, v.modelYear].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="row" style={{ gap: 8, fontSize: 13 }}>
          <Badge plain>{TRANSMISSION_LABEL[v.transmission]}</Badge>
          <Badge plain>{FUEL_LABEL[v.fuelType]}</Badge>
          {v.seats && <Badge plain>{v.seats} lugares</Badge>}
        </div>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end", marginTop: 4 }}>
          {v.dailyRateCents != null ? (
            <div>
              <span className="muted" style={{ fontSize: 13 }}>a partir de</span>
              <div style={{ fontSize: 22, fontWeight: 700 }} className="gold-text">{formatCents(v.dailyRateCents)}<span className="muted" style={{ fontSize: 13, fontWeight: 400, WebkitTextFillColor: "var(--fc-text-muted)" }}> /dia</span></div>
            </div>
          ) : (
            <span className="muted">Preço sob consulta</span>
          )}
          {!v.available && v.nextAvailableAt && (
            <span className="muted" style={{ fontSize: 13, textAlign: "right" }}>Disponível novamente em<br /><strong style={{ color: "var(--fc-text)" }}>{formatDate(v.nextAvailableAt)}</strong></span>
          )}
        </div>
      </div>
    </Link>
  );
}

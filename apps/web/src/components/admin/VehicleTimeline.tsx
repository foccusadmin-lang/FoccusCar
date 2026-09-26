"use client";

import { useState } from "react";
import { formatCents, formatDateTime, formatKm } from "@/lib/format";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";

type Event = { id: string; type: string; occurredAt: string; description: string; source: string; actor: string; km: number | null; amountCents: number | null };

const TYPE_LABEL: Record<string, string> = {
  FLEET_ENTRY: "Entrada na frota", RESERVATION: "Reserva", RENTAL_START: "Início de locação", RENTAL_END: "Fim de locação",
  CHECKOUT: "Retirada", RETURN: "Devolução", MILEAGE: "Quilometragem", FUEL: "Combustível", CHECKLIST: "Checklist", PHOTO: "Foto",
  DAMAGE: "Avaria", REPAIR: "Reparo", MAINTENANCE: "Manutenção", TIRES: "Pneus", OIL: "Óleo", FINE: "Multa", ACCIDENT: "Acidente",
  OCCURRENCE: "Ocorrência", GPS: "GPS", BLOCK: "Bloqueio", UNBLOCK: "Desbloqueio", DOCUMENT: "Documento", COST: "Custo",
  REVENUE: "Receita", STATUS_CHANGE: "Status", ADMIN_CHANGE: "Alteração administrativa",
};
const SOURCE_LABEL: Record<string, string> = { admin: "Painel", seed: "Carga inicial", rentals: "Locações", maintenance: "Manutenção", gps: "GPS" };

/** Vida do Veículo (seção 31): data, hora, responsável, descrição e origem de cada evento. */
export function VehicleTimeline({ vehicleId, initial }: { vehicleId: string; initial: { events: Event[]; nextCursor: string | null } }) {
  const [events, setEvents] = useState(initial.events);
  const [cursor, setCursor] = useState(initial.nextCursor);
  const [type, setType] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(opts: { reset?: boolean; tipo?: string }) {
    setBusy(true);
    setError(null);
    const qs = new URLSearchParams();
    const t = opts.tipo ?? type;
    if (t) qs.set("tipo", t);
    if (!opts.reset && cursor) qs.set("antes", cursor);
    const res = await fetch(`/api/vehicles/${vehicleId}/timeline?${qs}`).catch(() => null);
    const json = await res?.json().catch(() => null);
    setBusy(false);
    if (!res?.ok) return setError(json?.error?.message ?? "Sem conexão. Tente novamente.");
    setEvents((prev) => (opts.reset ? json.events : [...prev, ...json.events]));
    setCursor(json.nextCursor);
  }

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="row">
        <label htmlFor="tl-type" className="muted" style={{ fontSize: 14 }}>Mostrar</label>
        <select id="tl-type" className="select" style={{ maxWidth: 260 }} value={type} onChange={(e) => { setType(e.target.value); void load({ reset: true, tipo: e.target.value }); }}>
          <option value="">Todos os eventos</option>
          {Object.entries(TYPE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </div>
      {error && <p role="alert" className="error">{error}</p>}
      {events.length === 0 ? (
        <EmptyState title="Nenhum evento" description={type ? "Nenhum evento deste tipo ainda." : "Os eventos do veículo aparecem aqui à medida que acontecem."} />
      ) : (
        <ol className="timeline" aria-label="Vida do Veículo">
          {events.map((e) => (
            <li key={e.id} className="stack" style={{ gap: 4 }}>
              <div className="row" style={{ gap: 8 }}>
                <Badge tone={e.type === "BLOCK" ? "danger" : e.type === "FLEET_ENTRY" ? "gold" : "neutral"} plain>{TYPE_LABEL[e.type] ?? e.type}</Badge>
                <span className="meta">{formatDateTime(e.occurredAt)}</span>
              </div>
              <span>{e.description}</span>
              <span className="meta">
                {e.actor} · origem: {SOURCE_LABEL[e.source] ?? e.source}
                {e.km != null ? ` · ${formatKm(e.km)}` : ""}
                {e.amountCents != null ? ` · ${formatCents(e.amountCents)}` : ""}
              </span>
            </li>
          ))}
        </ol>
      )}
      {cursor && <div><Button variant="secondary" disabled={busy} onClick={() => load({})}>{busy ? "Carregando…" : "Ver eventos anteriores"}</Button></div>}
    </div>
  );
}

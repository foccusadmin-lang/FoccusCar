import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ServiceError, getFleetOptions, getVehicle, getVehicleTimeline } from "@foccus/services";
import { VehicleDocuments } from "@/components/admin/VehicleDocuments";
import { VehicleForm } from "@/components/admin/VehicleForm";
import { VehiclePhotos } from "@/components/admin/VehiclePhotos";
import { VehicleStatusControl } from "@/components/admin/VehicleStatusControl";
import { VehicleStatusBadge } from "@/components/admin/VehicleStatusBadge";
import { VehicleTimeline } from "@/components/admin/VehicleTimeline";
import { Alert } from "@/components/ui/Alert";
import { ButtonLink } from "@/components/ui/Button";
import { formatCents, formatDate, formatKm } from "@/lib/format";
import { requirePagePermission } from "@/server/guard";
import { deps } from "@/server/services";

export const metadata: Metadata = { title: "Veículo" };

const TABS = [
  { key: "resumo", label: "Resumo" },
  { key: "fotos", label: "Fotos" },
  { key: "documentos", label: "Documentos" },
  { key: "vida", label: "Vida do Veículo" },
  { key: "editar", label: "Editar cadastro", manage: true },
] as const;

export default async function VehicleAdminPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const ctx = await requirePagePermission("vehicles:view", `/admin/veiculos/${id}`);
  const data = await getVehicle(deps, ctx, id).catch((e) => (e instanceof ServiceError && e.status === 404 ? null : Promise.reject(e)));
  if (!data) notFound();
  const canManage = ctx.permissions.has("vehicles:manage");
  const canHistory = ctx.permissions.has("vehicles:history.view");
  const tabs = TABS.filter((t) => (!("manage" in t) || canManage) && (t.key !== "vida" || canHistory));
  const tab = tabs.find((t) => t.key === sp.aba)?.key ?? "resumo";
  const v = data.vehicle;
  const alerts = data.documents.filter((d) => d.state === "EXPIRED" || d.state === "EXPIRING");

  return (
    <div className="stack" style={{ gap: 16, maxWidth: 1100 }}>
      <div className="page-head">
        <div className="stack" style={{ gap: 6 }}>
          <Link href="/admin/veiculos" className="muted" style={{ fontSize: 14 }}>‹ Veículos</Link>
          <h1>{v.brand} {v.model} {v.modelYear}</h1>
          <div className="row" style={{ gap: 8 }}>
            <strong style={{ letterSpacing: "0.08em" }}>{v.plateFormatted}</strong>
            <VehicleStatusBadge status={v.status} />
            {v.showcaseVisible ? <span className="badge gold plain">Na vitrine</span> : <span className="badge plain">Fora da vitrine</span>}
          </div>
        </div>
        {canManage && <VehicleStatusControl vehicleId={v.id} status={v.status} />}
      </div>

      {sp.novo && <Alert tone="success" title="Veículo cadastrado">Agora adicione as fotos e os documentos. Quando estiver tudo certo, mude o status para Disponível e ligue a vitrine em Editar cadastro.</Alert>}
      {data.blockNote && <Alert tone="warning">{data.blockNote}</Alert>}
      {alerts.length > 0 && (
        <Alert tone={alerts.some((a) => a.state === "EXPIRED") ? "danger" : "warning"} title="Documentos da frota">
          {alerts.map((a) => `${a.label}: ${a.state === "EXPIRED" ? "vencido" : `vence em ${a.daysLeft} dia(s)`}`).join(" · ")}
        </Alert>
      )}

      <nav className="tabs" aria-label="Seções do veículo">
        {tabs.map((t) => (
          <Link key={t.key} href={`?aba=${t.key}`} className={t.key === tab ? "active" : undefined} aria-current={t.key === tab ? "page" : undefined} scroll={false}>{t.label}</Link>
        ))}
      </nav>

      {tab === "resumo" && (
        <div className="stack" style={{ gap: 16 }}>
          <div className="spec-grid">
            <div className="spec"><span>KM atual</span>{formatKm(v.currentKm)}</div>
            <div className="spec"><span>Diária</span>{formatCents(v.dailyRateCents)}</div>
            <div className="spec"><span>Caução</span>{formatCents(v.depositCents)}</div>
            <div className="spec"><span>Categoria</span>{v.category ?? "—"}</div>
            <div className="spec"><span>Localização</span>{v.location ?? "—"}</div>
            <div className="spec"><span>Versão / cor</span>{[v.version, v.color].filter(Boolean).join(" · ") || "—"}</div>
            <div className="spec"><span>RENAVAM</span>{v.renavam ?? "—"}</div>
            <div className="spec"><span>Chassi</span><span style={{ fontSize: 13, letterSpacing: 0, textTransform: "none", color: "inherit" }}>{v.chassis ?? "—"}</span></div>
            <div className="spec"><span>Entrada na frota</span>{v.acquiredAt ? formatDate(v.acquiredAt) : formatDate(v.createdAt)}</div>
          </div>
          <div className="card card-pad stack" style={{ gap: 8 }}>
            <strong>Agenda</strong>
            {data.activeRental ? <span>Em locação, devolução prevista para {formatDate(data.activeRental.expectedReturnAt)}.</span>
              : data.nextReservation ? <span>Próxima reserva: {formatDate(data.nextReservation.pickupAt)} a {formatDate(data.nextReservation.returnAt)}.</span>
              : <span className="muted">Sem locação ou reserva futura.</span>}
          </div>
          {canManage && data.photos.length === 0 && <Alert tone="warning">Este veículo ainda não tem fotos. A vitrine mostra uma imagem ilustrativa até você enviar as fotos reais.</Alert>}
        </div>
      )}
      {tab === "fotos" && <VehiclePhotos vehicleId={v.id} photos={data.photos.map((p) => ({ ...p, createdAt: p.createdAt.toISOString() }))} canManage={canManage} />}
      {tab === "documentos" && <VehicleDocuments vehicleId={v.id} documents={data.documents.map((d) => ({ ...d, issuedAt: d.issuedAt?.toISOString() ?? null, expiresAt: d.expiresAt?.toISOString() ?? null }))} canManage={canManage} />}
      {tab === "vida" && <VehicleTimelineSection vehicleId={v.id} />}
      {tab === "editar" && canManage && (
        <VehicleEditSection vehicleId={v.id} initial={v} />
      )}
    </div>
  );

  async function VehicleTimelineSection({ vehicleId }: { vehicleId: string }) {
    const first = await getVehicleTimeline(deps, ctx, vehicleId);
    return <VehicleTimeline vehicleId={vehicleId} initial={{ events: first.events.map((e) => ({ ...e, occurredAt: e.occurredAt.toISOString() })), nextCursor: first.nextCursor }} />;
  }

  async function VehicleEditSection({ vehicleId, initial }: { vehicleId: string; initial: typeof v }) {
    const options = await getFleetOptions(deps, ctx);
    return (
      <div style={{ maxWidth: 900 }}>
        <VehicleForm vehicleId={vehicleId} initial={{ ...initial, acquiredAt: initial.acquiredAt?.toISOString() ?? null }} categories={options.categories} locations={options.locations} />
      </div>
    );
  }
}

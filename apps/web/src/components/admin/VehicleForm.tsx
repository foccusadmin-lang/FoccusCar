"use client";

import { CRITICAL_VEHICLE_FIELDS, VEHICLE_FIELD_LABELS } from "@foccus/core";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { FUEL_LABEL, TRANSMISSION_LABEL, centsToInput, parseMoneyToCents } from "@/lib/format";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { ConfirmDialog } from "../ui/ConfirmDialog";

type Option = { id: string; name: string };

export interface VehicleFormValues {
  plate: string; renavam: string | null; chassis: string | null; brand: string; model: string; version: string | null;
  modelYear: number; manufactureYear: number | null; color: string | null; categoryId: string | null; locationId: string | null;
  transmission: string; fuelType: string; seats: number | null; currentKm: number; features: string[];
  dailyRateCents: number; weeklyRateCents: number | null; biweeklyRateCents: number | null; monthlyRateCents: number | null;
  depositCents: number; kmAllowancePerDay: number | null; extraKmCents: number | null;
  showcaseVisible: boolean; showcasePricePublic: boolean; showcaseFeatured: boolean;
  acquiredAt: string | Date | null; acquisitionCents: number | null;
}

const MONEY = ["dailyRateCents", "weeklyRateCents", "biweeklyRateCents", "monthlyRateCents", "depositCents", "extraKmCents", "acquisitionCents"] as const;

function toForm(v?: VehicleFormValues) {
  const s = (x: unknown) => (x == null ? "" : String(x));
  return {
    plate: s(v?.plate), renavam: s(v?.renavam), chassis: s(v?.chassis), brand: s(v?.brand), model: s(v?.model), version: s(v?.version),
    modelYear: s(v?.modelYear ?? new Date().getFullYear()), manufactureYear: s(v?.manufactureYear), color: s(v?.color),
    categoryId: s(v?.categoryId), locationId: s(v?.locationId), transmission: s(v?.transmission ?? "AUTOMATIC"), fuelType: s(v?.fuelType ?? "FLEX"),
    seats: s(v?.seats ?? 5), currentKm: s(v?.currentKm ?? 0), features: (v?.features ?? []).join(", "),
    ...Object.fromEntries(MONEY.map((k) => [k, centsToInput(v?.[k] ?? (k === "depositCents" ? 0 : null))])),
    kmAllowancePerDay: s(v?.kmAllowancePerDay), acquiredAt: v?.acquiredAt ? new Date(v.acquiredAt).toISOString().slice(0, 10) : "",
    showcaseVisible: v?.showcaseVisible ?? false, showcasePricePublic: v?.showcasePricePublic ?? true, showcaseFeatured: v?.showcaseFeatured ?? false,
  } as FormState;
}

type FormState = Record<string, string | boolean>;
const str = (f: FormState, k: string) => String(f[k] ?? "");

function toPayload(f: FormState) {
  return {
    ...f,
    features: str(f, "features").split(",").map((x) => x.trim()).filter(Boolean),
    ...Object.fromEntries(MONEY.map((k) => [k, parseMoneyToCents(str(f, k))])),
    depositCents: parseMoneyToCents(str(f, "depositCents")) ?? 0,
    dailyRateCents: parseMoneyToCents(str(f, "dailyRateCents")) ?? 0,
  } as Record<string, unknown>;
}

/** Cadastro e edição de veículo (seção 29). Dados críticos pedem motivo antes de salvar (seção 104). */
export function VehicleForm({ vehicleId, initial, categories, locations }: { vehicleId?: string; initial?: VehicleFormValues; categories: Option[]; locations: Option[] }) {
  const router = useRouter();
  const [f, setF] = useState(() => toForm(initial));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: "danger" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [askReason, setAskReason] = useState<string[] | null>(null);
  const [reason, setReason] = useState("");
  const original = toForm(initial);

  const set = (k: string) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  const setBool = (k: "showcaseVisible" | "showcasePricePublic" | "showcaseFeatured") => (e: { target: { checked: boolean } }) => setF((x) => ({ ...x, [k]: e.target.checked }));

  async function save(withReason?: string) {
    setBusy(true);
    setMessage(null);
    setErrors({});
    const payload = toPayload(f);
    const res = await fetch(vehicleId ? `/api/vehicles/${vehicleId}` : "/api/vehicles", {
      method: vehicleId ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(vehicleId ? { data: payload, reason: withReason } : payload),
    }).catch(() => null);
    const json = await res?.json().catch(() => null);
    setBusy(false);
    setAskReason(null);
    if (!res?.ok) {
      setErrors(json?.error?.fields ?? {});
      setMessage({ tone: "danger", text: json?.error?.message ?? "Sem conexão. Tente novamente." });
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setReason("");
    if (!vehicleId) {
      router.push(`/admin/veiculos/${json.id}?novo=1`);
      return;
    }
    setMessage({ tone: "success", text: json.changed?.length ? "Alterações salvas e registradas na Vida do Veículo." : "Nada mudou." });
    router.refresh();
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (vehicleId) {
      const payload = toPayload(f);
      const before = toPayload(original);
      const critical = CRITICAL_VEHICLE_FIELDS.filter((k) => JSON.stringify(payload[k] ?? "") !== JSON.stringify(before[k] ?? ""));
      if (critical.length) return setAskReason(critical.map((k) => VEHICLE_FIELD_LABELS[k]!));
    }
    void save();
  }

  const field = (k: string, label: string, props: Record<string, unknown> = {}, span2 = false) => (
    <div className={span2 ? "field span-2" : "field"}>
      <label htmlFor={`v-${k}`}>{label}</label>
      <input id={`v-${k}`} className="input" value={str(f, k)} onChange={set(k)} aria-invalid={Boolean(errors[k])} aria-describedby={errors[k] ? `v-${k}-e` : undefined} {...props} />
      {errors[k] && <span id={`v-${k}-e`} className="error">{errors[k]}</span>}
    </div>
  );
  const money = (k: string, label: string, required = false) => field(k, label, { inputMode: "decimal", placeholder: "0,00", required });

  return (
    <form className="stack" style={{ gap: 16 }} onSubmit={submit} noValidate>
      {message && <Alert tone={message.tone}>{message.text}</Alert>}

      <fieldset className="card card-pad">
        <legend>Identificação</legend>
        <div className="form-grid">
          {field("plate", "Placa *", { autoCapitalize: "characters", placeholder: "ABC1D23", maxLength: 8, required: true })}
          {field("renavam", "RENAVAM", { inputMode: "numeric", maxLength: 11 })}
          {field("chassis", "Chassi", { autoCapitalize: "characters", maxLength: 17 }, true)}
        </div>
      </fieldset>

      <fieldset className="card card-pad">
        <legend>Modelo</legend>
        <div className="form-grid">
          {field("brand", "Marca *", { required: true })}
          {field("model", "Modelo *", { required: true })}
          {field("version", "Versão")}
          {field("color", "Cor")}
          {field("modelYear", "Ano modelo *", { inputMode: "numeric", maxLength: 4, required: true })}
          {field("manufactureYear", "Ano de fabricação", { inputMode: "numeric", maxLength: 4 })}
          <div className="field">
            <label htmlFor="v-categoryId">Categoria</label>
            <select id="v-categoryId" className="select" value={str(f, "categoryId")} onChange={set("categoryId")}>
              <option value="">Sem categoria</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {errors.categoryId && <span className="error">{errors.categoryId}</span>}
          </div>
          {field("seats", "Lugares", { inputMode: "numeric", maxLength: 2 })}
          <div className="field">
            <label htmlFor="v-transmission">Câmbio *</label>
            <select id="v-transmission" className="select" value={str(f, "transmission")} onChange={set("transmission")}>
              {Object.entries(TRANSMISSION_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="v-fuelType">Combustível *</label>
            <select id="v-fuelType" className="select" value={str(f, "fuelType")} onChange={set("fuelType")}>
              {Object.entries(FUEL_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>
          {field("features", "Características (separadas por vírgula)", { placeholder: "Ar-condicionado, Multimídia, Câmera de ré" }, true)}
        </div>
      </fieldset>

      <fieldset className="card card-pad">
        <legend>Operação</legend>
        <div className="form-grid">
          {field("currentKm", "KM atual *", { inputMode: "numeric", required: true })}
          <div className="field">
            <label htmlFor="v-locationId">Localização</label>
            <select id="v-locationId" className="select" value={str(f, "locationId")} onChange={set("locationId")}>
              <option value="">Sem localização</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          {field("kmAllowancePerDay", "KM livre por dia", { inputMode: "numeric", placeholder: "Vazio = ilimitado" })}
          {money("extraKmCents", "Valor do KM excedente (R$)")}
        </div>
      </fieldset>

      <fieldset className="card card-pad">
        <legend>Preços (R$)</legend>
        <div className="form-grid">
          {money("dailyRateCents", "Diária *", true)}
          {money("weeklyRateCents", "Semanal")}
          {money("biweeklyRateCents", "Quinzenal")}
          {money("monthlyRateCents", "Mensal")}
          {money("depositCents", "Caução")}
        </div>
      </fieldset>

      {vehicleId && (
        <fieldset className="card card-pad">
          <legend>Vitrine</legend>
          <label className="check"><input type="checkbox" checked={f.showcaseVisible === true} onChange={setBool("showcaseVisible")} /> Mostrar na vitrine pública</label>
          {errors.showcaseVisible && <span className="error">{errors.showcaseVisible}</span>}
          <label className="check"><input type="checkbox" checked={f.showcasePricePublic === true} onChange={setBool("showcasePricePublic")} /> Mostrar o preço (senão, "sob consulta")</label>
          <label className="check"><input type="checkbox" checked={f.showcaseFeatured === true} onChange={setBool("showcaseFeatured")} /> Destaque na vitrine</label>
        </fieldset>
      )}

      <fieldset className="card card-pad">
        <legend>Aquisição (interno)</legend>
        <div className="form-grid">
          {field("acquiredAt", "Data de aquisição", { type: "date" })}
          {money("acquisitionCents", "Valor de aquisição")}
        </div>
      </fieldset>

      {!vehicleId && <p className="muted" style={{ margin: 0, fontSize: 14 }}>O veículo entra como Inativo e fora da vitrine. Depois de conferir fotos e documentos, mude para Disponível.</p>}
      <div className="actions-bar">
        <Button type="button" variant="ghost" onClick={() => router.back()}>Cancelar</Button>
        <Button type="submit" disabled={busy} aria-busy={busy}>{busy ? "Salvando…" : vehicleId ? "Salvar alterações" : "Cadastrar veículo"}</Button>
      </div>

      <ConfirmDialog
        open={Boolean(askReason)}
        title="Alterar dados críticos?"
        confirmLabel="Confirmar alteração"
        busy={busy}
        confirmDisabled={reason.trim().length < 5}
        onCancel={() => setAskReason(null)}
        onConfirm={() => save(reason.trim())}
      >
        <p style={{ margin: 0 }}>Você está alterando: <strong>{askReason?.join(", ")}</strong>. A mudança fica registrada com o valor anterior, o novo e o motivo.</p>
        <div className="field">
          <label htmlFor="v-reason">Motivo</label>
          <textarea id="v-reason" className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: placa digitada errada no cadastro" maxLength={300} />
        </div>
      </ConfirmDialog>
    </form>
  );
}

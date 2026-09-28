"use client";

import type { MyProfile } from "@foccus/services";
import { useState } from "react";
import { LocationError, clientPlatform, requestCurrentPosition, supportsBackground } from "@/lib/location-tracker";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";

/**
 * Última etapa obrigatória do cadastro: autorização LGPD + permissão de localização do aparelho.
 * O aceite só é gravado com uma posição real, prova de que a permissão foi concedida.
 */
export function LocationStep({ profile, onChange }: { profile: MyProfile; onChange: (p: MyProfile) => void }) {
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const accepted = profile.tracking.acceptedAt;
  const background = typeof window !== "undefined" && supportsBackground();

  async function activate() {
    setBusy(true);
    setError(null);
    try {
      const position = await requestCurrentPosition();
      const res = await fetch("/api/me/tracking", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ version: profile.tracking.terms.version, accepted: true, platform: clientPlatform(), position }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error?.message ?? "Não foi possível registrar a autorização. Tente novamente.");
      const p = await fetch("/api/me/profile").then((r) => r.json());
      onChange(p as MyProfile);
    } catch (e) {
      setError(e instanceof LocationError || e instanceof Error ? e.message : "Não foi possível ativar a localização.");
    } finally {
      setBusy(false);
    }
  }

  if (accepted)
    return (
      <Alert tone="success" title="Localização autorizada">
        Autorizada em {new Date(accepted).toLocaleString("pt-BR")}. Durante a locação o aplicativo envia a localização deste celular junto com o rastreador do veículo.
      </Alert>
    );

  return (
    <div className="stack" style={{ gap: 16 }}>
      <p className="muted" style={{ margin: 0 }}>
        Para concluir o cadastro, ative a localização deste celular. Ela é usada junto com o rastreador GPS do veículo, apenas durante a locação.
      </p>
      <div className="card card-pad stack" style={{ gap: 10, maxHeight: 280, overflowY: "auto" }} tabIndex={0} aria-label={profile.tracking.terms.title}>
        <strong>{profile.tracking.terms.title}</strong>
        {profile.tracking.terms.text.split("\n\n").map((para, i) => <p key={i} style={{ margin: 0, fontSize: 14 }}>{para}</p>)}
        <span className="muted" style={{ fontSize: 12 }}>Versão {profile.tracking.terms.version}</span>
      </div>
      {!background && (
        <Alert tone="warning" title="Pelo navegador a localização só funciona com o app aberto">
          Para o envio em segundo plano durante a locação, instale o aplicativo Foccus Car no celular. Você pode concluir o cadastro por aqui e instalar o app antes da retirada do veículo.
        </Alert>
      )}
      <label style={{ display: "grid", gridTemplateColumns: "20px 1fr", gap: 12, minHeight: 44, cursor: "pointer", alignItems: "start" }}>
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} style={{ width: 20, height: 20, margin: "2px 0 0", accentColor: "var(--fc-accent)" }} />
        <span>Li e autorizo o rastreamento do veículo e o envio da localização deste celular, inclusive em segundo plano, durante as minhas locações.</span>
      </label>
      {error && <Alert tone="danger">{error}</Alert>}
      <Button size="lg" onClick={activate} disabled={!agreed || busy} aria-busy={busy}>
        {busy ? "Ativando localização…" : "Ativar localização e autorizar"}
      </Button>
    </div>
  );
}

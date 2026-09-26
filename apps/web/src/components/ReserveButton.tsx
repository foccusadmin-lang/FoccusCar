"use client";

import { useState } from "react";
import { Button } from "./ui/Button";

type Gate = { code: string; message: string; action?: { label: string; href: string } };

/**
 * Botão de reserva. A decisão de liberar é SEMPRE do servidor (/api/reservations/eligibility);
 * a interface só mostra o resultado (seção 95: nunca confiar apenas na interface).
 */
export function ReserveButton({ vehicleId, available }: { vehicleId: string; available: boolean }) {
  const [loading, setLoading] = useState(false);
  const [gate, setGate] = useState<Gate | null>(null);

  async function onClick() {
    setLoading(true);
    try {
      const res = await fetch("/api/reservations/eligibility", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ vehicleId }),
      });
      const body = await res.json().catch(() => null);
      if (res.status === 401) {
        window.location.href = `/entrar?next=${encodeURIComponent(`/veiculos/${vehicleId}`)}`;
        return;
      }
      if (!res.ok) {
        setGate(body?.error ?? { code: "INTERNAL", message: "Não foi possível concluir esta operação. Tente novamente." });
        return;
      }
      window.location.href = body.next;
    } catch {
      setGate({ code: "NETWORK", message: "Sem conexão com o servidor. Verifique sua internet e tente novamente." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button size="lg" block onClick={onClick} disabled={loading} aria-busy={loading}>
        {loading ? "Verificando…" : available ? "Reservar" : "Reservar próxima data"}
      </Button>
      {gate && (
        <div className="dialog-backdrop" role="presentation" onClick={() => setGate(null)}>
          <div className="dialog card stack" role="dialog" aria-modal="true" aria-labelledby="gate-title" onClick={(e) => e.stopPropagation()} style={{ gap: 16 }}>
            <span className="eyebrow">Quase lá</span>
            <h2 id="gate-title" style={{ fontSize: 22 }}>{gate.message}</h2>
            {gate.code === "PROFILE_REQUIRED" && (
              <p className="muted" style={{ margin: 0 }}>Você já pode navegar pela vitrine. Para reservar, alugar e pagar, precisamos dos seus dados, endereço e CNH.</p>
            )}
            {gate.action && <a className="btn btn-primary btn-lg btn-block" href={gate.action.href}>{gate.action.label}</a>}
            <Button variant="ghost" block onClick={() => setGate(null)}>Continuar navegando</Button>
          </div>
        </div>
      )}
    </>
  );
}

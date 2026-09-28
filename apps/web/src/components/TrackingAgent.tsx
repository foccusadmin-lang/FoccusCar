"use client";

import { useEffect } from "react";
import { startTracking } from "@/lib/location-tracker";

/**
 * Liga o envio da localização do celular quando o servidor diz que há locação em andamento
 * (e desliga sozinho quando ela termina). Confere de novo a cada 5 minutos.
 */
export function TrackingAgent() {
  useEffect(() => {
    let stop: (() => void) | null = null;
    let cancelled = false;
    const check = async () => {
      if (stop || cancelled) return;
      try {
        const res = await fetch("/api/me/tracking", { credentials: "include" });
        if (!res.ok) return;
        const body = (await res.json()) as { decision: { track: boolean } };
        if (body.decision.track && !cancelled && !stop) stop = startTracking({ onStop: () => (stop = null) });
      } catch {
        /* sem internet: tenta de novo no próximo ciclo */
      }
    };
    void check();
    const timer = setInterval(() => void check(), 5 * 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
      stop?.();
    };
  }, []);
  return null;
}

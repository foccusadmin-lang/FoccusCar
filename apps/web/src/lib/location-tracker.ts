"use client";

/**
 * Localização do celular do cliente (camada complementar ao rastreador do veículo).
 *
 * - No aplicativo instalado (Capacitor, Android/iOS) usa o plugin nativo de localização em
 *   segundo plano: o sistema mostra uma notificação fixa enquanto a locação está em andamento.
 * - No navegador/PWA só funciona com a tela aberta (limite do navegador), por isso é plano B.
 *
 * O servidor decide se deve rastrear: fora de uma locação em andamento ele responde
 * `track: false` e o envio para sozinho.
 */
import type { ClientPlatform } from "@foccus/core";

export interface PositionJson {
  latitude: number;
  longitude: number;
  accuracyM?: number;
  speedKmh?: number;
  heading?: number;
  recordedAt: string;
}

interface NativeLocation {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  speed?: number | null;
  bearing?: number | null;
  time?: number | null;
}

interface BackgroundGeolocationPlugin {
  addWatcher(
    options: { backgroundMessage?: string; backgroundTitle?: string; requestPermissions?: boolean; stale?: boolean; distanceFilter?: number },
    callback: (location?: NativeLocation, error?: { code?: string; message?: string }) => void,
  ): Promise<string>;
  removeWatcher(options: { id: string }): Promise<void>;
  openSettings(): Promise<void>;
}

interface CapacitorGlobal {
  isNativePlatform(): boolean;
  getPlatform(): string;
  Plugins: { BackgroundGeolocation?: BackgroundGeolocationPlugin };
}

/** O app nativo injeta `window.Capacitor` ao carregar o site; no navegador ele não existe. */
function capacitor(): CapacitorGlobal | null {
  const c = (globalThis as { Capacitor?: CapacitorGlobal }).Capacitor;
  return c?.isNativePlatform?.() ? c : null;
}

function nativePlugin() {
  return capacitor()?.Plugins.BackgroundGeolocation ?? null;
}

export function clientPlatform(): ClientPlatform {
  const p = capacitor()?.getPlatform();
  return p === "android" ? "ANDROID" : p === "ios" ? "IOS" : "WEB";
}

/** Consegue enviar a localização com o app fechado/minimizado? */
export function supportsBackground(): boolean {
  return Boolean(nativePlugin());
}

export class LocationError extends Error {
  constructor(message: string, readonly code: "DENIED" | "UNAVAILABLE" | "TIMEOUT" | "UNSUPPORTED") {
    super(message);
  }
}

const MSG = {
  DENIED: "A permissão de localização foi negada. Abra as configurações do celular, permita a localização para a Foccus Car (de preferência \"Permitir o tempo todo\") e tente de novo.",
  UNAVAILABLE: "Não conseguimos obter sua localização. Ligue o GPS do celular e tente de novo.",
  TIMEOUT: "A localização demorou para responder. Vá para um local aberto ou perto de uma janela e tente de novo.",
  UNSUPPORTED: "Este navegador não oferece localização. Instale o aplicativo Foccus Car para concluir.",
};

function fromNative(l: NativeLocation): PositionJson {
  return {
    latitude: l.latitude,
    longitude: l.longitude,
    accuracyM: l.accuracy ?? undefined,
    speedKmh: l.speed != null && l.speed >= 0 ? l.speed * 3.6 : undefined,
    heading: l.bearing != null && l.bearing >= 0 ? l.bearing : undefined,
    recordedAt: new Date(l.time ?? Date.now()).toISOString(),
  };
}

function fromBrowser(p: GeolocationPosition): PositionJson {
  const c = p.coords;
  return {
    latitude: c.latitude,
    longitude: c.longitude,
    accuracyM: c.accuracy ?? undefined,
    speedKmh: c.speed != null && c.speed >= 0 ? c.speed * 3.6 : undefined,
    heading: c.heading != null && !Number.isNaN(c.heading) ? c.heading : undefined,
    recordedAt: new Date(p.timestamp).toISOString(),
  };
}

/** Pede a permissão e devolve uma posição atual (usado no aceite do cadastro). */
export async function requestCurrentPosition(timeoutMs = 25_000): Promise<PositionJson> {
  const plugin = nativePlugin();
  if (plugin) {
    return new Promise((resolve, reject) => {
      let watcher: string | null = null;
      let settled = false;
      const finish = (fn: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (watcher) void plugin.removeWatcher({ id: watcher });
        fn();
      };
      const timer = setTimeout(() => finish(() => reject(new LocationError(MSG.TIMEOUT, "TIMEOUT"))), timeoutMs);
      void plugin
        .addWatcher({ requestPermissions: true, stale: false }, (loc, err) => {
          if (err) {
            const denied = err.code === "NOT_AUTHORIZED";
            if (denied) void plugin.openSettings();
            return finish(() => reject(new LocationError(denied ? MSG.DENIED : MSG.UNAVAILABLE, denied ? "DENIED" : "UNAVAILABLE")));
          }
          if (loc) finish(() => resolve(fromNative(loc)));
        })
        .then((id) => {
          watcher = id;
          if (settled) void plugin.removeWatcher({ id });
        });
    });
  }
  if (typeof navigator === "undefined" || !navigator.geolocation) throw new LocationError(MSG.UNSUPPORTED, "UNSUPPORTED");
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve(fromBrowser(p)),
      (e) => {
        const code = e.code === e.PERMISSION_DENIED ? "DENIED" : e.code === e.TIMEOUT ? "TIMEOUT" : "UNAVAILABLE";
        reject(new LocationError(MSG[code], code));
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 },
    );
  });
}

/**
 * Envia a localização durante a locação. Junta os pontos e manda em lotes; sem internet
 * os pontos ficam guardados na memória até a próxima tentativa (até 500).
 * Devolve uma função para parar.
 */
export function startTracking(opts: { onStop?: (reason: string) => void; flushEveryMs?: number } = {}): () => void {
  const plugin = nativePlugin();
  const platform = clientPlatform();
  const source = plugin ? "BACKGROUND" : "FOREGROUND";
  let buffer: PositionJson[] = [];
  let stopped = false;
  let sending = false;
  let watcher: string | number | null = null;

  const stop = (reason: string) => {
    if (stopped) return;
    stopped = true;
    clearInterval(interval);
    if (plugin && typeof watcher === "string") void plugin.removeWatcher({ id: watcher });
    if (!plugin && typeof watcher === "number") navigator.geolocation.clearWatch(watcher);
    opts.onStop?.(reason);
  };

  const flush = async () => {
    if (sending || stopped || buffer.length === 0) return;
    sending = true;
    const batch = buffer.slice(0, 200);
    try {
      const res = await fetch("/api/me/locations", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ platform, source, positions: batch }),
      });
      if (res.ok) {
        buffer = buffer.slice(batch.length);
        const body = (await res.json()) as { track: boolean; reason?: string };
        if (!body.track) stop(body.reason ?? "NO_ACTIVE_RENTAL");
      } else if (res.status === 401 || res.status === 403) stop("UNAUTHENTICATED");
    } catch {
      /* sem internet: tenta de novo no próximo ciclo */
    } finally {
      sending = false;
    }
  };

  const push = (p: PositionJson) => {
    buffer.push(p);
    if (buffer.length > 500) buffer = buffer.slice(-500);
    if (buffer.length >= 20) void flush();
  };

  if (plugin) {
    void plugin
      .addWatcher(
        {
          backgroundTitle: "Locação em andamento",
          backgroundMessage: "A Foccus Car está acompanhando a localização durante a sua locação, para sua segurança.",
          requestPermissions: true,
          stale: false,
          distanceFilter: 50,
        },
        (loc, err) => {
          if (err?.code === "NOT_AUTHORIZED") return stop("PERMISSION_DENIED");
          if (loc) push(fromNative(loc));
        },
      )
      .then((id) => {
        watcher = id;
        if (stopped) void plugin.removeWatcher({ id });
      });
  } else if (typeof navigator !== "undefined" && navigator.geolocation) {
    watcher = navigator.geolocation.watchPosition(
      (p) => push(fromBrowser(p)),
      (e) => {
        if (e.code === e.PERMISSION_DENIED) stop("PERMISSION_DENIED");
      },
      { enableHighAccuracy: true, maximumAge: 30_000 },
    );
  } else {
    queueMicrotask(() => stop("UNSUPPORTED"));
  }

  const interval = setInterval(() => void flush(), opts.flushEveryMs ?? 60_000);
  return () => {
    void flush();
    stop("STOPPED");
  };
}

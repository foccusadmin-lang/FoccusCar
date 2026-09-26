"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

type Profile = { email: string; label: string; hint: string; area: string };

/** Ambiente de testes (DEMO_MODE): entra com um toque em cada perfil de demonstração. */
export function DemoLogins({ profiles, password }: { profiles: Profile[]; password: string }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function enter(p: Profile) {
    setBusy(p.email);
    setError(null);
    const { error } = await authClient.signIn.email({ email: p.email, password });
    if (error) {
      setError(error.status === 429 ? "Muitas tentativas seguidas. Aguarde um minuto." : "Não foi possível entrar. Os dados de demonstração foram instalados?");
      setBusy(null);
      return;
    }
    window.location.href = p.area;
  }

  return (
    <section className="card card-pad stack demo-logins" aria-labelledby="demo-title" style={{ gap: 12 }}>
      <div className="stack" style={{ gap: 4 }}>
        <span className="eyebrow">Ambiente de testes</span>
        <h2 id="demo-title" style={{ fontSize: 20, margin: 0 }}>Entrar como</h2>
        <p className="muted" style={{ margin: 0, fontSize: 14 }}>
          Dados fictícios. Todos os usuários usam a senha <strong>{password}</strong>.
        </p>
      </div>
      <div className="demo-grid">
        {profiles.map((p) => (
          <button key={p.email} type="button" className="demo-profile" onClick={() => enter(p)} disabled={busy !== null}>
            <strong>{busy === p.email ? "Entrando…" : p.label}</strong>
            <span>{p.hint}</span>
            <small>{p.email}</small>
          </button>
        ))}
      </div>
      {error && <p role="alert" className="muted" style={{ margin: 0, color: "#f09a97" }}>{error}</p>}
    </section>
  );
}

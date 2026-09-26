"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "../ui/Button";

/** Dar acesso à equipe: a pessoa cria a conta em Entrar e o administrador a encontra pelo e-mail. */
export function UserLookup() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/users/lookup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) }).catch(() => null);
    const json = await res?.json().catch(() => null);
    setBusy(false);
    if (!res?.ok) return setError(json?.error?.fields?.[""] ?? json?.error?.message ?? "Sem conexão. Tente novamente.");
    router.push(`/admin/usuarios/${json.id}`);
  }

  return (
    <form className="card card-pad stack" onSubmit={submit} style={{ gap: 10, padding: 16 }}>
      <strong>Dar acesso a alguém da equipe</strong>
      <p className="muted" style={{ margin: 0, fontSize: 14 }}>A pessoa cria a conta em Entrar e confirma o e-mail. Depois, busque pelo e-mail para conceder o perfil.</p>
      <div className="row" style={{ alignItems: "flex-end" }}>
        <div className="field" style={{ flex: "1 1 240px" }}>
          <label htmlFor="lookup-email">E-mail da conta</label>
          <input id="lookup-email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="off" />
        </div>
        <Button type="submit" variant="secondary" disabled={busy || !email}>{busy ? "Buscando…" : "Buscar conta"}</Button>
      </div>
      {error && <span role="alert" className="error">{error}</span>}
    </form>
  );
}

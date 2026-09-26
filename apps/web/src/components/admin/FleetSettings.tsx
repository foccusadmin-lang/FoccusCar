"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";

type Category = { id: string; name: string; requiredCnhCategory: string };
type Location = { id: string; name: string; city: string | null; state: string | null };

function useCreate(url: string) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: "danger" | "success"; text: string } | null>(null);
  async function submit(e: FormEvent<HTMLFormElement>, ok: string) {
    e.preventDefault();
    const form = e.currentTarget;
    setBusy(true);
    setErrors({});
    setMessage(null);
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(Object.fromEntries(new FormData(form))) }).catch(() => null);
    const json = await res?.json().catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      setErrors(json?.error?.fields ?? {});
      return setMessage({ tone: "danger", text: json?.error?.message ?? "Sem conexão. Tente novamente." });
    }
    form.reset();
    setMessage({ tone: "success", text: ok });
    router.refresh();
  }
  return { busy, errors, message, submit };
}

export function FleetSettings({ categories, locations }: { categories: Category[]; locations: Location[] }) {
  const cat = useCreate("/api/vehicle-categories");
  const loc = useCreate("/api/locations");
  return (
    <div className="stack" style={{ gap: 24 }}>
      <section className="card card-pad stack" style={{ gap: 14 }} aria-labelledby="cat-h">
        <h2 id="cat-h" style={{ fontSize: 18 }}>Categorias</h2>
        <ul className="stack" style={{ listStyle: "none", margin: 0, padding: 0, gap: 6 }}>
          {categories.length === 0 && <li className="muted">Nenhuma categoria ainda.</li>}
          {categories.map((c) => <li key={c.id} className="row" style={{ justifyContent: "space-between" }}><span>{c.name}</span><span className="muted" style={{ fontSize: 13 }}>CNH {c.requiredCnhCategory}</span></li>)}
        </ul>
        {cat.message && <Alert tone={cat.message.tone}>{cat.message.text}</Alert>}
        <form className="form-grid" onSubmit={(e) => cat.submit(e, "Categoria criada.")} noValidate>
          <div className="field"><label htmlFor="c-name">Nova categoria</label><input id="c-name" name="name" className="input" required placeholder="Ex.: Picape" />{cat.errors.name && <span className="error">{cat.errors.name}</span>}</div>
          <div className="field">
            <label htmlFor="c-cnh">CNH exigida</label>
            <select id="c-cnh" name="requiredCnhCategory" className="select" defaultValue="B">{["A", "B", "C", "D", "E"].map((x) => <option key={x}>{x}</option>)}</select>
          </div>
          <div className="span-2"><Button type="submit" variant="secondary" disabled={cat.busy}>Adicionar categoria</Button></div>
        </form>
      </section>
      <section className="card card-pad stack" style={{ gap: 14 }} aria-labelledby="loc-h">
        <h2 id="loc-h" style={{ fontSize: 18 }}>Localizações</h2>
        <ul className="stack" style={{ listStyle: "none", margin: 0, padding: 0, gap: 6 }}>
          {locations.length === 0 && <li className="muted">Nenhuma localização ainda.</li>}
          {locations.map((l) => <li key={l.id} className="row" style={{ justifyContent: "space-between" }}><span>{l.name}</span><span className="muted" style={{ fontSize: 13 }}>{[l.city, l.state].filter(Boolean).join("/")}</span></li>)}
        </ul>
        {loc.message && <Alert tone={loc.message.tone}>{loc.message.text}</Alert>}
        <form className="form-grid" onSubmit={(e) => loc.submit(e, "Localização criada.")} noValidate>
          <div className="field"><label htmlFor="l-name">Nome</label><input id="l-name" name="name" className="input" required placeholder="Ex.: Loja Aeroporto" />{loc.errors.name && <span className="error">{loc.errors.name}</span>}</div>
          <div className="field"><label htmlFor="l-address">Endereço</label><input id="l-address" name="address" className="input" /></div>
          <div className="field"><label htmlFor="l-city">Cidade</label><input id="l-city" name="city" className="input" /></div>
          <div className="field"><label htmlFor="l-state">UF</label><input id="l-state" name="state" className="input" maxLength={2} />{loc.errors.state && <span className="error">{loc.errors.state}</span>}</div>
          <div className="span-2"><Button type="submit" variant="secondary" disabled={loc.busy}>Adicionar localização</Button></div>
        </form>
      </section>
    </div>
  );
}

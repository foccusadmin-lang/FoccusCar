"use client";

import { addressSchema, cnhSchema, personalSchema } from "@foccus/core";
import type { MyProfile } from "@foccus/services";
import { useMemo, useState, type ReactNode } from "react";
import type { ZodType } from "zod";
import { ACCOUNT_STATUS_LABEL } from "@/lib/format";
import { maskCep, maskCnh, maskCpfInput, maskPhone } from "@/lib/masks";
import { Alert } from "../ui/Alert";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Stepper } from "../ui/Stepper";
import { DocumentsStep } from "./DocumentsStep";
import { LocationStep } from "./LocationStep";

type Fields = Record<string, string>;
type Errors = Record<string, string>;

const STEPS = ["Dados pessoais", "Endereço", "CNH", "Documentos", "Localização", "Revisão"] as const;
const CNH_CATEGORIES = ["A", "B", "AB", "C", "D", "E", "AC", "AD", "AE", "ACC"];
const UFS = "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" ");

function validate(schema: ZodType, values: Fields): Errors {
  const r = schema.safeParse(values);
  if (r.success) return {};
  return Object.fromEntries(r.error.issues.map((i) => [String(i.path[0]), i.message]));
}

async function api<T>(url: string, init?: RequestInit): Promise<{ ok: true; data: T } | { ok: false; message: string; fields?: Errors; status: number }> {
  try {
    const res = await fetch(url, init);
    const body = await res.json().catch(() => null);
    if (res.ok) return { ok: true, data: body as T };
    return { ok: false, status: res.status, message: body?.error?.message ?? "Não foi possível concluir esta operação. Tente novamente.", fields: body?.error?.fields };
  } catch {
    return { ok: false, status: 0, message: "Sem conexão com o servidor. Verifique sua internet e tente novamente." };
  }
}

function Field(props: { id: string; label: string; error?: string; hint?: string; span2?: boolean; children: ReactNode }) {
  return (
    <div className={["field", props.span2 && "span-2"].filter(Boolean).join(" ")}>
      <label htmlFor={props.id}>{props.label}</label>
      {props.children}
      {props.error ? <span className="error" id={`${props.id}-error`} role="alert">{props.error}</span> : props.hint ? <span className="muted" style={{ fontSize: 13 }}>{props.hint}</span> : null}
    </div>
  );
}

export function ProfileWizard({ initial }: { initial: MyProfile }) {
  const [profile, setProfile] = useState(initial);
  const locked = profile.identityLocked;
  const firstStep = profile.status === "UNDER_REVIEW" || profile.status === "ACTIVE"
    ? (profile.progress.trackingConsent ? 5 : 4)
    : !profile.progress.profileSaved ? 0 : profile.progress.documentsReady ? 4 : 3;
  const [step, setStep] = useState(firstStep);
  const [errors, setErrors] = useState<Errors>({});
  const [message, setMessage] = useState<{ tone: "danger" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const [personal, setPersonal] = useState<Fields>({
    fullName: profile.personal?.fullName ?? profile.account.name ?? "",
    cpf: maskCpfInput(profile.personal?.cpf ?? ""),
    birthDate: profile.personal?.birthDate ?? "",
    phone: maskPhone(profile.personal?.phone ?? ""),
    whatsapp: maskPhone(profile.personal?.whatsapp ?? ""),
    email: profile.personal?.email ?? profile.account.email,
  });
  const [address, setAddress] = useState<Fields>({
    zip: maskCep(profile.address?.zip ?? ""),
    street: profile.address?.street ?? "",
    number: profile.address?.number ?? "",
    complement: profile.address?.complement ?? "",
    district: profile.address?.district ?? "",
    city: profile.address?.city ?? "",
    state: profile.address?.state ?? "",
  });
  const [cnh, setCnh] = useState<Fields>({
    number: profile.cnh?.number ?? "",
    categories: profile.cnh?.categories ?? "B",
    issuedAt: profile.cnh?.issuedAt ?? "",
    expiresAt: profile.cnh?.expiresAt ?? "",
  });
  const [sameWhatsapp, setSameWhatsapp] = useState(!profile.personal || profile.personal.phone === profile.personal.whatsapp);

  const done = useMemo(
    () => [
      Object.keys(validate(personalSchema, { ...personal, whatsapp: sameWhatsapp ? personal.phone! : personal.whatsapp! })).length === 0,
      Object.keys(validate(addressSchema, address)).length === 0,
      profile.progress.profileSaved,
      profile.progress.missingDocuments.length === 0 && profile.progress.rejectedDocuments.length === 0,
      profile.progress.trackingConsent,
      profile.status === "UNDER_REVIEW" || profile.status === "ACTIVE",
    ],
    [personal, address, profile, sameWhatsapp],
  );

  const personalValues = () => ({ ...personal, whatsapp: sameWhatsapp ? personal.phone! : personal.whatsapp! });

  function go(to: number) {
    setErrors({});
    setMessage(null);
    setStep(to);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function lookupCep(zip: string) {
    const d = zip.replace(/\D/g, "");
    if (d.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${d}/json/`);
      const data = await res.json();
      if (data.erro) return setErrors((e) => ({ ...e, zip: "CEP não encontrado. Confira ou preencha o endereço manualmente." }));
      setAddress((a) => ({ ...a, street: data.logradouro || a.street, district: data.bairro || a.district, city: data.localidade || a.city, state: data.uf || a.state }));
      setErrors((e) => ({ ...e, zip: "" }));
    } catch {
      /* sem internet: o usuário preenche manualmente */
    }
  }

  function next(schema: ZodType, values: Fields) {
    const errs = validate(schema, values);
    setErrors(errs);
    if (Object.keys(errs).length) {
      setMessage({ tone: "danger", text: "Confira os campos destacados." });
      return;
    }
    go(step + 1);
  }

  async function saveAll() {
    const errs = validate(cnhSchema, cnh);
    setErrors(errs);
    if (Object.keys(errs).length) return setMessage({ tone: "danger", text: "Confira os campos destacados." });
    setBusy(true);
    const r = await api<MyProfile>("/api/me/profile", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ personal: personalValues(), address, cnh }),
    });
    setBusy(false);
    if (!r.ok) {
      const flat: Errors = {};
      for (const [k, v] of Object.entries(r.fields ?? {})) flat[k.split(".").pop()!] = v;
      setErrors(flat);
      setMessage({ tone: "danger", text: r.message });
      if (flat.cpf || flat.fullName || flat.birthDate || flat.phone) setStep(0);
      else if (flat.zip || flat.street) setStep(1);
      return;
    }
    setProfile(r.data);
    go(3);
  }

  async function submit() {
    setBusy(true);
    const r = await api<{ status: string }>("/api/me/submit", { method: "POST" });
    if (r.ok) {
      const p = await api<MyProfile>("/api/me/profile");
      if (p.ok) setProfile(p.data);
      setMessage({ tone: "success", text: "Cadastro enviado! Avisaremos assim que a análise terminar." });
    } else setMessage({ tone: "danger", text: r.message });
    setBusy(false);
  }

  const input = (
    state: Fields,
    set: (f: (s: Fields) => Fields) => void,
    key: string,
    extra: React.InputHTMLAttributes<HTMLInputElement> & { mask?: (v: string) => string } = {},
  ) => {
    const { mask, ...rest } = extra;
    return (
      <input
        id={key}
        className="input"
        value={state[key] ?? ""}
        aria-invalid={Boolean(errors[key])}
        aria-describedby={errors[key] ? `${key}-error` : undefined}
        onChange={(e) => {
          const v = mask ? mask(e.target.value) : e.target.value;
          set((s) => ({ ...s, [key]: v }));
        }}
        {...rest}
      />
    );
  };

  const statusTone = profile.status === "ACTIVE" ? "success" : profile.status === "UNDER_REVIEW" ? "info" : "warning";
  const rejected = profile.documents.filter((d) => d.status === "REJECTED");

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <Badge tone={statusTone}>{ACCOUNT_STATUS_LABEL[profile.status]}</Badge>
        <span className="muted" style={{ fontSize: 14 }}>{profile.account.email}</span>
      </div>

      {profile.status === "PROFILE_INCOMPLETE" && rejected.length === 0 && (
        <Alert tone="warning" title="Complete seu cadastro para continuar.">
          Você já pode navegar pela vitrine. Reservas, locações e pagamentos são liberados depois que o cadastro for aprovado.
        </Alert>
      )}
      {rejected.length > 0 && profile.status === "PROFILE_INCOMPLETE" && (
        <Alert tone="danger" title="Alguns documentos precisam ser reenviados">
          {rejected.map((d) => <div key={d.id}><strong>{d.label}:</strong> {d.rejectionReason}</div>)}
        </Alert>
      )}
      {profile.status === "UNDER_REVIEW" && (
        <Alert tone="success" title="Cadastro em análise">Recebemos seus dados e documentos. Avisaremos por e-mail e aqui no app assim que a análise terminar.</Alert>
      )}
      {profile.status === "ACTIVE" && (
        <Alert tone="success" title="Cadastro aprovado">
          Tudo certo! Você já pode reservar veículos. <a href="/#frota" style={{ color: "var(--fc-accent)", fontWeight: 600 }}>Ver veículos</a>
        </Alert>
      )}
      {message && <Alert tone={message.tone}>{message.text}</Alert>}

      <Stepper steps={STEPS.map((label, i) => ({ label, done: done[i]! }))} current={step} onSelect={(i) => (i <= 3 || profile.progress.profileSaved ? go(i) : undefined)} />

      <section className="card card-pad stack" style={{ gap: 18 }} aria-labelledby="step-title">
        <h2 id="step-title" style={{ fontSize: 22 }}>{STEPS[step]}</h2>

        {step === 0 && (
          <>
            {locked && <p className="muted" style={{ margin: 0 }}>Nome, CPF e nascimento não podem ser alterados após o envio. Fale com a locadora se precisar corrigir.</p>}
            <div className="form-grid">
              <Field id="fullName" label="Nome completo" error={errors.fullName} span2>
                {input(personal, setPersonal, "fullName", { autoComplete: "name", readOnly: locked })}
              </Field>
              <Field id="cpf" label="CPF" error={errors.cpf}>
                {input(personal, setPersonal, "cpf", { inputMode: "numeric", mask: maskCpfInput, placeholder: "000.000.000-00", readOnly: locked })}
              </Field>
              <Field id="birthDate" label="Data de nascimento" error={errors.birthDate}>
                {input(personal, setPersonal, "birthDate", { type: "date", autoComplete: "bday", readOnly: locked })}
              </Field>
              <Field id="phone" label="Telefone celular" error={errors.phone}>
                {input(personal, setPersonal, "phone", { inputMode: "tel", autoComplete: "tel-national", mask: maskPhone, placeholder: "(11) 99999-9999" })}
              </Field>
              <Field id="email" label="E-mail para contato" error={errors.email}>
                {input(personal, setPersonal, "email", { type: "email", inputMode: "email", autoComplete: "email" })}
              </Field>
              <label className="row span-2" style={{ gap: 10, minHeight: 44, cursor: "pointer" }}>
                <input type="checkbox" checked={sameWhatsapp} onChange={(e) => setSameWhatsapp(e.target.checked)} style={{ width: 20, height: 20, accentColor: "var(--fc-accent)" }} />
                O WhatsApp é o mesmo número do celular
              </label>
              {!sameWhatsapp && (
                <Field id="whatsapp" label="WhatsApp" error={errors.whatsapp}>
                  {input(personal, setPersonal, "whatsapp", { inputMode: "tel", mask: maskPhone, placeholder: "(11) 99999-9999" })}
                </Field>
              )}
            </div>
            <div className="actions-bar">
              <span />
              <Button size="lg" onClick={() => next(personalSchema, personalValues())}>Continuar</Button>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <div className="form-grid">
              <Field id="zip" label="CEP" error={errors.zip} hint="Preenchemos o endereço automaticamente.">
                {input(address, setAddress, "zip", { inputMode: "numeric", autoComplete: "postal-code", mask: maskCep, placeholder: "00000-000", onBlur: (e) => lookupCep(e.target.value) })}
              </Field>
              <Field id="state" label="Estado" error={errors.state}>
                <select id="state" className="select" value={address.state} onChange={(e) => setAddress((a) => ({ ...a, state: e.target.value }))}>
                  <option value="">Selecione</option>
                  {UFS.map((uf) => <option key={uf}>{uf}</option>)}
                </select>
              </Field>
              <Field id="street" label="Endereço" error={errors.street} span2>
                {input(address, setAddress, "street", { autoComplete: "address-line1" })}
              </Field>
              <Field id="number" label="Número" error={errors.number}>
                {input(address, setAddress, "number", { inputMode: "numeric" })}
              </Field>
              <Field id="complement" label="Complemento (opcional)" error={errors.complement}>
                {input(address, setAddress, "complement", { autoComplete: "address-line2" })}
              </Field>
              <Field id="district" label="Bairro" error={errors.district}>
                {input(address, setAddress, "district")}
              </Field>
              <Field id="city" label="Cidade" error={errors.city}>
                {input(address, setAddress, "city", { autoComplete: "address-level2" })}
              </Field>
            </div>
            <div className="actions-bar">
              <Button variant="ghost" onClick={() => go(0)}>Voltar</Button>
              <Button size="lg" onClick={() => next(addressSchema, address)}>Continuar</Button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            {locked && <p className="muted" style={{ margin: 0 }}>Os dados da CNH não podem ser alterados após o envio.</p>}
            <div className="form-grid">
              <Field id="number" label="Número da CNH (registro)" error={errors.number} hint="11 dígitos, no campo nº registro.">
                {input(cnh, setCnh, "number", { inputMode: "numeric", mask: maskCnh, readOnly: locked })}
              </Field>
              <Field id="categories" label="Categoria" error={errors.categories}>
                <select id="categories" className="select" value={cnh.categories} disabled={locked} onChange={(e) => setCnh((c) => ({ ...c, categories: e.target.value }))}>
                  {CNH_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </Field>
              <Field id="issuedAt" label="Data de emissão" error={errors.issuedAt}>
                {input(cnh, setCnh, "issuedAt", { type: "date", readOnly: locked })}
              </Field>
              <Field id="expiresAt" label="Validade" error={errors.expiresAt}>
                {input(cnh, setCnh, "expiresAt", { type: "date", readOnly: locked })}
              </Field>
            </div>
            <div className="actions-bar">
              <Button variant="ghost" onClick={() => go(1)}>Voltar</Button>
              <Button size="lg" onClick={saveAll} disabled={busy} aria-busy={busy}>{busy ? "Salvando…" : "Salvar e continuar"}</Button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <DocumentsStep profile={profile} onChange={setProfile} />
            <div className="actions-bar">
              <Button variant="ghost" onClick={() => go(2)}>Voltar</Button>
              <Button size="lg" onClick={() => go(4)} disabled={!done[3]}>Continuar</Button>
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <LocationStep profile={profile} onChange={setProfile} />
            <div className="actions-bar">
              <Button variant="ghost" onClick={() => go(3)}>Voltar</Button>
              <Button size="lg" onClick={() => go(5)} disabled={!done[4]}>Revisar e enviar</Button>
            </div>
          </>
        )}

        {step === 5 && (
          <>
            {!profile.progress.trackingConsent && (
              <Alert tone="warning" title="Falta autorizar a localização">
                O rastreamento pelo veículo e pelo celular é obrigatório para alugar. <button type="button" onClick={() => go(4)} style={{ background: "none", border: 0, padding: 0, color: "var(--fc-accent)", fontWeight: 600, cursor: "pointer" }}>Ativar agora</button>
              </Alert>
            )}
            <div className="summary stack" style={{ gap: 16 }}>
              <dl>
                <dt>Nome</dt><dd>{profile.personal?.fullName ?? "—"}</dd>
                <dt>CPF</dt><dd>{profile.personal?.cpf ? maskCpfInput(profile.personal.cpf) : "—"}</dd>
                <dt>Celular</dt><dd>{profile.personal?.phone ? maskPhone(profile.personal.phone) : "—"}</dd>
                <dt>Endereço</dt><dd>{profile.address ? `${profile.address.street}, ${profile.address.number} · ${profile.address.district} · ${profile.address.city}/${profile.address.state}` : "—"}</dd>
                <dt>CNH</dt><dd>{profile.cnh ? `${profile.cnh.number} · categoria ${profile.cnh.categories} · válida até ${profile.cnh.expiresAt?.split("-").reverse().join("/")}` : "—"}</dd>
              </dl>
              <div className="row">
                {profile.requiredDocuments.map((r) => {
                  const d = profile.documents.find((x) => x.type === r.type);
                  const tone = d?.status === "APPROVED" ? "success" : d?.status === "REJECTED" ? "danger" : d ? "info" : "warning";
                  return <Badge key={r.type} tone={tone}>{r.label}</Badge>;
                })}
                <Badge tone={profile.progress.trackingConsent ? "success" : "warning"}>Localização</Badge>
              </div>
            </div>
            {(profile.status === "PROFILE_INCOMPLETE" || profile.status === "REGISTERED" || profile.status === "PROFILE_COMPLETE") && (
              <div className="actions-bar">
                <Button variant="ghost" onClick={() => go(4)}>Voltar</Button>
                <Button size="lg" onClick={submit} disabled={busy || !profile.progress.readyToSubmit} aria-busy={busy}>
                  {busy ? "Enviando…" : "Enviar para análise"}
                </Button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

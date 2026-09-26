"use client";

import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { Alert } from "./ui/Alert";
import { Button } from "./ui/Button";

type Providers = { google: boolean; microsoft: boolean; apple: boolean };

const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
);
const MicrosoftIcon = () => (
  <svg width="18" height="18" viewBox="0 0 21 21" aria-hidden><rect x="1" y="1" width="9" height="9" fill="#f25022"/><rect x="11" y="1" width="9" height="9" fill="#7fba00"/><rect x="1" y="11" width="9" height="9" fill="#00a4ef"/><rect x="11" y="11" width="9" height="9" fill="#ffb900"/></svg>
);
const AppleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 384 512" aria-hidden fill="currentColor"><path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/></svg>
);

export function LoginPanel({ providers, next }: { providers: Providers; next: string }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const anySocial = providers.google || providers.microsoft || providers.apple;

  async function social(provider: "google" | "microsoft" | "apple") {
    setError(null);
    setLoading(true);
    const { error } = await authClient.signIn.social({ provider, callbackURL: next, newUserCallbackURL: "/cadastro" });
    if (error) {
      setError("Não foi possível conectar com o provedor agora. Tente novamente.");
      setLoading(false);
    }
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    setLoading(true);
    const result =
      mode === "signin"
        ? await authClient.signIn.email({ email, password, callbackURL: next })
        : await authClient.signUp.email({ email, password, name: String(form.get("name") ?? ""), callbackURL: "/cadastro" });
    setLoading(false);
    if (result.error) {
      const status = result.error.status;
      setError(
        status === 401 ? "E-mail ou senha incorretos."
        : status === 403 ? "Confirme seu e-mail antes de entrar. Enviamos um link para a sua caixa de entrada."
        : status === 422 ? "Já existe uma conta com este e-mail. Entre ou recupere a senha."
        : status === 429 ? "Muitas tentativas. Aguarde um minuto e tente novamente."
        : result.error.message ?? "Não foi possível concluir. Tente novamente.",
      );
      return;
    }
    if (mode === "signup" && !result.data?.token) {
      setInfo("Conta criada. Enviamos um link de confirmação para o seu e-mail.");
      return;
    }
    window.location.href = mode === "signup" ? "/cadastro" : next;
  }

  return (
    <div className="card card-pad auth-card stack" style={{ gap: 20 }}>
      <div className="stack" style={{ gap: 6, textAlign: "center" }}>
        <span className="eyebrow">Foccus Car</span>
        <h1 style={{ fontSize: 26 }}>{mode === "signin" ? "Entrar na sua conta" : "Criar sua conta"}</h1>
        <p className="muted" style={{ margin: 0, fontSize: 15 }}>Use sua conta Google, Microsoft (Outlook/Hotmail), Apple ou e-mail.</p>
      </div>

      {error && <Alert tone="danger">{error}</Alert>}
      {info && <Alert tone="success">{info}</Alert>}

      {anySocial && (
        <div className="stack" style={{ gap: 10 }}>
          {providers.google && (
            <Button size="lg" block className="provider-btn" onClick={() => social("google")} disabled={loading}>
              <GoogleIcon /> Continuar com Google
            </Button>
          )}
          {providers.microsoft && (
            <Button size="lg" variant="secondary" block className="provider-btn" onClick={() => social("microsoft")} disabled={loading}>
              <MicrosoftIcon /> Continuar com Microsoft
            </Button>
          )}
          {providers.apple && (
            <Button size="lg" variant="secondary" block className="provider-btn" onClick={() => social("apple")} disabled={loading}>
              <AppleIcon /> Continuar com Apple
            </Button>
          )}
          <div className="gold-rule" style={{ margin: "6px 0" }}>ou</div>
        </div>
      )}

      <form className="stack" style={{ gap: 14 }} onSubmit={onSubmit}>
        {mode === "signup" && (
          <div className="field">
            <label htmlFor="name">Nome</label>
            <input id="name" name="name" className="input" autoComplete="name" required minLength={2} />
          </div>
        )}
        <div className="field">
          <label htmlFor="email">E-mail</label>
          <input id="email" name="email" type="email" className="input" autoComplete="email" inputMode="email" required />
        </div>
        <div className="field">
          <label htmlFor="password">Senha</label>
          <input id="password" name="password" type="password" className="input" autoComplete={mode === "signin" ? "current-password" : "new-password"} required minLength={10} />
          {mode === "signin" && <a href="/recuperar-senha" style={{ fontSize: 14, color: "var(--fc-accent)", alignSelf: "flex-end", paddingBlock: "6px" }}>Esqueci minha senha</a>}
        </div>
        <Button type="submit" size="lg" block variant={anySocial ? "secondary" : "primary"} disabled={loading} aria-busy={loading}>
          {loading ? "Aguarde…" : mode === "signin" ? "Entrar com e-mail" : "Criar conta"}
        </Button>
      </form>

      <p className="muted" style={{ textAlign: "center", margin: 0, fontSize: 15 }}>
        {mode === "signin" ? "Ainda não tem conta? " : "Já tem conta? "}
        <button type="button" className="btn btn-ghost" style={{ minHeight: 32, padding: "0 6px", color: "var(--fc-accent)" }} onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
          {mode === "signin" ? "Criar conta" : "Entrar"}
        </button>
      </p>
    </div>
  );
}

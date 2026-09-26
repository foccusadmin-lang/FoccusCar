"use client";

import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { Alert } from "./ui/Alert";
import { Button } from "./ui/Button";

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const email = String(new FormData(e.currentTarget).get("email"));
    const { error } = await authClient.requestPasswordReset({ email, redirectTo: "/redefinir-senha" });
    setBusy(false);
    // Mesma resposta exista ou não a conta, para não revelar quais e-mails estão cadastrados.
    if (error && error.status === 429) return setError("Muitas tentativas. Aguarde um minuto e tente novamente.");
    setSent(true);
  }
  if (sent)
    return <Alert tone="success" title="Verifique seu e-mail">Se houver uma conta com esse e-mail, enviamos um link para criar uma nova senha. O link vale por 1 hora.</Alert>;
  return (
    <form className="stack" style={{ gap: 14 }} onSubmit={onSubmit}>
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="field">
        <label htmlFor="email">E-mail da conta</label>
        <input id="email" name="email" type="email" className="input" autoComplete="email" inputMode="email" required />
      </div>
      <Button type="submit" size="lg" block disabled={busy}>{busy ? "Enviando…" : "Enviar link"}</Button>
      <p className="muted" style={{ margin: 0, fontSize: 14 }}>Entrou com Google, Microsoft ou Apple? Use o mesmo botão na tela de login; a senha é gerenciada pelo provedor.</p>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string | null }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  if (!token) return <Alert tone="danger" title="Link inválido ou expirado">Peça um novo link em "Esqueci minha senha".</Alert>;
  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const password = String(form.get("password"));
    if (password !== String(form.get("confirm"))) return setError("As senhas não são iguais.");
    setBusy(true);
    setError(null);
    const { error } = await authClient.resetPassword({ newPassword: password, token: token! });
    setBusy(false);
    if (error) return setError(error.status === 400 ? "O link expirou ou já foi usado. Peça um novo." : "Não foi possível alterar a senha. Tente novamente.");
    setDone(true);
  }
  if (done)
    return (
      <div className="stack" style={{ gap: 14 }}>
        <Alert tone="success">Senha alterada. Entre com a nova senha.</Alert>
        <a className="btn btn-primary btn-lg btn-block" href="/entrar">Entrar</a>
      </div>
    );
  return (
    <form className="stack" style={{ gap: 14 }} onSubmit={onSubmit}>
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="field">
        <label htmlFor="password">Nova senha</label>
        <input id="password" name="password" type="password" className="input" autoComplete="new-password" minLength={10} required />
        <span className="muted" style={{ fontSize: 13 }}>Mínimo de 10 caracteres.</span>
      </div>
      <div className="field">
        <label htmlFor="confirm">Repita a nova senha</label>
        <input id="confirm" name="confirm" type="password" className="input" autoComplete="new-password" minLength={10} required />
      </div>
      <Button type="submit" size="lg" block disabled={busy}>{busy ? "Salvando…" : "Salvar nova senha"}</Button>
    </form>
  );
}

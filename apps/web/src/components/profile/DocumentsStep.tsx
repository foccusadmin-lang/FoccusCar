"use client";

import type { MyProfile } from "@foccus/services";
import { useState } from "react";
import { compressImage } from "@/lib/image";
import { Badge, type Tone } from "../ui/Badge";

const STATUS: Record<string, { label: string; tone: Tone }> = {
  PENDING: { label: "Enviado", tone: "info" },
  UNDER_REVIEW: { label: "Em análise", tone: "info" },
  APPROVED: { label: "Aprovado", tone: "success" },
  REJECTED: { label: "Reenviar", tone: "danger" },
  EXPIRED: { label: "Vencido", tone: "danger" },
};

const HINTS: Record<string, string> = {
  CNH_FRONT: "Foto nítida da frente, sem reflexo, com todos os cantos visíveis.",
  CNH_BACK: "Foto nítida do verso.",
  SELFIE: "Rosto inteiro, sem óculos escuros ou boné, em lugar iluminado.",
  PROOF_OF_ADDRESS: "Conta de consumo dos últimos 90 dias, em seu nome ou de familiar.",
  RG: "Frente e verso na mesma foto, ou PDF.",
};

const OPTIONAL = [{ type: "RG", label: "RG (opcional)" }];

/** Envio de documentos com câmera do aparelho (seção 99): abre a câmera traseira, ou a frontal para selfie. */
export function DocumentsStep({ profile, onChange }: { profile: MyProfile; onChange: (p: MyProfile) => void }) {
  const [uploading, setUploading] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [version, setVersion] = useState(0);

  async function upload(type: string, original: File | undefined) {
    if (!original) return;
    setErrors((e) => ({ ...e, [type]: "" }));
    setUploading(type);
    try {
      const file = await compressImage(original);
      if (file.size > 10 * 1024 * 1024) throw new Error("O arquivo deve ter até 10 MB.");
      const form = new FormData();
      form.set("type", type);
      form.set("file", file);
      const res = await fetch("/api/me/documents", { method: "POST", body: form });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error?.message ?? "Não foi possível enviar o arquivo. Tente novamente.");
      const p = await fetch("/api/me/profile").then((r) => r.json());
      onChange(p);
      setVersion((v) => v + 1);
    } catch (err) {
      setErrors((e) => ({ ...e, [type]: err instanceof Error && err.message !== "Failed to fetch" ? err.message : "Sem conexão. Tente novamente." }));
    } finally {
      setUploading(null);
    }
  }

  const items = [...profile.requiredDocuments, ...OPTIONAL.filter((o) => !profile.requiredDocuments.some((r) => r.type === o.type))];

  return (
    <div className="stack" style={{ gap: 12 }}>
      <p className="muted" style={{ margin: 0 }}>Tire as fotos agora pelo celular ou envie arquivos (JPG, PNG, WEBP ou PDF, até 10 MB).</p>
      <div className="doc-grid">
        {items.map((item) => {
          const doc = profile.documents.find((d) => d.type === item.type);
          const st = doc ? STATUS[doc.status] : undefined;
          const canSend = !doc || doc.status === "PENDING" || doc.status === "REJECTED" || doc.status === "EXPIRED";
          const busy = uploading === item.type;
          return (
            <div key={item.type} className="card doc-card">
              <div className="doc-thumb" aria-hidden>
                {doc && doc.mimeType.startsWith("image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/documents/${doc.id}/file?v=${version}`} alt="" />
                ) : doc ? "PDF" : "—"}
              </div>
              <div className="stack" style={{ gap: 6, minWidth: 0, flex: 1 }}>
                <div className="row" style={{ justifyContent: "space-between", gap: 8 }}>
                  <strong>{item.label}</strong>
                  {st ? <Badge tone={st.tone}>{st.label}</Badge> : <Badge tone="warning">Pendente</Badge>}
                </div>
                {doc?.status === "REJECTED" && doc.rejectionReason ? (
                  <span style={{ fontSize: 13, color: "#f09a97" }}>{doc.rejectionReason}</span>
                ) : (
                  <span className="muted" style={{ fontSize: 13 }}>{HINTS[item.type]}</span>
                )}
                {errors[item.type] && <span role="alert" style={{ fontSize: 13, color: "#f09a97" }}>{errors[item.type]}</span>}
                {canSend && (
                  <div className="row" style={{ gap: 8 }}>
                    <label className={`btn ${doc ? "btn-secondary" : "btn-primary"} file-btn`} style={{ minHeight: 40, padding: "0 14px", fontSize: 14 }} aria-disabled={busy}>
                      {busy ? "Enviando…" : doc ? "Tirar outra" : "Tirar foto"}
                      <input
                        type="file"
                        accept="image/*"
                        capture={item.type === "SELFIE" ? "user" : "environment"}
                        disabled={busy}
                        aria-label={`Tirar foto: ${item.label}`}
                        onChange={(e) => { upload(item.type, e.target.files?.[0]); e.target.value = ""; }}
                      />
                    </label>
                    <label className="btn btn-ghost file-btn" style={{ minHeight: 40, padding: "0 10px", fontSize: 14 }} aria-disabled={busy}>
                      Arquivo
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        disabled={busy}
                        aria-label={`Escolher arquivo: ${item.label}`}
                        data-doc-type={item.type}
                        onChange={(e) => { upload(item.type, e.target.files?.[0]); e.target.value = ""; }}
                      />
                    </label>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

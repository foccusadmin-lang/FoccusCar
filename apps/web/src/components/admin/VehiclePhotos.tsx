"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { compressImage } from "@/lib/image";
import { Alert } from "../ui/Alert";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { EmptyState } from "../ui/EmptyState";

type Photo = { id: string; isCover: boolean; isPublic: boolean };

/** Fotos do veículo: câmera ou galeria, compressão no aparelho, capa e visibilidade na vitrine (seções 29 e 99). */
export function VehiclePhotos({ vehicleId, photos, canManage }: { vehicleId: string; photos: Photo[]; canManage: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "danger" | "success"; text: string } | null>(null);
  const [removing, setRemoving] = useState<Photo | null>(null);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setMessage(null);
    let sent = 0;
    let failed = false;
    for (const original of Array.from(files)) {
      setBusy(`Enviando ${sent + 1} de ${files.length}…`);
      try {
        const file = await compressImage(original);
        const form = new FormData();
        form.set("file", file);
        const res = await fetch(`/api/vehicles/${vehicleId}/photos`, { method: "POST", body: form });
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error?.message ?? "Não foi possível enviar a foto.");
        sent++;
      } catch (err) {
        setMessage({ tone: "danger", text: err instanceof Error && err.message !== "Failed to fetch" ? err.message : "Sem conexão. Tente novamente." });
        failed = true;
        break;
      }
    }
    setBusy(null);
    if (sent) {
      if (!failed) setMessage({ tone: "success", text: `${sent} foto(s) enviada(s).` });
      router.refresh();
    }
  }

  async function act(photo: Photo, method: "PATCH" | "DELETE", body?: object) {
    setBusy(photo.id);
    setMessage(null);
    const res = await fetch(`/api/vehicle-photos/${photo.id}`, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined }).catch(() => null);
    const json = await res?.json().catch(() => null);
    setBusy(null);
    setRemoving(null);
    if (!res?.ok) return setMessage({ tone: "danger", text: json?.error?.message ?? "Sem conexão. Tente novamente." });
    router.refresh();
  }

  return (
    <div className="stack" style={{ gap: 16 }}>
      {canManage && (
        <div className="row">
          <label className="btn btn-primary file-btn" aria-disabled={Boolean(busy)}>
            {busy?.startsWith("Enviando") ? busy : "Tirar foto"}
            <input type="file" accept="image/*" capture="environment" disabled={Boolean(busy)} aria-label="Tirar foto do veículo" onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />
          </label>
          <label className="btn btn-secondary file-btn" aria-disabled={Boolean(busy)}>
            Escolher da galeria
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={Boolean(busy)} aria-label="Escolher fotos do veículo" data-testid="photo-input" onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />
          </label>
          <span className="muted" style={{ fontSize: 13 }}>JPG, PNG ou WEBP, até 20 fotos. A primeira vira a capa.</span>
        </div>
      )}
      {message && <Alert tone={message.tone}>{message.text}</Alert>}
      {photos.length === 0 ? (
        <EmptyState title="Sem fotos" description="Fotos reais do veículo aparecem na vitrine e ajudam a registrar o estado do carro." />
      ) : (
        <div className="photo-grid">
          {photos.map((p) => (
            <div key={p.id} className="card photo-tile">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/vehicle-photos/${p.id}`} alt={p.isCover ? "Foto de capa" : "Foto do veículo"} loading="lazy" />
              <div className="actions">
                {p.isCover ? <Badge tone="gold">Capa</Badge> : !p.isPublic ? <Badge plain>Só interna</Badge> : <Badge plain>Na vitrine</Badge>}
                {canManage && (
                  <>
                    {!p.isCover && <Button variant="ghost" disabled={busy === p.id} onClick={() => act(p, "PATCH", { isCover: true })}>Tornar capa</Button>}
                    {!p.isCover && <Button variant="ghost" disabled={busy === p.id} onClick={() => act(p, "PATCH", { isPublic: !p.isPublic })}>{p.isPublic ? "Ocultar" : "Mostrar"}</Button>}
                    <Button variant="ghost" disabled={busy === p.id} onClick={() => setRemoving(p)}>Remover</Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <ConfirmDialog open={Boolean(removing)} title="Remover esta foto?" confirmLabel="Remover foto" tone="danger" busy={Boolean(busy)} onCancel={() => setRemoving(null)} onConfirm={() => removing && act(removing, "DELETE")}>
        <p style={{ margin: 0 }}>A foto sai do cadastro e da vitrine. O registro da remoção fica na Vida do Veículo.</p>
      </ConfirmDialog>
    </div>
  );
}

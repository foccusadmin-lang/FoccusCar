import { uploadMyDocument } from "@foccus/services";
import { NextResponse } from "next/server";
import { AppError, requestMeta, requireAccess, route } from "@/server/api";
import { deps } from "@/server/services";

/** Upload multipart de documento (arquivo já comprimido no aparelho). */
export const POST = route(async (req: Request) => {
  const ctx = await requireAccess();
  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > 11 * 1024 * 1024) throw new AppError("O arquivo deve ter até 10 MB.", 413, "TOO_LARGE");
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new AppError("Selecione um arquivo.", 422, "NO_FILE");
  const doc = await uploadMyDocument(
    deps,
    ctx,
    { type: String(form.get("type")) as never, fileName: file.name, contentType: file.type, bytes: new Uint8Array(await file.arrayBuffer()) },
    requestMeta(req),
  );
  return NextResponse.json(doc, { status: 201 });
});

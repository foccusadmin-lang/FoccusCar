import { readDocumentFile } from "@foccus/services";
import { requireAccess, route } from "@/server/api";
import { deps } from "@/server/services";

/** Entrega o arquivo só ao dono ou a quem analisa documentos; nunca fica em cache público. */
export const GET = route(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const file = await readDocumentFile(deps, await requireAccess(), id);
  return new Response(Buffer.from(file.bytes), {
    headers: {
      "content-type": file.contentType,
      "content-disposition": `inline; filename="${file.fileName}"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'",
    },
  });
});

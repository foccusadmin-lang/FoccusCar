import { archiveVehicleDocument, readVehicleDocumentFile } from "@foccus/services";
import { NextResponse } from "next/server";
import { fileResponse, readJson, requestMeta, requireAccess, route } from "@/server/api";
import { deps } from "@/server/services";

type P = { params: Promise<{ id: string }> };

export const GET = route(async (_req: Request, { params }: P) => {
  return fileResponse(await readVehicleDocumentFile(deps, await requireAccess(), (await params).id));
});

/** Arquiva (não apaga) um documento da frota: { reason }. */
export const DELETE = route(async (req: Request, { params }: P) => {
  const ctx = await requireAccess();
  const body = (await readJson(req)) as { reason?: unknown };
  return NextResponse.json(await archiveVehicleDocument(deps, ctx, (await params).id, body?.reason, requestMeta(req)));
});

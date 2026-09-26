import { getVehicle, updateVehicle } from "@foccus/services";
import { NextResponse } from "next/server";
import { readJson, requestMeta, requireAccess, route } from "@/server/api";
import { deps } from "@/server/services";

type P = { params: Promise<{ id: string }> };

export const GET = route(async (_req: Request, { params }: P) => {
  return NextResponse.json(await getVehicle(deps, await requireAccess(), (await params).id));
});

/** Edição do cadastro: { data, reason? }. Dados críticos exigem motivo. */
export const PATCH = route(async (req: Request, { params }: P) => {
  const ctx = await requireAccess();
  return NextResponse.json(await updateVehicle(deps, ctx, (await params).id, await readJson(req), requestMeta(req)));
});

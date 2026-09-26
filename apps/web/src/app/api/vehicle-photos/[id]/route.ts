import { readVehiclePhoto, removeVehiclePhoto, updateVehiclePhoto } from "@foccus/services";
import { NextResponse } from "next/server";
import { AppError, fileResponse, readJson, requestMeta, requireAccess, route } from "@/server/api";
import { getAccess, getCurrentCompany } from "@/server/auth";
import { deps } from "@/server/services";

type P = { params: Promise<{ id: string }> };

/** Foto pública (vitrine) sem login; fotos internas só para a equipe. */
export const GET = route(async (_req: Request, { params }: P) => {
  const company = await getCurrentCompany();
  if (!company) throw new AppError("Locadora não encontrada para este endereço.", 404, "COMPANY_NOT_FOUND");
  const ctx = await getAccess();
  const file = await readVehiclePhoto(deps, company.id, ctx, (await params).id);
  return fileResponse(file, file.isPublic ? "public" : "private");
});

export const PATCH = route(async (req: Request, { params }: P) => {
  const ctx = await requireAccess();
  return NextResponse.json(await updateVehiclePhoto(deps, ctx, (await params).id, await readJson(req), requestMeta(req)));
});

export const DELETE = route(async (req: Request, { params }: P) => {
  const ctx = await requireAccess();
  return NextResponse.json(await removeVehiclePhoto(deps, ctx, (await params).id, requestMeta(req)));
});

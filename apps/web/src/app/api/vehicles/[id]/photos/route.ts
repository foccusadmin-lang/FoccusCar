import { uploadVehiclePhoto } from "@foccus/services";
import { NextResponse } from "next/server";
import { AppError, readFormFile, requestMeta, requireAccess, route } from "@/server/api";
import { deps } from "@/server/services";

/** Foto do veículo (multipart, já comprimida no aparelho). */
export const POST = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireAccess();
  const { file } = await readFormFile(req, 8);
  if (!file) throw new AppError("Selecione uma foto.", 422, "NO_FILE");
  return NextResponse.json(await uploadVehiclePhoto(deps, ctx, (await params).id, file, requestMeta(req)), { status: 201 });
});

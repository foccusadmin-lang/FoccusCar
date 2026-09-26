import { addVehicleDocument } from "@foccus/services";
import { NextResponse } from "next/server";
import { readFormFile, requestMeta, requireAccess, route } from "@/server/api";
import { deps } from "@/server/services";

/** Documento da frota: campos + arquivo opcional (multipart). */
export const POST = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireAccess();
  const { form, file } = await readFormFile(req, 10);
  const fields = Object.fromEntries(["type", "number", "issuedAt", "expiresAt", "costCents"].map((k) => [k, form.get(k)?.toString() ?? ""]));
  return NextResponse.json(await addVehicleDocument(deps, ctx, (await params).id, fields, file, requestMeta(req)), { status: 201 });
});

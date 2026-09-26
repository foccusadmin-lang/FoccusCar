import { changeVehicleStatus } from "@foccus/services";
import { NextResponse } from "next/server";
import { readJson, requestMeta, requireAccess, route } from "@/server/api";
import { deps } from "@/server/services";

export const POST = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireAccess();
  return NextResponse.json(await changeVehicleStatus(deps, ctx, (await params).id, await readJson(req), requestMeta(req)));
});

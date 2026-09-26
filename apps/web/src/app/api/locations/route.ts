import { createLocation } from "@foccus/services";
import { NextResponse } from "next/server";
import { readJson, requestMeta, requireAccess, route } from "@/server/api";
import { deps } from "@/server/services";

export const POST = route(async (req: Request) => {
  const ctx = await requireAccess();
  return NextResponse.json(await createLocation(deps, ctx, await readJson(req), requestMeta(req)), { status: 201 });
});

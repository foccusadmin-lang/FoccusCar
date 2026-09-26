import { getMyProfile, saveMyProfile } from "@foccus/services";
import { NextResponse } from "next/server";
import { requestMeta, requireAccess, route } from "@/server/api";
import { deps } from "@/server/services";

export const dynamic = "force-dynamic";

export const GET = route(async () => NextResponse.json(await getMyProfile(deps, await requireAccess())));

export const PUT = route(async (req: Request) => {
  const ctx = await requireAccess();
  await saveMyProfile(deps, ctx, await req.json(), requestMeta(req));
  return NextResponse.json(await getMyProfile(deps, ctx));
});

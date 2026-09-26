import { changeMemberRole } from "@foccus/services";
import { NextResponse } from "next/server";
import { readJson, requestMeta, requireAccess, route } from "@/server/api";
import { deps } from "@/server/services";

/** Concede ou retira perfil: { role, action: GRANT|REVOKE, reason }. */
export const POST = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireAccess();
  return NextResponse.json(await changeMemberRole(deps, ctx, (await params).id, await readJson(req), requestMeta(req)));
});

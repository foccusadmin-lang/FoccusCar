import { findMemberByEmail } from "@foccus/services";
import { NextResponse } from "next/server";
import { readJson, requireAccess, route } from "@/server/api";
import { deps } from "@/server/services";

export const POST = route(async (req: Request) => {
  const ctx = await requireAccess();
  const body = (await readJson(req)) as { email?: unknown };
  return NextResponse.json(await findMemberByEmail(deps, ctx, body?.email));
});

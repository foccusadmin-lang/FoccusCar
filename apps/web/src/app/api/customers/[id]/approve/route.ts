import { approveAccount } from "@foccus/services";
import { NextResponse } from "next/server";
import { requestMeta, requireAccess, route } from "@/server/api";
import { deps } from "@/server/services";

export const POST = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  return NextResponse.json(await approveAccount(deps, await requireAccess(), id, requestMeta(req)));
});

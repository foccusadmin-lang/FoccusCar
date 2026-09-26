import { submitMyProfile } from "@foccus/services";
import { NextResponse } from "next/server";
import { requestMeta, requireAccess, route } from "@/server/api";
import { deps } from "@/server/services";

export const POST = route(async (req: Request) => NextResponse.json(await submitMyProfile(deps, await requireAccess(), requestMeta(req))));

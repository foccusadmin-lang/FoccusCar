import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getMyProfile } from "@foccus/services";
import { ProfileWizard } from "@/components/profile/ProfileWizard";
import { SignOutButton } from "@/components/SignOutButton";
import { getAccess, getSession } from "@/server/auth";
import { deps } from "@/server/services";

export const metadata: Metadata = { title: "Meu cadastro" };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) redirect("/entrar?next=/cadastro");
  const access = await getAccess();
  if (!access) redirect("/");
  const profile = await getMyProfile(deps, access);

  return (
    <div className="container" style={{ paddingBlock: "24px 16px", maxWidth: 820 }}>
      <div className="stack" style={{ gap: 20 }}>
        <div className="stack" style={{ gap: 4 }}>
          <span className="eyebrow">Minha conta</span>
          <h1 style={{ fontSize: "clamp(24px, 5vw, 30px)" }}>Olá, {session.user.name.split(" ")[0]}</h1>
        </div>
        <ProfileWizard initial={profile} />
        <SignOutButton />
      </div>
    </div>
  );
}

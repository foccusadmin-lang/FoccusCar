import { checkServiceAccess } from "@foccus/core";
import { isRepresentative, isStaff } from "@/lib/navigation";
import { getAccess, getSession } from "@/server/auth";
import { ButtonLink } from "./ui/Button";
import { Logo } from "./Logo";

export async function SiteHeader() {
  const session = await getSession();
  const access = session ? await getAccess() : null;
  const staff = access ? isStaff(access.permissions) : false;
  const representative = access ? isRepresentative(access.permissions) : false;
  // No celular cabe um link só: a área principal da pessoa (as outras ficam no menu da área).
  const primary = staff ? "admin" : representative ? "representante" : "conta";
  const accountHref = access && checkServiceAccess(access.accountStatus).allowed ? "/conta" : "/cadastro";
  return (
    <header className="site-header">
      <div className="container inner">
        <Logo height={44} />
        <nav aria-label="Principal">
          <a className="link hide-sm" href="/#frota">Veículos</a>
          {session ? (
            <>
              {staff && <a className={primary === "admin" ? "link" : "link hide-sm"} href="/admin">Painel</a>}
              {representative && <a className={primary === "representante" ? "link" : "link hide-sm"} href="/representante">Representante</a>}
              <a className={primary === "conta" ? "link" : "link hide-sm"} href={accountHref}>Minha conta</a>
            </>
          ) : (
            <ButtonLink href="/entrar" variant="secondary">Entrar</ButtonLink>
          )}
        </nav>
      </div>
    </header>
  );
}

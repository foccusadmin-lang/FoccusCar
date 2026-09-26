import { canAccessAdmin } from "@foccus/core";
import { getAccess, getSession } from "@/server/auth";
import { ButtonLink } from "./ui/Button";
import { Logo } from "./Logo";

export async function SiteHeader() {
  const session = await getSession();
  const access = session ? await getAccess() : null;
  return (
    <header className="site-header">
      <div className="container inner">
        <Logo height={44} />
        <nav aria-label="Principal">
          <a className="link hide-sm" href="/#frota">Veículos</a>
          {session ? (
            <>
              {access && (canAccessAdmin(access.permissions) || access.permissions.has("customers:documents.review")) && <a className="link" href="/admin">Painel</a>}
              <a className="link" href="/cadastro">Minha conta</a>
            </>
          ) : (
            <ButtonLink href="/entrar" variant="secondary">Entrar</ButtonLink>
          )}
        </nav>
      </div>
    </header>
  );
}

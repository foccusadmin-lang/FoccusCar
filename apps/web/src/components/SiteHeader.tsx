import { getSession } from "@/server/auth";
import { ButtonLink } from "./ui/Button";
import { Logo } from "./Logo";

export async function SiteHeader() {
  const session = await getSession();
  return (
    <header className="site-header">
      <div className="container inner">
        <Logo height={44} />
        <nav aria-label="Principal">
          <a className="link hide-sm" href="/#frota">Veículos</a>
          {session ? (
            <>
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

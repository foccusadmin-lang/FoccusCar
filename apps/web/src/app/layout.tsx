import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Foccus Car — Locadora de Veículos", template: "%s · Foccus Car" },
  description: "Sua frota. Seus clientes. Suas locações. Seu controle.",
  applicationName: "Foccus Car",
  appleWebApp: { capable: true, title: "Foccus Car", statusBarStyle: "black-translucent" },
  icons: { apple: "/icons/apple-touch-icon.png" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#050506",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <a href="#conteudo" className="sr-only">Ir para o conteúdo</a>
        <SiteHeader />
        <main id="conteudo">{children}</main>
        <footer className="footer">
          <div className="container stack" style={{ gap: 8 }}>
            <div className="gold-rule">Foccus Car</div>
            <p style={{ margin: 0, textAlign: "center" }}>Sua frota. Seus clientes. Suas locações. Seu controle.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}

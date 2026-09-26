import type { MetadataRoute } from "next";

/** PWA (seção 7): mesma aplicação, instalável na tela inicial. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Foccus Car — Locadora de Veículos",
    short_name: "Foccus Car",
    description: "Sua frota. Seus clientes. Suas locações. Seu controle.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#050506",
    theme_color: "#050506",
    lang: "pt-BR",
    categories: ["business", "travel", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

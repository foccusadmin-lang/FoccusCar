import type { CapacitorConfig } from "@capacitor/cli";

/**
 * O app nativo abre o próprio site da Foccus Car (FOCCUS_APP_URL) e acrescenta o que o
 * navegador não permite: localização em segundo plano durante a locação.
 * Assim uma única base de código serve web, PWA, Android e iPhone.
 */
const url = process.env.FOCCUS_APP_URL ?? "https://app.foccuscar.com.br";

const config: CapacitorConfig = {
  appId: "br.com.foccuscar.app",
  appName: "Foccus Car",
  webDir: "www",
  backgroundColor: "#050506",
  server: {
    url,
    cleartext: url.startsWith("http://"),
    allowNavigation: [new URL(url).host],
  },
  android: { allowMixedContent: false },
  ios: { contentInset: "always" },
};

export default config;
